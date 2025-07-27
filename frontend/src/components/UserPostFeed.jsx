// src/components/UserPostFeed.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaHeart, FaRegHeart, FaCommentAlt } from 'react-icons/fa';

/**
 * UserPostFeed
 * ------------
 * Props
 *  - posts   : array [{ id, content, date, popularity }]
 *  - theme   : 'light' | 'dark' | 'normal' | 'custom'
 *  - onLike  : (postId) => void   (optional)
 */
export default function UserPostFeed({ posts = [], theme = 'light', onLike }) {
  // local state to toggle likes visually
  const [liked, setLiked] = useState({}); // { [id]: true/false }

  const toggleLike = (id) => {
    setLiked((prev) => ({ ...prev, [id]: !prev[id] }));
    onLike && onLike(id);
  };

  const card =
    theme === 'light'
      ? 'bg-white text-gray-900'
      : theme === 'dark'
      ? 'bg-gray-800 text-gray-100'
      : 'bg-white/10 text-white backdrop-blur-sm border border-white/20';

  return (
    <div className={`${card} p-4 rounded shadow mb-6`}>
      <h3 className="text-xl font-bold mb-4">Posts</h3>

      <AnimatePresence>
        {posts.length === 0 && (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="italic text-gray-400"
          >
            No posts yet.
          </motion.p>
        )}

        {posts.map((post) => (
          <motion.div
            key={post.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mb-4 p-4 rounded bg-white/20 backdrop-blur-sm"
          >
            <p className="whitespace-pre-line mb-2">{post.content}</p>
            <div className="flex items-center text-sm">
              <button
                onClick={() => toggleLike(post.id)}
                className="flex items-center mr-4"
              >
                {liked[post.id] ? (
                  <FaHeart className="text-red-500 mr-1" />
                ) : (
                  <FaRegHeart className="mr-1" />
                )}
                {post.popularity + (liked[post.id] ? 1 : 0)}
              </button>
              <FaCommentAlt className="mr-1" />
              <span>{new Date(post.date).toLocaleString()}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
