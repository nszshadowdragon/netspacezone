import React from 'react';

const stickers = [
  {
    id: 1,
    url: 'https://via.placeholder.com/80x80.png?text=Sticker+1',
    name: 'Sticker 1',
  },
  {
    id: 2,
    url: 'https://via.placeholder.com/80x80.png?text=Sticker+2',
    name: 'Sticker 2',
  },
  {
    id: 3,
    url: 'https://via.placeholder.com/80x80.png?text=Sticker+3',
    name: 'Sticker 3',
  },
  {
    id: 4,
    url: 'https://via.placeholder.com/80x80.png?text=Sticker+4',
    name: 'Sticker 4',
  },
  {
    id: 5,
    url: 'https://via.placeholder.com/80x80.png?text=Sticker+5',
    name: 'Sticker 5',
  },
  {
    id: 6,
    url: 'https://via.placeholder.com/80x80.png?text=Sticker+6',
    name: 'Sticker 6',
  },
];

const StickerLibraryUI = ({ onStickerDragStart, closeEnhancementPopup }) => {
  return (
    <div className="flex flex-col space-y-2 h-full">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">Sticker Library</h2>
        <button
          className="px-2 py-1 bg-red-500 text-white text-xs rounded"
          onClick={closeEnhancementPopup}
        >
          Close
        </button>
      </div>
      <div className="flex flex-col space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '500px' }}>
        {stickers.map((sticker) => (
          <div
            key={sticker.id}
            draggable
            onDragStart={(e) => {
              const offsetX = e.nativeEvent.offsetX;
              const offsetY = e.nativeEvent.offsetY;
              onStickerDragStart({ ...sticker, offsetX, offsetY });
            }}
            className="flex items-center p-1 rounded border border-gray-200 bg-white shadow hover:shadow-md cursor-pointer"
          >
            <img src={sticker.url} alt={sticker.name} className="w-10 h-10 mr-2" />
            <span className="text-sm text-black">{sticker.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StickerLibraryUI;
