// MoreEnhancementsUI.jsx
import React, { useState } from 'react';

const sharedButtonClass =
  'px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 ' +
  'hover:from-teal-600 hover:to-teal-700 transition-colors duration-300';

export default function MoreEnhancementsUI({
  setSelectedEnhancement,
  closeEnhancementPopup,
  mainEnhancements = [],
  setMainEnhancements = () => {},
  extraEnhancements = [],
}) {
  // State to toggle the customize panel (drag & drop main enhancements)
  const [showCustomize, setShowCustomize] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // All possible main enhancements (the ones originally in the main row)
  const allMainEnhancements = [
    'Background Music',
    'Hashtag Suggestions',
    'Animated Text Overlays',
    'Color Filters',
    'Animated Transitions',
    'Video Trimming',
    'Auto-Subtitles',
  ];

  // Handle drag events for reordering main enhancements
  const handleDragStart = (index, e) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index, e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (index, e) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    const updated = [...mainEnhancements];
    const [removed] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, removed);
    setMainEnhancements(updated);
    setDraggedIndex(null);
  };

  return (
    <div>
      <h3 className="text-md font-bold mb-2">More Options</h3>
      <p className="text-sm mb-2">
        Choose from the advanced enhancements not in the main row:
      </p>
      {/* Extra Enhancements Grid (4 columns per row) */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {extraEnhancements.map((enh) => (
          <button
            key={enh}
            type="button"
            onClick={() => setSelectedEnhancement(enh)}
            className="flex flex-col items-center justify-center p-2 border rounded hover:bg-teal-600 transition-colors"
            title={enh}
            aria-label={enh}
          >
            {/* For now, using a placeholder emoji icon; update as needed */}
            <span className="text-2xl">🔹</span>
            <span className="text-xs mt-1">{enh}</span>
          </button>
        ))}
      </div>

      {/* Customize Main Enhancements Section */}
      <button
        type="button"
        onClick={() => setShowCustomize(!showCustomize)}
        className={`${sharedButtonClass} w-full text-sm mb-4`}
      >
        {showCustomize ? 'Hide Customize Main Enhancements' : 'Customize Main Enhancements'}
      </button>
      {showCustomize && (
        <div className="mt-3 border rounded p-2 mb-4">
          <h4 className="text-sm font-bold mb-2">
            Drag and drop to reorder main enhancements:
          </h4>
          <div className="flex flex-wrap gap-2">
            {allMainEnhancements.map((enh, index) => (
              <div
                key={enh}
                draggable
                onDragStart={(e) => handleDragStart(index, e)}
                onDragOver={(e) => handleDragOver(index, e)}
                onDrop={(e) => handleDrop(index, e)}
                className={`px-3 py-1 border rounded cursor-move ${
                  mainEnhancements.includes(enh)
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-200 text-black'
                }`}
              >
                {enh}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => closeEnhancementPopup?.()}
        className="mt-4 px-4 py-2 rounded text-white bg-red-600 hover:bg-red-700 transition-colors duration-300 w-full text-sm"
        aria-label="Close More Options"
      >
        Close
      </button>
    </div>
  );
}
