// ARMasksUI.jsx
import React, { useState } from 'react';

const sharedButtonClass =
  'px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 ' +
  'hover:from-teal-600 hover:to-teal-700 transition-colors duration-300';

export default function ARMasksUI({ closeEnhancementPopup, onARMasksSelect }) {
  // Sample AR mask data with categories (replace URLs with actual mask images)
  const masks = [
    { id: 1, name: 'Sunglasses', url: 'https://via.placeholder.com/40?text=😎', category: 'Funny' },
    { id: 2, name: 'Cat Ears', url: 'https://via.placeholder.com/40?text=🐱', category: 'Cute' },
    { id: 3, name: 'Mustache', url: 'https://via.placeholder.com/40?text=👨‍🦰', category: 'Funny' },
    { id: 4, name: 'Flower Crown', url: 'https://via.placeholder.com/40?text=🌸', category: 'Festive' },
    { id: 5, name: 'Alien', url: 'https://via.placeholder.com/40?text=👽', category: 'Futuristic' },
    { id: 6, name: 'Party Hat', url: 'https://via.placeholder.com/40?text=🎉', category: 'Festive' },
    { id: 7, name: 'Halo', url: 'https://via.placeholder.com/40?text=😇', category: 'Cute' },
    { id: 8, name: 'Vampire Fangs', url: 'https://via.placeholder.com/40?text=🧛', category: 'Scary' },
    // Add more if needed...
  ];

  const categories = ['All', 'Funny', 'Cute', 'Festive', 'Futuristic', 'Scary'];

  const [selectedMask, setSelectedMask] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('All');
  const [showPreview, setShowPreview] = useState(false);

  // Filter by category + search term
  const filteredMasks = masks.filter((mask) => {
    const inCategory = category === 'All' || mask.category === category;
    const matchesSearch = mask.name.toLowerCase().includes(searchTerm.toLowerCase());
    return inCategory && matchesSearch;
  });

  const handleMaskClick = (mask) => {
    setSelectedMask(mask);
    onARMasksSelect && onARMasksSelect(mask);
  };

  const handlePreview = () => {
    if (selectedMask) {
      setShowPreview(true);
    }
  };

  const handleClear = () => {
    setSelectedMask(null);
    setShowPreview(false);
  };

  return (
    <div className="space-y-4 p-2">
      <h3 className="text-md font-bold mb-2">AR Masks & Filters</h3>
      {/* Category + Search Row */}
      <div className="flex space-x-2 mb-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border rounded p-2 flex-1 text-sm"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search AR masks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded p-2 flex-1 text-sm"
        />
      </div>

      {/* Masks Grid, smaller images, scrollable if large */}
      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
        {filteredMasks.map((mask) => (
          <button
            key={mask.id}
            type="button"
            onClick={() => handleMaskClick(mask)}
            className={`border rounded p-1 text-xs transition-shadow hover:shadow-lg ${
              selectedMask && selectedMask.id === mask.id ? 'border-teal-500' : 'border-gray-300'
            }`}
            title={mask.name}
            aria-label={mask.name}
          >
            <img
              src={mask.url}
              alt={mask.name}
              className="w-full h-full object-contain"
            />
            <p className="mt-1 text-center">{mask.name}</p>
          </button>
        ))}
      </div>

      {selectedMask && (
        <div className="text-sm text-center mt-2">
          Selected: <span className="font-bold">{selectedMask.name}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-around mt-4">
        <button
          type="button"
          onClick={handlePreview}
          className={`${sharedButtonClass} text-sm`}
          aria-label="Preview Mask"
          disabled={!selectedMask}
        >
          Preview
        </button>
        <button
          type="button"
          onClick={handleClear}
          className={`${sharedButtonClass} text-sm`}
          aria-label="Clear Selection"
        >
          Clear
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && selectedMask && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999]"
          onClick={() => setShowPreview(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white p-4 rounded shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedMask.url.replace('40', '200')}
              alt={selectedMask.name}
              className="w-[200px] h-[200px] object-contain"
            />
            <p className="text-center mt-2">{selectedMask.name}</p>
            <button
              className={`${sharedButtonClass} w-full mt-2 text-sm`}
              onClick={() => setShowPreview(false)}
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* Close Entire AR Masks UI */}
      <button
        type="button"
        onClick={() => closeEnhancementPopup && closeEnhancementPopup()}
        className={`${sharedButtonClass} w-full text-sm mt-4`}
        aria-label="Close AR Masks & Filters"
      >
        Close
      </button>
    </div>
  );
}
