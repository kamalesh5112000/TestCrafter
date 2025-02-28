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
      console.log("📥 Received interactions:", interactionList);
      setActions(interactionList);
    });

    return () => {
      socket.off("browserLaunched");
      socket.off("interactionRecorded");
    };
  }, [socket]);

  // ✅ Add event listeners to the iframe for click/input events
  const addIframeListeners = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    iframe.onload = () => {
      try {
        const iframeDoc = iframe.contentWindow.document;

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

        iframeDoc.addEventListener("click", (event) => {
          const xpath = getXPath(event.target);
          const action = { type: "click", tag: event.target.tagName, xpath };
          socket.emit("interactionFromFrontend", { userId, action }); // Send to backend
        });

        iframeDoc.addEventListener("input", (event) => {
          const xpath = getXPath(event.target);
          const action = { type: "input", tag: event.target.tagName, xpath, value: event.target.value };
          socket.emit("interactionFromFrontend", { userId, action }); // Send to backend
        });

        console.log("✅ Listeners added to iframe.");
      } catch (err) {
        console.warn("⚠️ Could not access iframe content due to CORS:", err);
      }
    };
  };

  useEffect(() => {
    if (isRecording) {
      addIframeListeners();
    }
  }, [isRecording]);

  const startRecording = () => {
    console.log("▶️ Start recording...");
    socket.emit("startRecording", { userId });
    setIsRecording(true);
  };

  const stopRecording = () => {
    console.log("⏹ Stop recording...");
    socket.emit("stopRecording", { userId });
    setIsRecording(false);
  };

  const closeBrowser = () => {
    console.log("❌ Closing browser...");
    socket.emit("closeBrowser", { userId });
    onClose();
  };

  return (
    <div className="flex h-screen w-screen">
      {/* Sidebar */}
      <div className="w-1/3 bg-gray-100 p-5 shadow-lg flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Recording Actions</h2>
          <button onClick={closeBrowser} className="text-red-500 text-xl font-bold hover:text-red-700">✖</button>
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
            <ul className="space-y-2">
              {actions.map((action, index) => (
                <li key={index} className="text-sm text-gray-700 bg-gray-200 p-2 rounded">
                  {action.type} - {action.tag} ({action.xpath})
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
