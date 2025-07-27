// HashtagUI.jsx
import React from 'react';

const sharedButtonClass =
  'px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 ' +
  'hover:from-teal-600 hover:to-teal-700 transition-colors duration-300';

export default function HashtagUI({
  searchQuery,
  setSearchQuery,
  filteredHashtags,
  selectedHashtags,
  setSelectedHashtags,
  closeEnhancementPopup,
}) {
  // Force them to be arrays
  const safeFilteredHashtags = Array.isArray(filteredHashtags) ? filteredHashtags : [];
  const safeSelectedHashtags = Array.isArray(selectedHashtags) ? selectedHashtags : [];

  const handleHashtagClick = (hashtag) => {
    try {
      if (safeSelectedHashtags.includes(hashtag)) {
        setSelectedHashtags(safeSelectedHashtags.filter((h) => h !== hashtag));
      } else {
        if (hashtag.length <= 20) {
          setSelectedHashtags([...safeSelectedHashtags, hashtag]);
        }
      }
    } catch (error) {
      console.error('Error handling hashtag click:', error);
    }
  };

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <h3 className="text-md font-bold mb-2">Hashtag Suggestions</h3>
      <input
        type="text"
        placeholder="Type a hashtag..."
        value={searchQuery || ''}
        onChange={(e) => {
          try {
            setSearchQuery?.(e.target.value);
          } catch (err) {
            console.error('Error updating hashtag search:', err);
          }
        }}
        className="w-full p-2 border rounded mb-2"
      />

      {/* Only map if safeFilteredHashtags has length */}
      {safeFilteredHashtags.length > 0 && (
        <ul className="border rounded p-2 mb-2">
          {safeFilteredHashtags.map((item) => {
            const starCount = Math.min(Math.floor(item.popularity / 30), 5);
            return (
              <li
                key={item.tag}
                className="cursor-pointer p-1 hover:bg-gray-100"
                onClick={() => {
                  try {
                    handleHashtagClick(item.tag);
                  } catch (error) {
                    console.error('Error in hashtag onClick:', error);
                  }
                }}
              >
                {item.tag}{' '}
                {starCount > 0 && (
                  <span className="text-yellow-500">
                    {'★'.repeat(starCount)}
                    {'☆'.repeat(5 - starCount)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {safeSelectedHashtags.length > 0 && (
        <div className="mb-2">
          <h4 className="font-bold mb-1">Selected Hashtags:</h4>
          <div className="flex flex-wrap gap-2">
            {safeSelectedHashtags.map((tag) => (
              <span key={tag} className="px-2 py-1 bg-teal-500 text-white rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          try {
            closeEnhancementPopup?.();
          } catch (error) {
            console.error('Error closing hashtag options:', error);
          }
        }}
        className={sharedButtonClass}
        aria-label="Close Hashtag Options"
      >
        Close
      </button>
    </form>
  );
}
