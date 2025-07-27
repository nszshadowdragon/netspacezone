// src/components/PinnedPosts.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';

/**
 * PinnedPosts
 * -----------
 * Props
 *  - posts    : array [{ id, content, date }]
 *  - theme    : 'light' | 'dark' | 'normal' | 'custom'
 *  - onUnpin  : (postId) => void   (optional)
 */
export default function PinnedPosts({ posts = [], theme = 'light', onUnpin }) {
  const card =
    theme === 'light'
      ? 'bg-white text-gray-900'
      : theme === 'dark'
      ? 'bg-gray-800 text-gray-100'
      : 'bg-white/10 text-white backdrop-blur-sm border border-white/20';

  return (
    <div className={`${card} p-4 rounded shadow mb-6`}>
      <h3 className="text-xl font-bold mb-4">Pinned Posts</h3>

      <AnimatePresence initial={false}>
        {posts.length === 0 && (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="italic text-gray-400"
          >
            No pinned posts.
          </motion.p>
        )}

        {posts.map((post) => (
          <motion.div
            key={post.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="relative mb-4 p-4 rounded bg-white/20 backdrop-blur-sm"
          >
            {onUnpin && (
              <button
                onClick={() => onUnpin(post.id)}
                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                aria-label="Unpin post"
              >
                <FaTimes />
              </button>
            )}
            <p className="whitespace-pre-line mb-1">{post.content}</p>
            <span className="text-xs opacity-70">
              {new Date(post.date).toLocaleString()}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
