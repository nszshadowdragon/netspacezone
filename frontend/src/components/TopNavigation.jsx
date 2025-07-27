import React from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeSelector from './themeSelector';

export default function TopNavigation({ showTrendingContent, onSwitchContent }) {
  const navigate = useNavigate();

  // Removed the NSZ Live button and any create story button
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-row items-center justify-between px-2 mt-20">
      <div className="flex space-x-2">
        <button
          onClick={() => onSwitchContent('trending')}
          className="px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 transition-colors duration-300 title-box"
          aria-label="Switch to Trending"
          title="Switch to Trending"
        >
          {showTrendingContent ? 'Go to Trending' : 'Switch to Trending'}
        </button>
        <button
          onClick={() => onSwitchContent('stories')}
          className="px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 transition-colors duration-300 title-box"
          aria-label="Switch to Stories"
          title="Switch to Stories"
        >
          {!showTrendingContent ? 'Go to Stories' : 'Switch to Stories'}
        </button>
      </div>
      <div className="flex items-center space-x-2">
        {/* NSZ Live and Create Story buttons removed */}
        <div className="fixed top-20 right-4 z-10">
          <ThemeSelector aria-label="Toggle theme" title="Toggle theme" />
        </div>
      </div>
    </div>
  );
}
