// src/components/CoverPhoto.jsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import defaultBanner from "../assets/CosmosBanner.png"; // adjust name if needed

/**
 * CoverPhoto
 * Props:
 *  - src       : existing banner URL
 *  - editable  : show “Change cover” button (default true)
 *  - onChange  : callback(file) when user picks a new image
 */
export default function CoverPhoto({
  src,
  editable = true,
  onChange = () => {},
}) {
  const [preview, setPreview] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    onChange(file);
  };

  return (
    <div className="relative w-full h-60 overflow-hidden rounded-lg mb-6">
      <motion.img
        key={preview || src || defaultBanner}
        src={preview || src || defaultBanner}
        alt="Cover"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full h-full object-cover"
      />

      {editable && (
        <label className="absolute top-3 right-3 bg-black/50 text-white text-sm px-3 py-1 rounded cursor-pointer hover:bg-black/70">
          Change cover
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}
