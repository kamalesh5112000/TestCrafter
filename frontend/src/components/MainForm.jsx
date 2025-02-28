import React, { useState } from "react";
import Button from "./Button";
import Loader from "./Loader";

const MainForm = ({ url, setUrl, setUserId, onStartRecording, socket }) => {
  const [loading, setLoading] = useState(false);

  const handleLaunch = () => {
    if (!url.trim()) return alert("Enter a valid URL");

    setLoading(true);
    socket.emit("launchBrowser", { url });

    socket.on("browserLaunched", ({ userId }) => {
      setUserId(userId);
      setLoading(false);
      onStartRecording();
    });

    socket.on("launchError", (error) => {
      console.error("Launch Error:", error);
      setLoading(false);
    });
  };

  return (
    <div className="flex flex-col items-center bg-white p-6 shadow-lg rounded-lg">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter site URL"
        className="border p-2 rounded w-64 mb-2"
      />
      <button 
        onClick={handleLaunch} 
        className="bg-blue-500 text-white p-2 rounded w-32"
        disabled={loading}
      >
        {loading ? "Launching..." : "Launch"}
      </button>
    </div>
  );
};

export default MainForm;
