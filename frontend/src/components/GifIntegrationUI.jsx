// EnhancedGifIntegrationUI.jsx
import React, { useState, useEffect } from 'react';

const sharedButtonClass =
  'px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 ' +
  'hover:from-teal-600 hover:to-teal-700 transition-colors duration-300';

export default function EnhancedGifIntegrationUI({ closeEnhancementPopup, onGifSelect }) {
  // Dummy GIF dataset simulating API results – replace with actual API call results later.
  const dummyGifs = [
    { id: 1, name: 'Excited', url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif', popularity: 4, category: 'Trending' },
    { id: 2, name: 'Happy', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', popularity: 5, category: 'Trending' },
    { id: 3, name: 'Surprised', url: 'https://media.giphy.com/media/3o6ZsWwU97ivnD1rWw/giphy.gif', popularity: 3, category: 'Reactions' },
    { id: 4, name: 'Laughing', url: 'https://media.giphy.com/media/l3vR85PnGsBwu1PFK/giphy.gif', popularity: 4, category: 'Memes' },
    { id: 5, name: 'Dancing', url: 'https://media.giphy.com/media/3o7TKtnuHOHHUjR38Y/giphy.gif', popularity: 5, category: 'Trending' },
    { id: 6, name: 'Cool', url: 'https://media.giphy.com/media/l0Exk8EUzSLsrErEQ/giphy.gif', popularity: 4, category: 'Reactions' },
    // Add more as needed...
  ];

  const categories = ['All', 'Trending', 'Reactions', 'Memes'];

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [gifResults, setGifResults] = useState([]);
  const [selectedGifs, setSelectedGifs] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [previewGif, setPreviewGif] = useState(null);

  // Dummy API simulation: filter dummyGifs based on search term and category.
  useEffect(() => {
    let results = dummyGifs;
    if (filterCategory !== 'All') {
      results = results.filter((gif) => gif.category === filterCategory);
    }
    if (searchTerm.trim()) {
      results = results.filter((gif) =>
        gif.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setGifResults(results);
  }, [searchTerm, filterCategory]);

  // Toggle selection of a GIF (allow multiple)
  const handleGifClick = (gif) => {
    const exists = selectedGifs.find((g) => g.id === gif.id);
    if (exists) {
      setSelectedGifs(selectedGifs.filter((g) => g.id !== gif.id));
    } else {
      setSelectedGifs([...selectedGifs, gif]);
    }
  };

  // Toggle favorite status for a GIF
  const handleFavorite = (gif, e) => {
    e.stopPropagation();
    const exists = favorites.find((g) => g.id === gif.id);
    if (exists) {
      setFavorites(favorites.filter((g) => g.id !== gif.id));
    } else {
      setFavorites([...favorites, gif]);
    }
  };

  // Set preview GIF when clicked on (could also integrate drag & drop later)
  const handlePreview = (gif) => {
    setPreviewGif(gif);
  };

  // Apply selected GIFs (pass the array of selected GIFs)
  const handleApply = () => {
    onGifSelect && onGifSelect(selectedGifs);
    closeEnhancementPopup && closeEnhancementPopup();
  };

  // Clear selection
  const handleClear = () => {
    setSelectedGifs([]);
    setPreviewGif(null);
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-md font-bold">Enhanced GIF Integration</h3>
      {/* Search & Filter */}
      <div className="flex flex-col space-y-2">
        <input
          type="text"
          placeholder="Search GIFs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded p-2 text-sm"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border rounded p-2 text-sm"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
      {/* GIF Results Grid */}
      <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
        {gifResults.map((gif) => (
          <div key={gif.id} className="relative">
            <img
              src={gif.url}
              alt={gif.name}
              className={`w-full h-auto object-contain border rounded cursor-pointer ${
                selectedGifs.find((g) => g.id === gif.id) ? 'border-teal-500' : 'border-gray-300'
              }`}
              onClick={() => handleGifClick(gif)}
              onDoubleClick={() => handlePreview(gif)}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs text-center">
              {gif.name}{' '}
              {gif.popularity
                ? '★'.repeat(gif.popularity) + '☆'.repeat(5 - gif.popularity)
                : ''}
            </div>
            <button
              className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-1 text-xs"
              onClick={(e) => handleFavorite(gif, e)}
            >
              ♥
            </button>
          </div>
        ))}
      </div>
      {/* Preview Section */}
      {previewGif && (
        <div className="mt-4 text-center">
          <h4 className="text-sm font-bold">Preview</h4>
          <img
            src={previewGif.url}
            alt={previewGif.name}
            className="w-full h-auto object-contain border rounded"
          />
        </div>
      )}
      {/* Selected GIFs Display */}
      {selectedGifs.length > 0 && (
        <div className="text-sm text-center">
          Selected GIFs: {selectedGifs.map((gif) => gif.name).join(', ')}
        </div>
      )}
      {/* Action Buttons */}
      <div className="flex justify-around mt-4">
        <button
          type="button"
          onClick={handleApply}
          className={`${sharedButtonClass} text-sm`}
          aria-label="Apply GIFs"
        >
          Apply GIFs
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
      <button
        type="button"
        onClick={() => closeEnhancementPopup && closeEnhancementPopup()}
        className={`${sharedButtonClass} w-full text-sm mt-4`}
        aria-label="Close GIF Options"
      >
        Close
      </button>
    </div>
  );
}
