// src/components/GlobalCameraContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';

const CameraContext = createContext(null);

export function useCamera() {
  return useContext(CameraContext);
}

export function CameraProvider({ children }) {
  const [cameraStream, setCameraStream] = useState(null);

  useEffect(() => {
    let localStream = null;
    async function initCamera() {
      try {
        // Request both video and audio
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setCameraStream(localStream);
        console.log('GlobalCameraContext: Camera stream acquired', localStream);
      } catch (error) {
        console.error('GlobalCameraContext: Error accessing camera', error);
      }
    }
    initCamera();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        console.log('GlobalCameraContext: Camera stream stopped on unmount');
      }
    };
  }, []);

  return (
    <CameraContext.Provider value={cameraStream}>
      {children}
    </CameraContext.Provider>
  );
}
