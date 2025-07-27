import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import CameraPreview from './CameraPreview';
import { useCamera } from './GlobalCameraContext';

// Dummy imports for enhancements (replace these with your actual components)
import BackgroundMusicUI from './BackgroundMusicUI';
import HashtagUI from './HashtagUI';
import ColorFiltersUI from './ColorFiltersUI';
import AnimatedTextOverlayUI from './AnimatedTextOverlayUI';
import AnimatedTransitionsUI from './AnimatedTransitionsUI';
import VoiceoverUI from './VoiceoverUI';
import StickerLibraryUI from './StickerLibraryUI';
import ARMasksUI from './ARMasksUI';
import GifIntegrationUI from './GifIntegrationUI';
import DrawingOverlayUI from './DrawingOverlayUI';
import EnhancedPoll from './EnhancedPoll';

const sharedButtonClass =
  'px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 ' +
  'hover:from-teal-600 hover:to-teal-700 transition-colors duration-300';

const mainEnhancements = [
  { name: 'Voiceover Recording', icon: '🎤' },
  { name: 'Sticker Library', icon: '🖼️' },
  { name: 'AR Masks & Filters', icon: '😷' },
  { name: 'GIF Integration', icon: '🎞️' },
  { name: 'Drawing Tools', icon: '✏️' },
  { name: 'Interactive Polls', icon: '📊' },
];

