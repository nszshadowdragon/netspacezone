// AnimatedTextOverlayUI.jsx
import React, { useState, useEffect } from 'react';

const sharedButtonClass =
  'px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 ' +
  'hover:from-teal-600 hover:to-teal-700 transition-colors duration-300';

export default function AnimatedTextOverlayUI({
  animatedText,
  setAnimatedText,
  closeEnhancementPopup,
}) {
  // Local states for text overlay properties with initial values from animatedText or defaults.
  const [localText, setLocalText] = useState(animatedText.text || '');
  const [localColor, setLocalColor] = useState(animatedText.color || '#ffffff');
  const [localFontSize, setLocalFontSize] = useState(animatedText.fontSize || 24);
  const [localRotation, setLocalRotation] = useState(animatedText.rotation || 0);
  const [localTextShadow, setLocalTextShadow] = useState(animatedText.textShadow || false);
  const [localTextAlign, setLocalTextAlign] = useState(animatedText.textAlign || 'center');
  const [localFontFamily, setLocalFontFamily] = useState(
    animatedText.fontFamily || 'Arial, sans-serif'
  );

  // Update parent state whenever any overlay property changes.
  useEffect(() => {
    setAnimatedText({
      text: localText,
      color: localColor,
      fontSize: localFontSize,
      rotation: localRotation,
      textShadow: localTextShadow,
      textAlign: localTextAlign,
      fontFamily: localFontFamily,
    });
  }, [
    localText,
    localColor,
    localFontSize,
    localRotation,
    localTextShadow,
    localTextAlign,
    localFontFamily,
    setAnimatedText,
  ]);

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
      <h3 className="text-md font-bold mb-2">Animated Text Overlay</h3>

      <div>
        <label className="block text-sm font-medium">Overlay Text:</label>
        <input
          type="text"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="Enter your overlay text..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Text Color:</label>
        <input
          type="color"
          value={localColor}
          onChange={(e) => setLocalColor(e.target.value)}
          className="w-full h-10 p-1 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">
          Font Size: {localFontSize}px
        </label>
        <input
          type="range"
          min="10"
          max="72"
          value={localFontSize}
          onChange={(e) => setLocalFontSize(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">
          Rotation: {localRotation}°
        </label>
        <input
          type="range"
          min="-45"
          max="45"
          value={localRotation}
          onChange={(e) => setLocalRotation(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Text Alignment:</label>
        <select
          value={localTextAlign}
          onChange={(e) => setLocalTextAlign(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Font Family:</label>
        <select
          value={localFontFamily}
          onChange={(e) => setLocalFontFamily(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="Arial, sans-serif">Arial</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Courier New', monospace">Courier New</option>
          <option value="'Georgia', serif">Georgia</option>
          <option value="'Roboto', sans-serif">Roboto</option>
        </select>
      </div>

      <div className="flex items-center">
        <label className="block text-sm font-medium mr-2">Text Shadow:</label>
        <input
          type="checkbox"
          checked={localTextShadow}
          onChange={(e) => setLocalTextShadow(e.target.checked)}
        />
      </div>

      <button
        type="button"
        onClick={() => closeEnhancementPopup?.()}
        className={`${sharedButtonClass} w-full text-sm`}
        aria-label="Close Animated Text Overlay Options"
      >
        Close
      </button>
    </form>
  );
}
