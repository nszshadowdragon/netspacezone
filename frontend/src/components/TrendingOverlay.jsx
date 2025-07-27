import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TrendingOverlay({ expanded, onClose }) {
  return (
    <AnimatePresence>
      {expanded && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-
50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-xl w-full relative"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="title-box text-xl font-bold mb-2 text-black">
              {expanded?.user}
            </h3>
            <p className="text-xs text-black mb-4">{expanded?.date?.toString()}</p>
            <p className="mb-4 text-black">{expanded?.content}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 
transition-colors"
              aria-label="Close trending overlay"
              title="Close"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
