import React, { useState, useEffect, useRef } from "react";

const RecordingPage = ({ url, onClose, userId, socket }) => {
  const [actions, setActions] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    socket.on("browserLaunched", (data) => {
      console.log("🌐 Browser launched:", data.siteUrl);
    });

    socket.on("interactionRecorded", (interactionList) => {
      console.log("📥 [FRONTEND] Received recorded interactions:", interactionList);

      const updatedActions = [];

      interactionList.forEach((interaction, index) => {
        const lastAction = updatedActions[updatedActions.length - 1];

        // 🛑 Always keep navigation events, but prevent consecutive duplicates
        if (interaction.type === "navigation") {
          console.log("Current Interaction:", interaction)
          console.log("Last Interaction:", lastAction)
          if (!lastAction || lastAction.type !== "navigation") {
            console.log("Last and Current Interaction:", lastAction, interaction)
            updatedActions.push(interaction);
          }
        }
        // ✅ If the new action is identical to the last one (excluding navigation), update it
        else if (
          lastAction &&
          lastAction.type === interaction.type &&
          lastAction.tag === interaction.tag &&
          lastAction.xpath === interaction.xpath
        ) {
          updatedActions[updatedActions.length - 1] = interaction; // Update last entry
        }
        // ➕ Otherwise, add it as a new action
        else {
          updatedActions.push(interaction);
        }
      });

      setActions(updatedActions);
    });


    return () => {
      socket.off("browserLaunched");
      socket.off("interactionRecorded");
    };
  }, [socket]);

  const addIframeListeners = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    iframe.onload = () => {
      try {
        const iframeDoc = iframe.contentWindow.document;
        console.log("✅ [FRONTEND] Iframe loaded, adding event listeners...");

        const getXPath = (element) => {
          if (element.id) return `//*[@id="${element.id}"]`;
          let path = [];
          while (element && element.nodeType === 1) {
            let index = 0;
            let sibling = element.previousSibling;
            while (sibling) {
              if (sibling.nodeType === 1 && sibling.tagName === element.tagName) index++;
              sibling = sibling.previousSibling;
            }
            path.unshift(`${element.tagName}[${index + 1}]`);
            element = element.parentNode;
          }
          return `/${path.join("/")}`;
        };

        // Add event listeners to the iframe's document
        iframeDoc.addEventListener("click", (event) => {
          const xpath = getXPath(event.target);
          const action = { type: "click", tag: event.target.tagName, xpath };
          console.log("🖱 [FRONTEND] Click detected:", action);
          socket.emit("interactionFromFrontend", { userId, action });
        });

        iframeDoc.addEventListener("input", (event) => {
          const xpath = getXPath(event.target);
          const action = { type: "input", tag: event.target.tagName, xpath, value: event.target.value };
          console.log("⌨ [FRONTEND] Input detected:", action);
          socket.emit("interactionFromFrontend", { userId, action });
        });

        console.log("🎯 [FRONTEND] Event listeners added to iframe.");
      } catch (err) {
        console.warn("⚠️ [FRONTEND] Could not access iframe content due to CORS:", err);
      }
    };
  };
  console.log("Already Present Actions:", actions)
  useEffect(() => {
    if (isRecording) {
      addIframeListeners();
    }
  }, [isRecording]);

  const startRecording = () => {
    console.log("▶️ [FRONTEND] Start recording...");
    socket.emit("startRecording", { userId });
    setIsRecording(true);
  };

  const stopRecording = () => {
    console.log("⏹ [FRONTEND] Stop recording...");
    socket.emit("stopRecording", { userId });
    setIsRecording(false);
  };

  const closeBrowser = () => {
    console.log("❌ [FRONTEND] Closing browser...");
    socket.emit("closeBrowser", { userId });
    onClose();
  };

  return (
    <div className="flex h-screen w-screen">
      {/* Sidebar */}
      <div className="w-1/3 bg-gray-100 p-5 shadow-lg flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Recording Actions</h2>
          <button
            onClick={closeBrowser}
            disabled={isRecording}
            className={`text-xl font-bold ${isRecording ? "text-gray-400 cursor-not-allowed" : "text-red-500 hover:text-red-700"
              }`}
          >
            ✖
          </button>
        </div>

        {!isRecording ? (
          <button onClick={startRecording} className="w-full py-2 mb-2 bg-green-500 text-white rounded hover:bg-green-600">
            Start Recording
          </button>
        ) : (
          <button onClick={stopRecording} className="w-full py-2 mb-2 bg-red-500 text-white rounded hover:bg-red-600">
            Stop Recording
          </button>
        )}

        {/* Action List */}
        <div className="mt-4 flex-grow overflow-auto border border-gray-300 p-2 rounded bg-white">
          {actions.length > 0 ? (
            <ul className="space-y-2 bg-white p-4 rounded-lg shadow-md">
              {actions.map((action, index) => (
                <li
                  key={index}
                  className={`p-3 rounded-lg transition ${action.type === "navigation"
                      ? "bg-blue-200 text-blue-900 font-semibold border border-blue-400"
                      : "bg-gray-100 hover:bg-gray-200 border border-gray-300"
                    }`}
                >
                  {/* Show navigation as a separate list item */}
                  {action.type === "navigation" ? (
                    <p className="text-center">🌍 Navigated to: <span className="font-medium">{action.url}</span></p>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-900">{action.type}</span>
                        <span className="text-gray-600 ml-2">({action.tag})</span>

                        {/* Display additional details based on action type */}
                        {action.type === "input" && action.value && (
                          <p className="text-sm text-blue-700 mt-1">Value: {action.value}</p>
                        )}
                        {action.type === "keypress" && action.key && (
                          <p className="text-sm text-green-700 mt-1">Key: {action.key}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 break-all mt-1 sm:mt-0">{action.xpath}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>



          ) : (
            <p className="text-gray-500 text-sm">No actions recorded yet...</p>
          )}
        </div>
      </div>

      {/* Website Iframe */}
      <div className="w-2/3 h-full">
        <iframe ref={iframeRef} src={url} className="w-full h-full border-0"></iframe>
      </div>
    </div>
  );
};

export default RecordingPage;