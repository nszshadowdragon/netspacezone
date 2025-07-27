// StoryModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from './ErrorBoundary';
import PortalEnhancementPopup from './PortalEnhancementPopup';

const sharedButtonClass =
  'px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 ' +
  'hover:from-teal-600 hover:to-teal-700 transition-colors duration-300';

const initialMainEnhancements = [
  'Voiceover Recording',
  'Sticker Library',
  'AR Masks & Filters',
  'GIF Integration',
  'Drawing Tools',
  'Interactive Polls',
];

const mainEnhancementsIcons = {
  'Voiceover Recording': '🎤',
  'Sticker Library': '🖼️',
  'AR Masks & Filters': '😷',
  'GIF Integration': '🎞️',
  'Drawing Tools': '✏️',
  'Interactive Polls': '📊',
};

const audioDuration = 180;
const extraEnhancements = [
  'Background Music',
  'Hashtag Suggestions',
  'Animated Text Overlays',
  'Color Filters',
  'Animated Transitions',
  'Video Trimming',
  'Auto-Subtitles',
];

export default function StoryModal({ show, onCancel, onCommit }) {
  // Hooks at the top
  const [selectedEnhancement, setSelectedEnhancement] = useState(null);
  const [enhanced, setEnhanced] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [uploadedAudio, setUploadedAudio] = useState(null);
  const [trimPosition, setTrimPosition] = useState(0);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [animatedText, setAnimatedText] = useState({
    text: '',
    color: '#ffffff',
    animation: 'fade',
    fontSize: 24,
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center',
    textShadow: false,
    x: 50,
    y: 50,
    rotation: 0,
  });
  const [selectedFilter, setSelectedFilter] = useState('');
  const [selectedTransition, setSelectedTransition] = useState('');
  const [mainEnhancements, setMainEnhancements] = useState(initialMainEnhancements);

  // Poll data for "Interactive Polls"
  const [pollData, setPollData] = useState({
    question: 'Which option do you prefer?',
    options: ['Option A', 'Option B', 'Option C'],
    votes: [0, 0, 0],
    userVote: null,
  });

  const audioPlayerRef = useRef(null);
  const cameraBoxRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (audioPlayerRef.current) {
        setCurrentPlaybackTime(audioPlayerRef.current.currentTime);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!show) return null;

  function handleEnhancementClick(enh, e) {
    e.stopPropagation();
    if (selectedEnhancement === enh) {
      setSelectedEnhancement(null);
      console.log(`${enh} closed`);
    } else {
      console.log(`${enh} opened`);
      setSelectedEnhancement(enh);
    }
  }

  function commitStory() {
    const advanced = {
      backgroundMusic: selectedTrack,
      enhanced,
      hashtags: selectedHashtags,
      animatedText,
      colorFilter: selectedFilter,
      transitionStyle: selectedTransition,
      isPublic: true,
      trimPosition,
    };
    // If poll has a vote, we include it
    if (pollData.userVote !== null) {
      advanced.poll = pollData;
    }
    console.log('Story Committed');
    onCommit({ content: '', advanced, mode: 'story' });
  }

  return (
    <ErrorBoundary>
      <AnimatePresence>
        {show && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              className="bg-white rounded-lg w-[400px] p-4 flex flex-col items-center relative"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              <audio ref={audioPlayerRef} src={selectedTrack || ''} style={{ display: 'none' }} />
              <div
                ref={cameraBoxRef}
                className="relative w-[360px] h-[640px] mb-4 overflow-hidden"
                style={{ backgroundColor: 'black', filter: selectedFilter }}
              >
                {selectedTrack ? (
                  <div className="w-full h-full relative">
                    <video src={selectedTrack} className="w-full h-full object-cover" controls />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
                      <label className="text-white text-xs">Trim Start: {trimPosition}s</label>
                      <input
                        type="range"
                        min="0"
                        max={audioDuration - 1}
                        value={trimPosition}
                        onChange={(e) => setTrimPosition(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full bg-black"></div>
                )}
                <div
                  className="absolute top-0 left-0 right-0 flex justify-between p-2"
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', pointerEvents: 'auto' }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Status tab clicked');
                    }}
                    className="bg-teal-500 text-white px-3 py-2 rounded transform hover:scale-105 transition-transform"
                    title="Status"
                    aria-label="Status"
                  >
                    Status
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Story tab clicked');
                    }}
                    className="bg-teal-500 text-white px-3 py-2 rounded transform hover:scale-105 transition-transform"
                    title="Story"
                    aria-label="Story"
                  >
                    Story
                  </button>
                </div>
                {/* Main Enhancements Row */}
                <div
                  className="absolute top-[54px] left-0 right-0 flex flex-wrap items-center justify-evenly p-2"
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', pointerEvents: 'auto' }}
                >
                  {mainEnhancements.map((enh) => {
                    const icon = mainEnhancementsIcons[enh] || '❓';
                    const extraClass = enh === 'Interactive Polls' ? 'animate-pulse' : '';
                    return (
                      <button
                        key={enh}
                        onClick={(ev) => handleEnhancementClick(enh, ev)}
                        className={`flex flex-col items-center justify-center p-1 mx-1 transform hover:scale-110 transition-transform ${extraClass}`}
                        title={enh}
                        aria-label={enh}
                      >
                        <div className="text-xl text-white drop-shadow-lg">{icon}</div>
                      </button>
                    );
                  })}
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      console.log('More Options clicked');
                      setSelectedEnhancement('More Options');
                    }}
                    className="flex flex-col items-center justify-center p-1 transform hover:scale-110 transition-transform"
                    title="More Options"
                    aria-label="More Options"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-white drop-shadow-lg"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex justify-between w-full space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEnhancement(null);
                    onCancel();
                  }}
                  className={`${sharedButtonClass} flex-1 bg-red-500 hover:bg-red-600`}
                  aria-label="Cancel Story"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEnhanced(true);
                    console.log('All enhancements activated');
                  }}
                  className={`${sharedButtonClass} flex-1`}
                  aria-label="Enhance Story"
                >
                  Enhance
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEnhancement(null);
                    const advanced = {
                      backgroundMusic: selectedTrack,
                      enhanced,
                      hashtags: selectedHashtags,
                      animatedText,
                      colorFilter: selectedFilter,
                      transitionStyle: selectedTransition,
                      isPublic: true,
                      trimPosition,
                    };
                    if (pollData.userVote !== null) {
                      advanced.poll = pollData;
                    }
                    console.log('Story Committed');
                    onCommit({
                      content: '',
                      advanced,
                      mode: 'story',
                    });
                  }}
                  className={`${sharedButtonClass} flex-1`}
                  aria-label="Commit Story"
                >
                  Commit
                </button>
              </div>
            </motion.div>

            {/* Portal Enhancement Popup */}
            <PortalEnhancementPopup
              selectedEnhancement={selectedEnhancement}
              setSelectedEnhancement={setSelectedEnhancement}
              closeEnhancementPopup={() => setSelectedEnhancement(null)}
              cameraBoxRef={cameraBoxRef}
              selectedTrack={selectedTrack}
              setSelectedTrack={setSelectedTrack}
              uploadedAudio={uploadedAudio}
              setUploadedAudio={setUploadedAudio}
              audioPlayerRef={audioPlayerRef}
              trimPosition={trimPosition}
              setTrimPosition={setTrimPosition}
              audioDuration={audioDuration}
              currentPlaybackTime={currentPlaybackTime}
              setCurrentPlaybackTime={setCurrentPlaybackTime}
              selectedHashtags={selectedHashtags}
              setSelectedHashtags={setSelectedHashtags}
              animatedText={animatedText}
              setAnimatedText={setAnimatedText}
              selectedFilter={selectedFilter}
              setSelectedFilter={setSelectedFilter}
              selectedTransition={selectedTransition}
              setSelectedTransition={setSelectedTransition}
              mainEnhancements={mainEnhancements}
              setMainEnhancements={setMainEnhancements}
              extraEnhancements={extraEnhancements}
              // pass poll data to the popup
              pollData={pollData}
              setPollData={setPollData}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
