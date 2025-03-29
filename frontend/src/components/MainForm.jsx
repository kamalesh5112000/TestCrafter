import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
const MainForm = ({ url, setUrl, name, setName, sessionName, setSessionName, setUserId, onFeaturesExtracted, socket }) => {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const navigate = useNavigate();


  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const checkSessionExists = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/sessions/check?sessionName=${sessionName}`);
      const data = await response.json();
      return data.exists; // Returns true if session exists
    } catch (error) {
      console.error("Error checking session:", error);
      return false;
    }
  };

  const handleLaunch = async () => {
    if (!name.trim()) return alert("Enter your name");
    if (!sessionName.trim()) return alert("Enter a unique session name");
    if (!url.trim()) return alert("Enter a valid URL");
    if (!file) return alert("Please upload a requirement document");

    setLoading(true);

    // Check if sessionName already exists
    // const sessionExists = await checkSessionExists();
    // if (sessionExists) {
    //   alert("Session name already exists. Choose a different name.");
    //   setLoading(false);
    //   return;
    // }

    const formData = new FormData();
    formData.append("url", url);
    formData.append("file", file);


    try {
      const response = await fetch("http://localhost:5000/api/rag/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      console.log("Extracted Features:", result.features);
      onFeaturesExtracted(result.features);

      socket.emit("launchBrowser", { url, sessionName });

      socket.on("browserLaunched", ({ userId }) => {
        setUserId(userId);
        setLoading(false);
        navigate("/recording");
      });

      socket.on("launchError", (error) => {
        console.error("Launch Error:", error);
        setLoading(false);
      });
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to upload file.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center bg-white p-6 shadow-lg rounded-lg">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter Your Name"
        className="border p-2 rounded w-64 mb-2"
      />
      
      <input
        type="text"
        value={sessionName}
        onChange={(e) => setSessionName(e.target.value)}
        placeholder="Enter Unique Session Name"
        className="border p-2 rounded w-64 mb-2"
      />

      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter Site URL"
        className="border p-2 rounded w-64 mb-2"
      />
      
      <input
        type="file"
        accept=".txt,.pdf"
        onChange={handleFileChange}
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
