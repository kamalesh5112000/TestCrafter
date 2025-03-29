import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const RecordingPage = ({ url, name, sessionName,  userId, socket, extractedFeatures }) => {
  const navigate = useNavigate();
  const [actions, setActions] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState("");
  const [showModal, setShowModal] = useState(false);
const [testCaseName, setTestCaseName] = useState("");

const [loading, setLoading] = useState(false);
const [message, setMessage] = useState("");
const [messageType, setMessageType] = useState("");
  const iframeRef = useRef(null);

  useEffect(() => {
    socket.on("browserLaunched", (data) => {
      console.log("🌐 Browser launched:", data.siteUrl);
    });

    
    
    socket.on("interactionRecorded", (interactionList) => {
      console.log("📥 [FRONTEND] Received recorded interactions:", interactionList);
    
      setActions((prevActions) => {
        const updatedActions = [...prevActions];
    
        interactionList.forEach((interaction) => {
          const lastAction = updatedActions[updatedActions.length - 1];
    
          // 🛑 Always keep navigation events, preventing consecutive duplicates
          if (interaction.type === "navigation") {
            if (!lastAction || lastAction.type !== "navigation") {
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
          // ➕ Otherwise, add it as a new action (only if it's not in the removed actions list)
          else if (!prevActions.some((action) => action.xpath === interaction.xpath && action.type === interaction.type)) {
            updatedActions.push(interaction);
          }
        });
    
        return updatedActions;
      });
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

  const stopRecording = async () => {
    console.log("⏹ [FRONTEND] Stop recording...");
    socket.emit("stopRecording", { userId });
    setIsRecording(false);
  
    if (actions.length > 0) {
      setShowModal(true); // Open modal instead of alert
    }
  };
  
  const handleSaveTestCase = async () => {
    if (!testCaseName.trim()) {
      setMessage("Please enter a test case name.");
      setMessageType("error");
      return;
    }
  
    setLoading(true);
    setMessage(""); // Clear previous messages
  
    try {
      const response = await fetch("http://localhost:5000/api/actions/store-actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, feature: selectedFeature, actions, testCaseName, name, sessionName }),
      });
  
      const data = await response.json();
  
      if (response.ok) {
        setMessage("✅ Actions stored successfully!");
        setMessageType("success");
        console.log("📦 Actions stored:", data);
  
        setTimeout(() => {
          setShowModal(false);
          setTestCaseName("");
          setMessage("");
        }, 500); // Close after showing success message
      } else {
        setMessage("❌ Failed to store actions. Try again.");
        setMessageType("error");
      }
    } catch (error) {
      console.error("❌ Error storing actions:", error);
      setMessage("❌ An error occurred while saving actions.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };
  

  const closeBrowser = () => {
    console.log("❌ [FRONTEND] Closing browser...");
    socket.emit("closeBrowser", { userId });
    navigate("/");
  };

  const handleRemoveAction = (actionToRemove) => {
    setActions((prevActions) => prevActions.filter((action) => action !== actionToRemove));
  };
  const clearAllInteractions = () => {
    setActions([]); // Clear frontend state
    socket.emit("clearInteractions", { userId }); // Notify backend
};

  return (
    <div className="flex h-screen w-screen">
      {/* Sidebar */}
<div className="w-1/3 bg-gray-100 p-5 shadow-lg flex flex-col">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-lg font-semibold text-gray-800">{name}</h2>
    <button
      onClick={closeBrowser}
      disabled={isRecording}
      className={`text-xl font-bold ${
        isRecording ? "text-gray-400 cursor-not-allowed" : "text-red-500 hover:text-red-700"
      }`}
    >
      ✖
    </button>
  </div>

{/* Feature Dropdown */}
<select
          value={selectedFeature}
          onChange={(e) => setSelectedFeature(e.target.value)}
          className="w-full p-2 mb-2 border border-gray-400 rounded bg-white"
        >
          <option value="">Select a feature</option>
          {extractedFeatures.map((feature, index) => (
            <option key={index} value={feature}>{feature}</option>
          ))}
        </select>
  {!isRecording ? (
    <button
      onClick={startRecording}
      disabled={!selectedFeature}
            className={`w-full py-2 mb-2 rounded ${
              selectedFeature ? "bg-green-500 text-white hover:bg-green-600" : "bg-gray-300 text-gray-600 cursor-not-allowed"
            }`}
    >
      Start Recording
    </button>
  ) : (
    <button
      onClick={stopRecording}
      className="w-full py-2 mb-2 bg-red-500 text-white rounded hover:bg-red-600"
    >
      Stop Recording
    </button>
  )}

  {/* Clear All Button */}
  <button
    onClick={clearAllInteractions}
    disabled={actions.length === 0}
    className={`w-full py-2 mb-2 rounded ${
      actions.length > 0
        ? "bg-yellow-500 text-white hover:bg-yellow-600"
        : "bg-gray-300 text-gray-600 cursor-not-allowed"
    }`}
  >
    Clear All
  </button>

  {/* Action List */}
  <div className="mt-4 flex-grow overflow-auto border border-gray-300 p-2 rounded bg-white relative">
    {actions.length > 0 ? (
      <ul className="space-y-2 bg-white p-4 rounded-lg shadow-md">
        {actions.map((action, index) => (
          <li
            key={index}
            className={`relative p-3 rounded-lg transition ${
              action.type === "navigation"
                ? "bg-blue-200 text-blue-900 font-semibold border border-blue-400"
                : "bg-gray-100 hover:bg-gray-200 border border-gray-300"
            }`}
          >
            {/* "Remove" button on each action */}
            <button
              className="absolute top-1 right-1 bg-gray-400 text-white text-xs rounded px-1 hover:bg-gray-500 transition"
              onClick={() => handleRemoveAction(action)}
            >
              ✖
            </button>

            {action.type === "navigation" ? (
              <p className="text-center">
                🌍 Navigated to:{" "}
                <span
                  className="font-medium underline cursor-pointer relative group"
                  title={action.url} // Tooltip on hover
                >
                  Link
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden w-max max-w-xs p-2 text-xs text-white bg-gray-700 rounded shadow-md z-50 group-hover:block">
                    {action.url}
                  </span>
                </span>
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-900">{action.type}</span>
                  <span className="text-gray-600 ml-2">({action.tag})</span>

                  {action.type === "input" && action.value && (
                    <p className="text-sm text-blue-700 mt-1">Value: {action.value}</p>
                  )}
                  {action.type === "keypress" && action.key && (
                    <p className="text-sm text-green-700 mt-1">Key: {action.key}</p>
                  )}
                </div>

                {/* XPath with hover tooltip */}
                <span
                  className="text-xs mt-2 text-gray-500 underline cursor-pointer mr-8 relative group"
                  title={action.xpath} // Tooltip on hover
                >
                  XPath
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 pr-24 hidden w-max max-w-xs p-2 text-xs text-white bg-gray-700 rounded shadow-md z-50 group-hover:block">
                    {action.xpath}
                  </span>
                </span>
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
{/* Popup Model */}
{showModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg w-96">
      <h2 className="text-lg font-semibold mb-2">Save Test Case</h2>

      <p><strong>Name:</strong> {name}</p>
      <p><strong>Selected Feature:</strong> {selectedFeature || "Not selected"}</p>

      {/* Test Case Name Input */}
      <input
        type="text"
        value={testCaseName}
        onChange={(e) => setTestCaseName(e.target.value)}
        placeholder="Enter test case name"
        className="w-full p-2 mt-2 border border-gray-300 rounded"
        disabled={loading}
      />

      {/* Success/Error Message */}
      {message && (
        <p className={`mt-2 ${messageType === "success" ? "text-green-500" : "text-red-500"}`}>
          {message}
        </p>
      )}

      {/* Buttons */}
      <div className="flex justify-end mt-4 space-x-2">
        <button 
          onClick={() => setShowModal(false)}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
          disabled={loading}
        >
          Cancel
        </button>

        <button 
          onClick={handleSaveTestCase} 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  </div>
)}




      {/* Website Iframe */}
      <div className="relative flex flex-col w-2/3 h-full">
    {/* Finish Button (Fixed on Top Right) */}
    <div className="absolute top-2 right-4">
      <button
        onClick={() => navigate("/test-cases")}
        className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 shadow-lg"
      >
        View Test Cases
      </button>
    </div>

    {/* Website Iframe (Below the Finish Button) */}
    <div className="flex-grow mt-14"> 
      <iframe ref={iframeRef} src={url} className="w-full h-full border-0"></iframe>
    </div>
  </div>
    </div>
  );
};

export default RecordingPage;