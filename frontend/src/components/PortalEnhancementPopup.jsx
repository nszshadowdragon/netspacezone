import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import BackgroundMusicUI from './BackgroundMusicUI';
import HashtagUI from './HashtagUI';
import ColorFiltersUI from './ColorFiltersUI';
import AnimatedTextOverlayUI from './AnimatedTextOverlayUI';
import AnimatedTransitionsUI from './AnimatedTransitionsUI';
import MoreEnhancementsUI from './MoreEnhancementsUI';
import VoiceoverUI from './VoiceoverUI';
import StickerLibraryUI from './StickerLibraryUI'; // Updated import
import ARMasksUI from './ARMasksUI';
import GifIntegrationUI from './GifIntegrationUI';
import DrawingOverlayUI from './DrawingOverlayUI';
import EnhancedPoll from './EnhancedPoll';

const portalRoot = document.getElementById('portal-root');

const DEFAULT_TRACKS = [
  { name: 'Track 01 - Intro', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { name: 'Track 02 - The Fall', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
];

const extraEnhancements = [
  'Background Music',
  'Hashtag Suggestions',
  'Animated Text Overlays',
  'Color Filters',
  'Animated Transitions',
];

const extraEnhancementsIcons = {
  'Background Music': '🎵',
  'Hashtag Suggestions': '🔖',
  'Animated Text Overlays': '📝',
  'Color Filters': '🎨',
  'Animated Transitions': '✨',
};

export default function PortalEnhancementPopup({
  selectedEnhancement,
  setSelectedEnhancement,
  closeEnhancementPopup = () => {},
  cameraBoxRef,
  selectedTrack,
  setSelectedTrack,
  uploadedAudio,
  setUploadedAudio,
  audioPlayerRef,
  trimPosition,
  setTrimPosition,
  audioDuration = 180,
  currentPlaybackTime,
  setCurrentPlaybackTime,
  selectedHashtags = [],
  setSelectedHashtags = () => {},
  animatedText = {},
  setAnimatedText = () => {},
  selectedFilter,
  setSelectedFilter,
  selectedTransition,
  setSelectedTransition,
  mainEnhancements = [],
  setMainEnhancements = () => {},
  extraEnhancements,
  pollData,
  setPollData,
  videoSrc,
  onDrawingCommit,
  searchQuery,
  setSearchQuery,
  localTracksState,
  setLocalTracksState,
  localHashtagSuggestionsState,
  setLocalHashtagSuggestionsState,
}) {
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const [overlayRect, setOverlayRect] = useState({
    top: 0,
    left: 0,
    width: 360,
    height: 640,
  });

  const measureCameraBox = useCallback(() => {
    if (cameraBoxRef?.current) {
      const rect = cameraBoxRef.current.getBoundingClientRect();
      setPopupPos({
        top: rect.top,
        left: rect.right + rect.width * 0.01,
      });
      setOverlayRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }
  }, [cameraBoxRef]);

  useEffect(() => {
    if (selectedEnhancement && selectedEnhancement !== 'Drawing Tools') {
      measureCameraBox();
    }
  }, [selectedEnhancement, measureCameraBox]);

  useEffect(() => {
    function handleResizeOrScroll() {
      if (selectedEnhancement && selectedEnhancement !== 'Drawing Tools') {
        measureCameraBox();
      }
    }
    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);
    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
    };
  }, [selectedEnhancement, measureCameraBox]);

  useEffect(() => {
    if (selectedEnhancement === 'Background Music') {
      if (searchQuery && searchQuery.trim()) {
        const filtered = DEFAULT_TRACKS.filter((track) =>
          track.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setLocalTracksState(filtered);
      } else {
        setLocalTracksState(DEFAULT_TRACKS);
      }
    }
  }, [searchQuery, selectedEnhancement, setLocalTracksState]);

  useEffect(() => {
    if (selectedEnhancement === 'Hashtag Suggestions') {
      if (searchQuery && searchQuery.trim().length >= 2) {
        const filtered = [
          { tag: '#fun', popularity: 120 },
          { tag: '#party', popularity: 95 },
          { tag: '#vibes', popularity: 80 },
          { tag: '#inspo', popularity: 110 },
          { tag: '#trending', popularity: 150 },
        ].filter((item) =>
          item.tag.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setLocalHashtagSuggestionsState(filtered);
      } else {
        setLocalHashtagSuggestionsState([
          { tag: '#fun', popularity: 120 },
          { tag: '#party', popularity: 95 },
          { tag: '#vibes', popularity: 80 },
        ]);
      }
    }
  }, [searchQuery, selectedEnhancement, setLocalHashtagSuggestionsState]);

  function renderPopupContent() {
    switch (selectedEnhancement) {
      case 'Background Music':
        return (
          <BackgroundMusicUI
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            localTracksState={localTracksState}
            setLocalTracksState={setLocalTracksState}
            selectedTrack={selectedTrack}
            setSelectedTrack={setSelectedTrack}
            trimPosition={trimPosition}
            setTrimPosition={setTrimPosition}
            audioDuration={audioDuration}
            audioPlayerRef={audioPlayerRef}
            uploadedAudio={uploadedAudio}
            setUploadedAudio={setUploadedAudio}
            closeEnhancementPopup={closeEnhancementPopup}
            currentPlaybackTime={currentPlaybackTime}
            setCurrentPlaybackTime={setCurrentPlaybackTime}
          />
        );
      case 'Hashtag Suggestions':
        return (
          <HashtagUI
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filteredHashtags={localHashtagSuggestionsState}
            selectedHashtags={selectedHashtags}
            setSelectedHashtags={setSelectedHashtags}
            closeEnhancementPopup={closeEnhancementPopup}
          />
        );
      case 'Color Filters':
        return (
          <ColorFiltersUI
            selectedFilter={selectedFilter}
            setSelectedFilter={setSelectedFilter}
            closeEnhancementPopup={closeEnhancementPopup}
          />
        );
      case 'Animated Text Overlays':
        return (
          <AnimatedTextOverlayUI
            animatedText={animatedText}
            setAnimatedText={setAnimatedText}
            closeEnhancementPopup={closeEnhancementPopup}
          />
        );
      case 'Animated Transitions':
        return (
          <AnimatedTransitionsUI
            selectedTransition={selectedTransition}
            setSelectedTransition={setSelectedTransition}
            closeEnhancementPopup={closeEnhancementPopup}
          />
        );
      case 'Voiceover Recording':
        return (
          <VoiceoverUI
            closeEnhancementPopup={closeEnhancementPopup}
            onVoiceoverCommit={(url) => console.log('Voiceover committed:', url)}
          />
        );
      case 'Sticker Library':
        // UPDATED: Using the new onStickerDragStart prop.
        return (
          <StickerLibraryUI
            closeEnhancementPopup={closeEnhancementPopup}
            onStickerDragStart={(sticker) =>
              console.log('Sticker drag started:', sticker)
            }
          />
        );
      case 'AR Masks & Filters':
        return (
          <ARMasksUI
            closeEnhancementPopup={closeEnhancementPopup}
            onARMasksSelect={(mask) => console.log('AR Mask selected:', mask)}
          />
        );
      case 'GIF Integration':
        return (
          <GifIntegrationUI
            closeEnhancementPopup={closeEnhancementPopup}
            onGifSelect={(gif) => console.log('GIF selected:', gif)}
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
      case 'More Options':
        return (
          <div className="p-4">
            <h3 className="text-md font-bold mb-2">Extra Enhancements</h3>
            <div className="grid grid-cols-3 gap-4">
              {extraEnhancements.map((enh) => (
                <button
                  key={enh}
                  type="button"
                  onClick={() => setSelectedEnhancement(enh)}
                  className="flex flex-col items-center justify-center p-2 border rounded hover:bg-teal-600 transition-colors"
                  title={enh}
                  aria-label={enh}
                >
                  <span className="text-2xl text-teal-600 font-bold">
                    {extraEnhancementsIcons[enh] || '❓'}
                  </span>
                  <span className="text-xs" style={{ color: 'black' }}>
                    {enh}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => console.log('Customize Main Enhancements clicked')}
              className="mt-4 w-full px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              aria-label="Customize Main Enhancements"
            >
              Customize Main Enhancements
            </button>
            <button
              onClick={closeEnhancementPopup}
              className="mt-4 w-full px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
              aria-label="Close Extra Enhancements"
            >
              Close
            </button>
          </div>
        );
      default:
        return (
          <>
            <h3 className="text-md font-bold mb-2">{selectedEnhancement}</h3>
            <button
              onClick={closeEnhancementPopup}
              className="px-4 py-2 mt-2 rounded bg-red-500 text-white"
            >
              Close
            </button>
          </>
        );
    }
  }

  return createPortal(
    <AnimatePresence>
      {selectedEnhancement && (
        selectedEnhancement === 'Drawing Tools' ? (
          <motion.div
            className="absolute z-[9999]"
            style={{
              top: overlayRect.top + overlayRect.height * 0.12,
              left: overlayRect.left + overlayRect.width * 0.1,
              width: overlayRect.width,
              height: overlayRect.height,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Drawing Tools UI */}
            <DrawingOverlayUI
              videoSrc={videoSrc}
              closeEnhancementPopup={closeEnhancementPopup}
              onDrawingCommit={onDrawingCommit}
            />
          </motion.div>
        ) : (
          <motion.div
            key="normal-popup"
            className="fixed bg-white border border-gray-300 shadow-lg p-4 w-80"
            style={{
              top: popupPos.top,
              left: popupPos.left,
              zIndex: 9999,
            }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            {renderPopupContent()}
          </motion.div>
        )
      )}
    </AnimatePresence>,
    portalRoot
  );
}
