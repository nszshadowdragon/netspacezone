// AnimatedTransitionsUI.jsx
import React, { useState } from 'react';

const sharedButtonClass =
  'px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 ' +
  'hover:from-teal-600 hover:to-teal-700 transition-colors duration-300';

/**
 * AnimatedTransitionsUI
 *
 * Allows the user to select from a list of preset transition styles
 * (fade, slide, scale, etc.) or choose a custom approach with custom duration/easing.
 *
 * Props:
 * - selectedTransition: The current transition style (string).
 * - setSelectedTransition: Function to update the transition style.
 * - closeEnhancementPopup: Function to close this popup.
 */
export default function AnimatedTransitionsUI({
  selectedTransition,
  setSelectedTransition,
  closeEnhancementPopup,
}) {
  // Example transition presets
  const transitionPresets = [
    { name: 'Fade', value: 'fade' },
    { name: 'Slide', value: 'slide' },
    { name: 'Scale Rotate', value: 'scaleRotate' },
    { name: 'Flip', value: 'flip' },
    { name: 'Custom', value: 'custom' },
  ];

  // If the user picks "Custom," they can define advanced parameters here
  const [customDuration, setCustomDuration] = useState(0.8);
  const [customEasing, setCustomEasing] = useState('ease-in-out');

  // If you want to store custom parameters in the parent's state, you can do so
  // by building a string or object, e.g. "custom(duration=0.8,easing=linear)"
  // For simplicity, we’ll just store the preset name and let the parent interpret it.
  const handleSelectPreset = (value) => {
    setSelectedTransition(value);
  };

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
      <h3 className="text-md font-bold mb-2">Animated Transitions</h3>
      <div>
        <label className="block text-sm font-medium mb-1">Select a Preset:</label>
        <div className="flex flex-wrap gap-2">
          {transitionPresets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handleSelectPreset(preset.value)}
              className={`px-3 py-1 rounded-full border ${
                selectedTransition === preset.value
                  ? 'bg-teal-500 text-white'
                  : 'bg-gray-200 text-black'
              } hover:bg-teal-600 transition-colors`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {selectedTransition === 'custom' && (
        <div className="border rounded p-2 mt-2 space-y-2">
          <div>
            <label className="block text-sm font-medium mb-1">
              Duration (seconds): {customDuration}
            </label>
            <input
              type="range"
              min="0.2"
              max="2.0"
              step="0.1"
              value={customDuration}
              onChange={(e) => setCustomDuration(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Easing:</label>
            <select
              value={customEasing}
              onChange={(e) => setCustomEasing(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="ease">ease</option>
              <option value="linear">linear</option>
              <option value="ease-in">ease-in</option>
              <option value="ease-out">ease-out</option>
              <option value="ease-in-out">ease-in-out</option>
              <option value="cubic-bezier(0.4, 0, 0.2, 1)">
                cubic-bezier(0.4, 0, 0.2, 1)
              </option>
            </select>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => closeEnhancementPopup?.()}
        className={`${sharedButtonClass} w-full text-sm`}
        aria-label="Close Animated Transitions"
      >
        Close
      </button>
    </form>
  );
}
