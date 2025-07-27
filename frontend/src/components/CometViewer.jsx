import React, { useState } from 'react';

export default function CometViewer({ stories }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? stories.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === stories.length - 1 ? 0 : prev + 1));
  };

  if (!stories || stories.length === 0) return <div>No stories available.</div>;

  const currentComet = stories[currentIndex];

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="overflow-hidden rounded shadow-lg">
        <img src={currentComet.imageUrl} alt={currentComet.title} className="w-full h-64 
object-cover" />
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
          <p className="text-white text-lg">{currentComet.title}</p>
        </div>
      </div>
      <div className="flex justify-between mt-2">
        <button onClick={handlePrev} className="bg-gray-300 hover:bg-gray-400 text-gray-
800 py-1 px-3 rounded">
          Prev
        </button>
        <button onClick={handleNext} className="bg-gray-300 hover:bg-gray-400 text-gray-
800 py-1 px-3 rounded">
          Next
        </button>
      </div>
    </div>
  );
}
