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
                args: ['--disable-blink-features=AutomationControlled']
            });
            const page = await browser.newPage();
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

        await page.exposeFunction("sendInteractionToBackend", (data) => {
          console.log("📝 Interaction detected in Puppeteer:", data);
          activeBrowsers[userId].interactions.push(data);
          socket.emit("interactionRecorded", activeBrowsers[userId].interactions);
        });

        await page.evaluate(() => {
          function getXPath(element) {
            if (element.id !== "") return `//*[@id="${element.id}"]`;
            const parts = [];
            while (element && element.nodeType === Node.ELEMENT_NODE) {
              let index = 0;
              let sibling = element.previousSibling;
              while (sibling) {
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === element.tagName) index++;
                sibling = sibling.previousSibling;
              }
              parts.unshift(element.tagName + "[" + (index + 1) + "]");
              element = element.parentNode;
            }
            return parts.length ? "/" + parts.join("/") : null;
          }

          document.addEventListener("click", (event) => {
            const xpath = getXPath(event.target);
            window.sendInteractionToBackend({ type: "click", tag: event.target.tagName, xpath });
          });

          document.addEventListener("input", (event) => {
            const xpath = getXPath(event.target);
            window.sendInteractionToBackend({ type: "input", tag: event.target.tagName, xpath, value: event.target.value });
          });
        });

        socket.emit("recordingStarted");
        console.log("✅ Recording started for user:", userId);
      } catch (error) {
        console.error("❌ Error starting recording:", error);
        socket.emit("recordingError", "Failed to start recording.");
      }
    });

    socket.on("stopRecording", async ({ userId }) => {
      if (!activeBrowsers[userId]) {
        return socket.emit("recordingError", "No active session.");
      }

      try {
        const recordedInteractions = activeBrowsers[userId].interactions;
        socket.emit("recordingStopped", { interactions: recordedInteractions });
        console.log("⏹ Recording stopped for user:", userId);
      } catch (error) {
        console.error("Error stopping recording:", error);
        socket.emit("recordingError", "Failed to stop recording.");
      }
    });

    socket.on("interactionFromFrontend", async ({ userId, action }) => {
      if (!activeBrowsers[userId]) {
          return console.log("❌ No active Puppeteer session for this user.");
      }
      
      const { page } = activeBrowsers[userId];
  
      try {
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
  
          // Store recorded interaction
          activeBrowsers[userId].interactions.push(action);
          socket.emit("interactionRecorded", activeBrowsers[userId].interactions);
          
      } catch (error) {
          console.error("❌ Error performing action in Puppeteer:", error);
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
