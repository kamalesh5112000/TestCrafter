import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { io } from "socket.io-client";
import MainForm from "./components/MainForm";
import RecordingPage from "./components/RecordingPage";
import ViewTestCases from "./components/ViewTestCases";

const socket = io("http://localhost:5000", { autoConnect: false });

const App = () => {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [userId, setUserId] = useState(null);
  const [extractedFeatures, setExtractedFeatures] = useState([]);
  const [sessionName, setSessionName] = useState("");

  useEffect(() => {
    socket.connect();
    return () => socket.disconnect();
  }, []);

  const handleFeaturesExtracted = (features) => {
    setExtractedFeatures(features);
  };

  return (
    <Router>
      <div className="h-screen flex justify-center items-center">
        <Routes>
          <Route
            path="/"
            element={
              <MainForm 
                url={url} 
                setUrl={setUrl} 
                name={name} 
                setName={setName} 
                setUserId={setUserId} 
                sessionName={sessionName} 
                setSessionName={setSessionName} 
                socket={socket} 
                onFeaturesExtracted={handleFeaturesExtracted} 
              />
            }
          />
          <Route
            path="/recording"
            element={
              <RecordingPage 
                url={url} 
                name={name} 
                sessionName={sessionName} 
                userId={userId} 
                socket={socket} 
                extractedFeatures={extractedFeatures} 
              />
            }
          />
          <Route path="/test-cases" element={<ViewTestCases sessionName={sessionName} />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
