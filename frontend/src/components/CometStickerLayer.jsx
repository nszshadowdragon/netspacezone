import React from 'react';

const CometStickerLayer = ({ stickers, onUpdatePosition, onDelete }) => {
  const handleDrag = (e, sticker) => {
    const newX = e.clientX - sticker.offsetX;
    const newY = e.clientY - sticker.offsetY;
    onUpdatePosition(sticker.id, newX, newY);
  };

  const handleTripleClick = (id) => {
    let count = 0;
    return () => {
      count++;
      if (count === 3) {
        onDelete(id);
        count = 0;
      }
      setTimeout(() => (count = 0), 500);
    };
  };

  return (
    <div className="absolute top-0 left-0 w-full h-full z-30 pointer-events-none">
      {stickers.map((sticker) => (
        <img
          key={sticker.id}
          src={sticker.url}
          alt={sticker.name}
          className="absolute w-20 h-20 object-contain pointer-events-auto cursor-move"
          style={{
            top: sticker.y,
            left: sticker.x,
            transform: `rotate(${sticker.rotation || 0}deg)`
          }}
          draggable
          onDragEnd={(e) => handleDrag(e, sticker)}
          onClick={handleTripleClick(sticker.id)}
        />
      ))}
    </div>
  );
};

export default CometStickerLayer;
