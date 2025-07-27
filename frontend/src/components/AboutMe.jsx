// src/components/AboutMe.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AboutMe
 * -------
 * Props
 *  - bio        : string  → text to display
 *  - editable   : bool    → show Edit button if true (default: true)
 *  - onSave     : func    → called with new text after user saves
 *  - theme      : string  → 'light' | 'dark' | 'normal' | 'custom'
 */
export default function AboutMe({
  bio = '',
  editable = true,
  onSave = () => {},
  theme = 'light',
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bio);

  const cardClasses =
    theme === 'light'
      ? 'bg-white text-gray-900'
      : theme === 'dark'
      ? 'bg-gray-800 text-gray-100'
      : 'bg-white/10 text-white backdrop-blur-sm border border-white/20';

  const save = () => {
    onSave(draft.trim());
    setEditing(false);
  };

  return (
    <div className={`${cardClasses} p-4 rounded shadow mb-6`}>
      <h3 className="text-xl font-bold mb-2">About Me</h3>

      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="w-full p-2 rounded bg-white/80 text-gray-900 mb-3"
              placeholder="Tell us something about yourself..."
            />
            <button
              onClick={save}
              className="mr-2 px-3 py-1 bg-green-600 text-white rounded"
            >
              Save
            </button>
            <button
              onClick={() => {
                setDraft(bio);
                setEditing(false);
              }}
              className="px-3 py-1 bg-gray-500 text-white rounded"
            >
              Cancel
            </button>
          </motion.div>
        ) : (
          <motion.p
            key="display"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="whitespace-pre-line"
          >
            {bio || (
              <span className="italic text-gray-400">
                No bio yet. Click edit to add one!
              </span>
            )}
          </motion.p>
        )}
      </AnimatePresence>

      {editable && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="mt-3 px-3 py-1 bg-blue-600 text-white rounded"
        >
          Edit
        </button>
      )}
    </div>
  );
}
