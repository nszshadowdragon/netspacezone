import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import debounce from 'lodash.debounce';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import PostList from './PostList'; // Imported status feed component
import { useTheme } from '../context/ThemeContext';

const sharedButtonClass =
  'px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 ' +
  'hover:from-teal-600 hover:to-teal-700 transition-colors duration-300';

// ----------------------
// CreateStatusModal Component
// ----------------------
function CreateStatusModal({ show, onCancel, onCommit, currentMode, onSwitchMode }) {
  const [postType, setPostType] = useState(currentMode); // "post" or "story"
  const [newPostContent, setNewPostContent] = useState('');
  const [advancedVisible, setAdvancedVisible] = useState(false);
  const [statusAdvanced, setStatusAdvanced] = useState({});

  // Handlers for advanced options
  const handleTagPeopleChange = (e) => {
    setStatusAdvanced({ ...statusAdvanced, tagPeople: e.target.value });
  };
  const handleTagLocationChange = (e) => {
    setStatusAdvanced({ ...statusAdvanced, tagLocation: e.target.value });
  };
  const handleAttachmentChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setStatusAdvanced({ ...statusAdvanced, attachment: file.name });
    }
  };
  const handleScheduleChange = (date) => {
    setStatusAdvanced({ ...statusAdvanced, schedulePost: date });
  };
  const handleExpirationChange = (date) => {
    setStatusAdvanced({ ...statusAdvanced, postExpiration: date });
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className="bg-white rounded-lg max-w-xl w-full flex flex-col"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="flex justify-center space-x-4 mb-4">
                <button
                  onClick={() => { setPostType('post'); onSwitchMode('post'); }}
                  className={sharedButtonClass}
                  style={postType === 'post' ? { backgroundColor: '#000', color: '#fff' } : { backgroundColor: 'teal', color: '#fff' }}
                  aria-label="Select status"
                  title="Status"
                >
                  Status
                </button>
                <button
                  onClick={() => { setPostType('story'); onSwitchMode('story'); }}
                  className={sharedButtonClass}
                  style={postType === 'story' ? { backgroundColor: '#000', color: '#fff' } : { backgroundColor: 'teal', color: '#fff' }}
                  aria-label="Select story"
                  title="Story"
                >
                  Story
                </button>
              </div>
              {postType === 'post' ? (
                <textarea
                  placeholder="Write your status..."
                  className="w-full p-2 border rounded"
                  rows="4"
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                />
              ) : (
                <p className="text-center text-gray-500">Switch to Story mode to record a video.</p>
              )}
              <div className="mt-4">
                <button
                  onClick={() => setAdvancedVisible(!advancedVisible)}
                  className={`${sharedButtonClass} w-full text-left`}
                  aria-label="Toggle advanced options"
                  title={advancedVisible ? 'Hide Advanced Options' : 'Show Advanced Options'}
                >
                  {advancedVisible ? 'Hide Advanced Options' : 'Show Advanced Options'}
                </button>
              </div>
              {advancedVisible && postType === 'post' && (
                <div className="px-4 overflow-y-auto border-t" style={{ maxHeight: '250px' }}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium">Tag People</label>
                      <input
                        type="text"
                        value={statusAdvanced.tagPeople || ''}
                        onChange={handleTagPeopleChange}
                        className="w-full border rounded p-2"
                        placeholder="e.g., @Alice, @Bob"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Tag Location</label>
                      <input
                        type="text"
                        value={statusAdvanced.tagLocation || ''}
                        onChange={handleTagLocationChange}
                        className="w-full border rounded p-2"
                        placeholder="e.g., New York"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Schedule Post</label>
                      <ReactDatePicker
                        selected={statusAdvanced.schedulePost ? new Date(statusAdvanced.schedulePost) : null}
                        onChange={handleScheduleChange}
                        className="w-full border rounded p-2"
                        placeholderText="Select date and time"
                        showTimeSelect
                        dateFormat="Pp"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Attachment</label>
                      <input
                        type="file"
                        onChange={handleAttachmentChange}
                        className="w-full border rounded p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Post Expiration</label>
                      <ReactDatePicker
                        selected={statusAdvanced.postExpiration ? new Date(statusAdvanced.postExpiration) : null}
                        onChange={handleExpirationChange}
                        className="w-full border rounded p-2"
                        placeholderText="Select expiration date/time"
                        showTimeSelect
                        dateFormat="Pp"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-between">
              <button
                onClick={onCancel}
                className={`${sharedButtonClass} bg-red-500 hover:bg-red-600`}
                aria-label="Cancel Status"
                title="Cancel Status"
              >
                Cancel Status
              </button>
              <button
                onClick={() => onCommit({ content: newPostContent, advanced: statusAdvanced, mode: postType })}
                className={`${sharedButtonClass} bg-blue-500 hover:bg-blue-600`}
                aria-label="Commit Status"
                title="Commit Status"
              >
                Commit Status
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ----------------------
// Main PostLiveFeed Component
// ----------------------
export default function PostLiveFeed() {
  // Removed the Create Status button from here so that the button exists only on HomePage.
  return (
    <div>
      <PostList />
    </div>
  );
}
