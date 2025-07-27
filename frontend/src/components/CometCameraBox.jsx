// CometCameraBox.jsx
import React, { useState, useRef } from 'react';
import StickerLibraryUI from './StickerLibraryUI';

export default function CometCameraBox() {
  const [stickersInCamera, setStickersInCamera] = useState([]);
  const cameraRef = useRef(null);

  // This function is called by the StickerLibrary
  // when the user pointer-down on a sticker.
  const handleStickerDragStart = (sticker) => {
    // We'll create a new "active" sticker in the camera box, 
    // placed at the pointer location.
    const newSticker = {
      ...sticker,
      x: sticker.offsetX - 40, // center offset if it's 80x80
      y: sticker.offsetY - 40,
    };

    // Add it to the camera area
    setStickersInCamera((prev) => [...prev, newSticker]);

    // Listen to pointermove/pointerup to update its position
    const startX = sticker.offsetX;
    const startY = sticker.offsetY;
    const stickerId = Date.now() + '-' + sticker.id;

    const handlePointerMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setStickersInCamera((prev) =>
        prev.map((s) =>
          s === newSticker
            ? { ...s, x: s.x + dx, y: s.y + dy }
            : s
        )
      );
      // Also update startX, startY for continuous movement
      sticker.offsetX = ev.clientX;
      sticker.offsetY = ev.clientY;
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div>
      {/* Camera Box */}
      <div
        ref={cameraRef}
        style={{
          position: 'relative',
          width: '400px',
          height: '300px',
          backgroundColor: '#222',
          margin: '0 auto',
          overflow: 'hidden',
        }}
      >
        {stickersInCamera.map((sticker, idx) => (
          <img
            key={idx}
            src={sticker.url}
            alt={sticker.name}
            style={{
              position: 'absolute',
              left: sticker.x,
              top: sticker.y,
              width: '80px',
              height: '80px',
              userSelect: 'none',
              pointerEvents: 'none', // optional if you don't want re-drag
            }}
          />
        ))}
      </div>

      {/* Below camera box, place the library UI */}
      <StickerLibraryUI onStickerDragStart={handleStickerDragStart} />
    </div>
  );
}
