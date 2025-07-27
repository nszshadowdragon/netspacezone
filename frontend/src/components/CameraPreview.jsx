// CameraPreview.jsx
import React, { useRef, useEffect } from 'react';
import { useCamera } from './GlobalCameraContext';

export default function CameraPreview({ style }) {
  const videoRef = useRef(null);
  const cameraStream = useCamera();

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      // On some devices, explicitly calling play() may be required.
      videoRef.current.play().catch((err) => {
        console.error('Error playing video:', err);
      });
      console.log('CameraPreview: displaying global camera stream');
    }
  }, [cameraStream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }}
    />
  );
}
