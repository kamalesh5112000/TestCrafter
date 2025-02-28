import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import MainForm from "./components/MainForm";
import RecordingPage from "./components/RecordingPage";

const socket = io("http://localhost:5000", { autoConnect: false });

const App = () => {
  const [url, setUrl] = useState("");
  const [userId, setUserId] = useState(null);
  const [isRecordingPageOpen, setIsRecordingPageOpen] = useState(false);

  useEffect(() => {
    socket.connect();
    return () => socket.disconnect();
  }, []);

  return (
    <div className="h-screen flex justify-center items-center">
      {!isRecordingPageOpen ? (
        <MainForm 
          url={url} 
          setUrl={setUrl} 
          setUserId={setUserId} 
          onStartRecording={() => setIsRecordingPageOpen(true)} 
          socket={socket} 
        />
      ) : (
        <RecordingPage 
          url={url} 
          userId={userId} 
          onClose={() => setIsRecordingPageOpen(false)} 
          socket={socket} 
        />
      )}
    </div>
  );
};

export default App;
