// ColorFiltersUI.jsx
import React, { useState } from 'react';

const sharedButtonClass =
  'px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 ' +
  'hover:from-teal-600 hover:to-teal-700 transition-colors duration-300';

export default function ColorFiltersUI({
  selectedFilter,
  setSelectedFilter,
  closeEnhancementPopup,
}) {
  // Preset filters
  const presets = [
    { name: 'None', value: '' },
    { name: 'Sepia', value: 'sepia(1)' },
    { name: 'Grayscale', value: 'grayscale(1)' },
    { name: 'Invert', value: 'invert(1)' },
    { name: 'Bright', value: 'brightness(1.5)' },
    { name: 'Contrast', value: 'contrast(1.5)' },
  ];

  // Sliders for custom HSL modifications
  const [hue, setHue] = useState(0);          // range: 0–360
  const [saturation, setSaturation] = useState(100); // range: 0–200 (100 = normal)
  const [brightness, setBrightness] = useState(100); // range: 0–200 (100 = normal)

  // A separate custom color tint
  const [customColor, setCustomColor] = useState('#ffffff');

  // Whenever user changes the custom sliders, we build a combined filter string
  const buildCustomFilter = () => {
    // hue-rotate(Xdeg) saturate(Y%) brightness(Z%)
    // plus optional tint from customColor
    // If you want a half-translucent overlay, you could do: drop-shadow(0 0 0 color) + opacity(0.7)
    const h = `hue-rotate(${hue}deg)`;
    const s = `saturate(${saturation / 100})`;
    const b = `brightness(${brightness / 100})`;
    // For a simple approach, combine them in one filter string:
    return `${h} ${s} ${b}`;
  };

  // On slider change, update the filter
  const handleSliderChange = () => {
    const customFilter = buildCustomFilter();
    // If you also want to incorporate the color tint, you might do:
    // `customFilter + " opacity(0.5) drop-shadow(0 0 0 " + customColor + ")"`
    // For now, let's just combine them with a subtle tint:
    const colorTint = `drop-shadow(0 0 0 ${customColor}) opacity(0.8)`;
    const final = `${customFilter} ${colorTint}`;
    setSelectedFilter(final);
  };

  // Handler for a preset
  const handlePresetClick = (filterValue) => {
    setSelectedFilter(filterValue);
    console.log(`Preset filter selected: ${filterValue}`);
  };

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <h3 className="text-md font-bold mb-2">Color Filters</h3>

      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2 mb-2">
        {presets.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => handlePresetClick(preset.value)}
            className={`px-3 py-1 rounded-full border ${
              selectedFilter === preset.value ? 'bg-teal-500 text-white' : 'bg-gray-200 text-black'
            } hover:bg-teal-600 transition-colors`}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Custom Sliders */}
      <div className="mb-2">
        <label className="block text-sm font-medium mb-1">Hue: {hue}°</label>
        <input
          type="range"
          min="0"
          max="360"
          value={hue}
          onChange={(e) => {
            setHue(Number(e.target.value));
            handleSliderChange();
          }}
          className="w-full"
        />
      </div>
      <div className="mb-2">
        <label className="block text-sm font-medium mb-1">Saturation: {saturation}%</label>
        <input
          type="range"
          min="0"
          max="200"
          value={saturation}
          onChange={(e) => {
            setSaturation(Number(e.target.value));
            handleSliderChange();
          }}
          className="w-full"
        />
      </div>
      <div className="mb-2">
        <label className="block text-sm font-medium mb-1">Brightness: {brightness}%</label>
        <input
          type="range"
          min="0"
          max="200"
          value={brightness}
          onChange={(e) => {
            setBrightness(Number(e.target.value));
            handleSliderChange();
          }}
          className="w-full"
        />
      </div>

      {/* Custom Tint Color */}
      <div className="mb-2">
        <label className="block text-sm font-medium mb-1">Tint Color</label>
        <input
          type="color"
          value={customColor}
          onChange={(e) => {
            setCustomColor(e.target.value);
            handleSliderChange();
          }}
          className="w-full h-10 p-1 border rounded"
        />
      </div>

      <button
        type="button"
        onClick={() => {
          closeEnhancementPopup?.();
        }}
        className={`${sharedButtonClass} w-full text-sm`}
        aria-label="Close Color Filters"
      >
        Close
      </button>
    </form>
  );
}