export default function CreateStatusModal({ show, onCancel, onCommit }) {
  const [internalShow, setInternalShow] = useState(show);
  useEffect(() => {
    if (show) {
      setInternalShow(true);
    } else {
      const timer = setTimeout(() => setInternalShow(false), 500);
      return () => clearTimeout(timer);
    }
  }, [show]);

  const [postType, setPostType] = useState('post'); // "post" or "story"
  const [newPostContent, setNewPostContent] = useState('');
  const [advancedVisible, setAdvancedVisible] = useState(false);
  const [statusAdvanced, setStatusAdvanced] = useState({});

  // Camera stream for live preview
  const cameraStream = useCamera();

  // Recording-related state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordTimerRef = useRef(null);
  const chunksRef = useRef([]);

  // Video trim state
  const [trimPosition, setTrimPosition] = useState(0);
  const maxTrim = 60; // max trim in seconds

  // Enhancements (Story mode)
  const [selectedEnhancement, setSelectedEnhancement] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [uploadedAudio, setUploadedAudio] = useState(null);
  const audioPlayerRef = useRef(null);
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
  const [pollData, setPollData] = useState({
    question: 'Which option do you prefer?',
    options: ['Option A', 'Option B', 'Option C'],
    votes: [0, 0, 0],
    userVote: null,
  });

  // Reset state when modal is closed
  useEffect(() => {
    if (!show) {
      setNewPostContent('');
      setAdvancedVisible(false);
      setStatusAdvanced({});
      setPostType('post');
      setRecordedVideoUrl(null);
      chunksRef.current = [];
      setIsRecording(false);
      setTrimPosition(0);
      setSelectedEnhancement(null);
    }
  }, [show]);

  // -------------
  // Advanced Fields Handlers
  // -------------
  const handleTagPeopleChange = (e) => {
    setStatusAdvanced((prev) => ({ ...prev, tagPeople: e.target.value }));
  };
  const handleTagLocationChange = (e) => {
    setStatusAdvanced((prev) => ({ ...prev, tagLocation: e.target.value }));
  };
  const handleAttachmentChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setStatusAdvanced((prev) => ({ ...prev, attachment: file.name }));
    }
  };
  const handleScheduleChange = (date) => {
    setStatusAdvanced((prev) => ({ ...prev, schedulePost: date }));
  };
  const handleExpirationChange = (date) => {
    setStatusAdvanced((prev) => ({ ...prev, postExpiration: date }));
  };

  // -------------
  // Recording
  // -------------
  const startRecording = () => {
    if (!cameraStream) {
      console.error('No camera stream available.');
      return;
    }
    chunksRef.current = [];
    try {
      let mimeType = 'video/webm; codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm; codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }
      const mediaRecorder = new MediaRecorder(cameraStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setIsRecording(false);
        clearTimeout(recordTimerRef.current);
        console.log('Recording stopped, playback URL:', url);
      };
      mediaRecorder.start();
      setIsRecording(true);
      recordTimerRef.current = setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }, 60000);
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleRecordButtonClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      setRecordedVideoUrl(null);
      startRecording();
    }
  };

  // Cancel playback
  const handleCancelPlayback = () => {
    setRecordedVideoUrl(null);
    console.log('Playback canceled.');
  };

  const handleEnhance = () => {
    console.log('Enhance button clicked.');
    setSelectedEnhancement('Enhance');
  };

  const handleCommit = () => {
    onCommit({
      content: newPostContent,
      advanced: statusAdvanced,
      mode: postType,
      trimPosition,
    });
  };

  // -------------
  // Define the missing handleEnhancementClick
  // -------------
  function handleEnhancementClick(enhName, ev) {
    ev.stopPropagation();
    setSelectedEnhancement(enhName);
    console.log(`Enhancement selected: ${enhName}`);
  }

  // -------------
  // RenderEnhancementContent
  // -------------
  function renderEnhancementContent() {
    switch (selectedEnhancement) {
      case 'Voiceover Recording':
        return (
          <VoiceoverUI
            closeEnhancementPopup={() => setSelectedEnhancement(null)}
            onVoiceoverCommit={(url) => console.log('Voiceover committed:', url)}
          />
        );
      case 'Sticker Library':
        // Updated to use onStickerDragStart
        return (
          <StickerLibraryUI
            closeEnhancementPopup={() => setSelectedEnhancement(null)}
            onStickerDragStart={(sticker) => console.log('Sticker drag started:', sticker)}
          />
        );
      case 'AR Masks & Filters':
        return (
          <ARMasksUI
            closeEnhancementPopup={() => setSelectedEnhancement(null)}
            onARMasksSelect={(mask) => console.log('AR Mask selected:', mask)}
          />
        );
      case 'GIF Integration':
        return (
          <GifIntegrationUI
            closeEnhancementPopup={() => setSelectedEnhancement(null)}
            onGifSelect={(gif) => console.log('GIF selected:', gif)}
          />
        );
      case 'Drawing Tools':
        return (
          <DrawingOverlayUI
            videoSrc={recordedVideoUrl || ''}
            closeEnhancementPopup={() => setSelectedEnhancement(null)}
            onDrawingCommit={(dataURL) => {
              console.log('Drawing overlay committed:', dataURL);
              setSelectedEnhancement(null);
            }}
          />
        );
      case 'Interactive Polls':
        return (
          <EnhancedPoll
            pollData={pollData}
            setPollData={setPollData}
            onPollSubmit={(pollInfo) => console.log('Poll submitted:', pollInfo)}
            onVote={(idx) => console.log('Poll vote cast:', idx)}
          />
        );
      case 'Enhance':
        return (
          <div className="p-2 text-sm">
            <h3 className="font-bold mb-2">Enhance Options</h3>
            <button
              onClick={() => setSelectedEnhancement(null)}
              className="px-2 py-1 bg-red-500 text-white rounded"
            >
              Close
            </button>
          </div>
        );
      default:
        return selectedEnhancement ? (
          <div className="p-2 text-sm">
            <h3 className="font-bold mb-2">{selectedEnhancement} UI not implemented</h3>
            <button
              onClick={() => setSelectedEnhancement(null)}
              className="px-2 py-1 bg-red-500 text-white rounded"
            >
              Close
            </button>
          </div>
        ) : null;
    }
  }

  // -------------
  // Render Modal
  // -------------
  return (
    <AnimatePresence>
      {internalShow && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] pt-16 pb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className="bg-black border-[5px] border-teal-500 rounded-lg p-4 flex flex-col items-center relative"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width:
                postType === 'story'
                  ? selectedEnhancement
                    ? '632px'
                    : '432px'
                  : '480px',
              marginLeft: postType === 'story' && selectedEnhancement ? '50px' : '0',
              height:
                postType === 'story'
                  ? selectedEnhancement
                    ? '700px'
                    : '640px'
                  : 'auto',
            }}
          >
            {/* Tab Header */}
            <div className="flex justify-center space-x-4 mb-4 w-full">
              <button
                onClick={() => setPostType('post')}
                className={sharedButtonClass}
                style={
                  postType === 'post'
                    ? { backgroundColor: '#000', color: '#fff' }
                    : { backgroundColor: 'teal', color: '#fff' }
                }
              >
                Status
              </button>
              <button
                onClick={() => setPostType('story')}
                className={sharedButtonClass}
                style={
                  postType === 'story'
                    ? { backgroundColor: '#000', color: '#fff' }
                    : { backgroundColor: 'teal', color: '#fff' }
                }
              >
                Story
              </button>
            </div>

            {postType === 'post' ? (
              <>
                <textarea
                  placeholder="Write your status..."
                  className="w-full p-2 border rounded mb-4"
                  rows="4"
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                />
                <div className="mb-4 w-full">
                  <button
                    onClick={() => setAdvancedVisible(!advancedVisible)}
                    className={`${sharedButtonClass} w-full text-left`}
                  >
                    {advancedVisible ? 'Hide Advanced Options' : 'Show Advanced Options'}
                  </button>
                </div>
                {advancedVisible && (
                  <div
                    className="w-full px-4 overflow-y-auto border-t mt-2"
                    style={{ maxHeight: '250px' }}
                  >
                    <div className="grid grid-cols-2 gap-4 py-2">
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
                          selected={
                            statusAdvanced.schedulePost
                              ? new Date(statusAdvanced.schedulePost)
                              : null
                          }
                          onChange={handleScheduleChange}
                          className="w-full border rounded p-2"
                          placeholderText="Select date/time"
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
                          selected={
                            statusAdvanced.postExpiration
                              ? new Date(statusAdvanced.postExpiration)
                              : null
                          }
                          onChange={handleExpirationChange}
                          className="w-full border rounded p-2"
                          placeholderText="Expiration date/time"
                          showTimeSelect
                          dateFormat="Pp"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Story Mode
              <div className="relative flex overflow-hidden mb-4 bg-black" style={{ height: '640px' }}>
                {/* Left section: camera or playback area (432px wide) */}
                <div className="w-[432px] h-full relative">
                  {recordedVideoUrl ? (
                    <>
                      <video
                        src={recordedVideoUrl}
                        autoPlay
                        loop
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 flex items-center p-2 space-x-2">
                        <div className="flex-1">
                          <label className="text-white text-xs mr-2">Trim: {trimPosition}s</label>
                          <input
                            type="range"
                            min="0"
                            max={maxTrim}
                            step="0.1"
                            value={trimPosition}
                            onChange={(e) => setTrimPosition(Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                        <button
                          onClick={handleCancelPlayback}
                          className="bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="white"
                            className="w-4 h-4"
                          >
                            <path
                              fillRule="evenodd"
                              d="M6.225 4.811a.75.75 0 011.06 0L12 9.525l4.715-4.714a.75.75 0 111.06 1.06L13.06 10.586l4.715 4.714a.75.75 0 11-1.06 1.06L12 11.646l-4.715 4.714a.75.75 0 11-1.06-1.06l4.715-4.714-4.715-4.714a.75.75 0 010-1.06z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <CameraPreview />
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                        <button
                          onClick={handleRecordButtonClick}
                          className="bg-red-600 rounded-full p-3"
                        >
                          {isRecording ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="white"
                              className="w-6 h-6"
                            >
                              <rect x="8" y="8" width="8" height="8" />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="white"
                              className="w-6 h-6"
                            >
                              <circle cx="12" cy="12" r="8" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                  {/* Top overlay: Enhancement Icons */}
                  <div
                    className="absolute top-0 left-0 right-0 flex flex-wrap items-center justify-evenly p-2"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
                  >
                    {mainEnhancements.map((enh) => (
                      <button
                        key={enh.name}
                        onClick={(ev) => handleEnhancementClick(enh.name, ev)}
                        className="flex flex-col items-center justify-center p-1 mx-1 transform hover:scale-110 transition-transform"
                      >
                        <div className="text-xl text-white drop-shadow-lg">{enh.icon}</div>
                      </button>
                    ))}
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelectedEnhancement('More Options');
                      }}
                      className="flex flex-col items-center justify-center p-1 transform hover:scale-110 transition-transform"
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

                {/* Right section: Inline Enhancement Panel */}
                {selectedEnhancement && (
                  <div className="w-[200px] h-full bg-white p-4" style={{ overflow: 'visible' }}>
                    {renderEnhancementContent()}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between w-full space-x-2 mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                className={`${sharedButtonClass} flex-1 bg-red-500 hover:bg-red-600`}
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEnhance();
                }}
                className={`${sharedButtonClass} flex-1`}
              >
                Enhance
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCommit();
                }}
                className={`${sharedButtonClass} flex-1`}
              >
                Commit
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
