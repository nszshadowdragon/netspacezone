// src/components/PhotoGallery.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * PhotoGallery
 * ------------
 * Props
 *  - images   : array of { id, src, alt }
 *  - theme    : 'light' | 'dark' | 'normal' | 'custom'
 */
export default function PhotoGallery({ images = [], theme = 'light' }) {
  const [active, setActive] = useState(null); // id of image in modal

  const card =
    theme === 'light'
      ? 'bg-white text-gray-900'
      : theme === 'dark'
      ? 'bg-gray-800 text-gray-100'
      : 'bg-white/10 text-white backdrop-blur-sm border border-white/20';

  /* fallback demo images */
  const demo = [
    '/images/demo1.jpg',
    '/images/demo2.jpg',
    '/images/demo3.jpg',
  ].map((src, i) => ({ id: i, src, alt: `demo ${i}` }));

  const pics = images.length ? images : demo;

  return (
    <div className={`${card} p-4 rounded shadow mb-6`}>
      <h3 className="text-xl font-bold mb-4">Photo Gallery</h3>

      {/* Masonry-like grid */}
      <div className="columns-2 md:columns-3 gap-2">
        {pics.map((img) => (
          <motion.img
            key={img.id}
            src={img.src}
            alt={img.alt || ''}
            className="mb-2 rounded-lg w-full cursor-pointer hover:opacity-80"
            layout="position"
            onClick={() => setActive(img.id)}
            whileHover={{ scale: 1.02 }}
          />
        ))}
      </div>

      {/* Modal viewer */}
      <AnimatePresence>
        {active !== null && (
          <motion.div
            key="modal"
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
          >
            <motion.img
              src={pics.find((p) => p.id === active).src}
              alt=""
              className="max-h-[90vh] max-w-[90vw] rounded-lg"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
