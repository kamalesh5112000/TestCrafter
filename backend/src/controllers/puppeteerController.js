const puppeteer = require("puppeteer");
const socketIo = require("socket.io");

const activeBrowsers = {}; // Store browser instances by userId

module.exports = (server) => {
  const io = socketIo(server, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("launchBrowser", async ({ url }) => {
      console.log("Received launchBrowser event for URL:", url);
      try {
          const browser = await puppeteer.launch({
              headless: false,
              args: [
                  '--disable-blink-features=AutomationControlled',
                  '--start-maximized' // Maximizes the window
              ],
              defaultViewport: null // Prevents Puppeteer from forcing a small viewport
          });
  
          const page = await browser.newPage();
  
          // Get the real screen dimensions using evaluate()
          const { width, height } = await page.evaluate(() => {
              return { width: window.screen.availWidth, height: window.screen.availHeight };
          });
  
          // Set viewport to match the real screen size
          await page.setViewport({ width, height });
  
          await page.goto(url, { waitUntil: "domcontentloaded" });
  
          const userId = socket.id;
          activeBrowsers[userId] = { browser, page, currentURL: url, interactions: [] };
  
          // Send the actual URL to the frontend
          socket.emit("browserLaunched", { userId, siteUrl: url });
          console.log("✅ Browser launched, user should open site:", url);
  
          startStreaming(userId, socket);
      } catch (error) {
          console.error("Error launching browser:", error);
          socket.emit("launchError", "Failed to launch browser.");
      }
  });  

    async function startStreaming(userId, socket) {
      if (!activeBrowsers[userId]) return;
      const { page } = activeBrowsers[userId];
      const session = await page.target().createCDPSession();
      await session.send("Page.enable");
      await session.send("Page.startScreencast", { format: "jpeg", quality: 50, everyNthFrame: 1 });

      session.on("Page.screencastFrame", ({ data, sessionId }) => {
        socket.emit("streamFrame", { data });
        session.send("Page.screencastFrameAck", { sessionId });
      });
    }

    socket.on("startRecording", async ({ userId }) => {
      if (!activeBrowsers[userId]) {
          return socket.emit("recordingError", "Browser not launched.");
      }
  
      try {
          const { page } = activeBrowsers[userId];
  
          // Expose function so frontend can send interactions
          await page.evaluate(() => {
            if (window.sendInteractionToBackend) {
                delete window.sendInteractionToBackend;
            }
        });
          await page.exposeFunction("sendInteractionToBackend", (data) => {
              console.log("📝 Interaction detected in Puppeteer:", data);
              activeBrowsers[userId].interactions.push(data);
              socket.emit("interactionRecorded", activeBrowsers[userId].interactions);
          });
  
          // Function to inject listeners
          async function injectListeners() {
              await page.evaluate(() => {
                  function getXPath(element) {
                      if (element.id) return `//*[@id="${element.id}"]`;
                      if (element.name) return `//input[@name="${element.name}"]`;
                      if (element.placeholder) return `//input[@placeholder="${element.placeholder}"]`;
                      if (element.getAttribute("aria-label")) return `//*[@aria-label="${element.getAttribute("aria-label")}"]`;
                      if (element.tagName === "BUTTON" || element.tagName === "A") {
                          let buttonText = element.innerText.trim();
                          if (buttonText.length > 0) return `//${element.tagName.toLowerCase()}[text()="${buttonText}"]`;
                      }
                      const parts = [];
                      while (element && element.nodeType === Node.ELEMENT_NODE) {
                          let index = 1;
                          let sibling = element.previousElementSibling;
                          while (sibling) {
                              if (sibling.tagName === element.tagName) index++;
                              sibling = sibling.previousElementSibling;
                          }
                          parts.unshift(`${element.tagName.toLowerCase()}[${index}]`);
                          element = element.parentNode;
                      }
                      return parts.length ? "/" + parts.join("/") : null;
                  }
  
                  function sendInteraction(type, event, extraData = {}) {
                      const xpath = getXPath(event.target);
                      if (!xpath) return;
                      window.sendInteractionToBackend({ type, tag: event.target.tagName, xpath, ...extraData });
                  }
  
                  // Remove existing event listeners before adding new ones
                  document.removeEventListener("click", handleClick);
                  document.removeEventListener("input", handleInput);
                  document.removeEventListener("keydown", handleKeydown);
                  document.removeEventListener("blur", handleBlur, true);
  
                  function handleClick(event) {
                      if (event.detail > 1) return; // Ignore extra clicks
                      sendInteraction("click", event);
                  }
  
                  let inputState = {};
  
                  function handleInput(event) {
                      const xpath = getXPath(event.target);
                      const newValue = event.target.value;
                      if (inputState[xpath] !== newValue) {
                          inputState[xpath] = newValue;
                      }
                  }
  
                  function handleBlur(event) {
                      const xpath = getXPath(event.target);
                      if (inputState[xpath] !== undefined) {
                          sendInteraction("input", event, { value: inputState[xpath] });
                          delete inputState[xpath];
                      }
                  }
  
                  function handleKeydown(event) {
                      if (event.key === "Enter") {
                          const xpath = getXPath(event.target);
                          if (inputState[xpath] !== undefined) {
                              sendInteraction("input", event, { value: inputState[xpath] });
                              delete inputState[xpath];
                          }
                          sendInteraction("keypress", event, { key: "Enter" });
                      }
                  }
  
                  document.addEventListener("click", handleClick);
                  document.addEventListener("input", handleInput);
                  document.addEventListener("blur", handleBlur, true);
                  document.addEventListener("keydown", handleKeydown);
              });
          }
  
          // Inject listeners immediately
          await injectListeners();
  
          // Listen for page navigations and reinject listeners
          page.on("framenavigated", async (frame) => {
              if (frame === page.mainFrame()) {
                  const newURL = frame.url();
                  console.log(`🌍 Page navigation detected! New URL: ${newURL}`);
  
                  // Store navigation event
                  const navigationInteraction = {
                      type: "navigation",
                      url: newURL,
                  };
  
                  activeBrowsers[userId].interactions.push(navigationInteraction);
  
                  // Emit to frontend
                  socket.emit("interactionRecorded", activeBrowsers[userId].interactions);
  
                  // Re-inject listeners after navigation
                  await injectListeners();
              }
          });
  
          socket.emit("recordingStarted");
          console.log("✅ Recording started for user:", userId);
      } catch (error) {
          console.error("❌ Error starting recording:", error);
          socket.emit("recordingError", "Failed to start recording.");
      }
  });

    socket.on("interactionFromFrontend", async ({ userId, action }) => {
      if (!activeBrowsers[userId]) {
        return console.log("❌ No active Puppeteer session for this user.");
      }
      
      const { page } = activeBrowsers[userId];
    
      try {
        console.log("Received action:", action);
    
        if (action.type === "click") {
          console.log("🖱 Clicking:", action.xpath);
          await page.evaluate((xpath) => {
            function getElementByXPath(xpath) {
              return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            }
            const el = getElementByXPath(xpath);
            if (el) el.click();
          }, action.xpath);
        } 
        
        else if (action.type === "input") {
          console.log("⌨️ Typing:", action.value, "at", action.xpath);
          await page.evaluate(({ xpath, value }) => {
            function getElementByXPath(xpath) {
              return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            }
            const el = getElementByXPath(xpath);
            if (el) {
              el.value = value;
              el.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }, action);
        }
    
        else if (action.type === "keypress" && action.key === "Enter") {
          console.log("🔢 Pressing Enter at:", action.xpath);
          await page.evaluate((xpath) => {
            function getElementByXPath(xpath) {
              return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            }
            const el = getElementByXPath(xpath);
            if (el) {
              el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
            }
          }, action.xpath);
        }
    
        else if (action.type === "scroll") {
          console.log("📜 Scrolling to:", action.scrollX, action.scrollY);
          await page.evaluate(({ scrollX, scrollY }) => {
            window.scrollTo(scrollX, scrollY);
          }, action);
        }
    
    
        else if (action.type === "right-click") {
          console.log("🖱 Right-clicking on:", action.xpath);
          await page.evaluate((xpath) => {
            function getElementByXPath(xpath) {
              return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            }
            const el = getElementByXPath(xpath);
            if (el) {
              el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
            }
          }, action.xpath);
        }
    
        // Store recorded interaction
        activeBrowsers[userId].interactions.push(action);
        socket.emit("interactionRecorded", activeBrowsers[userId].interactions);
        
      } catch (error) {
        console.error("❌ Error performing action in Puppeteer:", error);
      }
    });

    socket.on("stopRecording", async ({ userId }) => {
      if (!activeBrowsers[userId]) {
          return socket.emit("recordingError", "No active session.");
      }
  
      try {
          const { page } = activeBrowsers[userId];
  
          // Remove the exposed function to avoid duplicate bindings
          try {
              await page.removeExposedFunction("sendInteractionToBackend");
              console.log("🚫 Removed exposed function sendInteractionToBackend");
          } catch (error) {
              console.warn("⚠️ sendInteractionToBackend was not previously exposed.");
          }
  
          // Send recorded interactions before stopping
          const recordedInteractions = activeBrowsers[userId].interactions;
          socket.emit("recordingStopped", { interactions: recordedInteractions });
          console.log("⏹ Recording stopped for user:", userId);
      } catch (error) {
          console.error("Error stopping recording:", error);
          socket.emit("recordingError", "Failed to stop recording.");
      }
  });
  

    socket.on("clearInteractions", ({ userId }) => {
      if (activeBrowsers[userId]) {
          activeBrowsers[userId].interactions = []; // Clear stored interactions
          console.log(`🗑 Cleared interactions for user: ${userId}`);
      }
  });
    

    socket.on("closeBrowser", ({ userId }) => {
      console.log("Client requested browser close:", userId);
      if (activeBrowsers[userId]) {
        activeBrowsers[userId].browser.close();
        delete activeBrowsers[userId];
        console.log("Browser closed for user:", userId);
      } else {
        console.log("No active browser for user:", userId);
      }
    });
  });
};
