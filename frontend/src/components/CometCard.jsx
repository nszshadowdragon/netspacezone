import React from 'react';

export default function CometCard({ Comet }) {
  return (
    <div className="relative rounded overflow-hidden shadow-lg">
      <img src={Comet.imageUrl} alt={Comet.title} className="w-full h-48 object-cover" />
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
        <p className="text-white text-sm">{Comet.title}</p>
      </div>
    </div>
  );
}
