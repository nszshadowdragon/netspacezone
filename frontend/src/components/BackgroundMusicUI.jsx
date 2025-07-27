// BackgroundMusicUI.jsx
import React, { useRef } from 'react';

const sharedButtonClass =
  'px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 ' +
  'hover:from-teal-600 hover:to-teal-700 transition-colors duration-300';

const BackgroundMusicUI = ({
  searchQuery,
  setSearchQuery,
  localTracksState,
  setLocalTracksState,
  selectedTrack,
  setSelectedTrack,
  trimPosition,
  setTrimPosition,
  audioDuration,
  audioPlayerRef,
  uploadedAudio,
  setUploadedAudio,
  closeEnhancementPopup,
  currentPlaybackTime,
  setCurrentPlaybackTime,
}) => {
  // Force localTracksState to be an array
  const safeLocalTracks = Array.isArray(localTracksState) ? localTracksState : [];

  const waveWidth = 150;
  const waveHeight = 40;
  const trimWindow = 60;
  const wavePath = `
    M 0,20
    C 20,0 40,40 60,20
    S 100,0 120,20
    S 140,40 150,20
  `;
  const highlightRectWidth = (trimWindow / audioDuration) * waveWidth;
  const highlightX =
    audioDuration - trimWindow > 0
      ? (trimPosition / (audioDuration - trimWindow)) * (waveWidth - highlightRectWidth)
      : 0;

  const waveformRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleChooseAudio = () => {
    console.log(`Chosen track: ${selectedTrack}, trim start: ${trimPosition}s`);
    closeEnhancementPopup?.();
  };

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <h3 className="text-md font-bold mb-2">Background Music</h3>
      <input
        type="text"
        placeholder="Search tracks..."
        value={searchQuery || ''}
        onChange={(e) => {
          try {
            setSearchQuery?.(e.target.value);
          } catch (error) {
            console.error('Error in search input:', error);
          }
        }}
        className="w-full p-2 border rounded mb-2"
      />

      {/* Only map if safeLocalTracks has length */}
      {safeLocalTracks.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {safeLocalTracks.map((track) => (
            <button
              key={track.url}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                try {
                  setSelectedTrack?.(track.url);
                  setTrimPosition?.(0);
                  console.log(`${track.name} selected`);
                } catch (error) {
                  console.error('Error selecting track:', error);
                }
              }}
              className={`px-3 py-1 rounded-full border ${
                selectedTrack === track.url ? 'bg-teal-500 text-white' : 'bg-gray-200 text-black'
              } hover:bg-teal-600 transition-colors`}
            >
              {track.name}
            </button>
          ))}
        </div>
      )}
      <div className="mb-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (fileInputRef.current) {
              fileInputRef.current.click();
            } else {
              console.error('File input ref not found.');
            }
          }}
          className="px-3 py-1 rounded-full border bg-gray-200 text-black hover:bg-teal-600 hover:text-white transition-colors"
        >
          Upload Audio
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            try {
              if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                console.log('File selected:', file);
                if (!file.type.startsWith('audio/')) {
                  console.warn('Invalid file type. Please select an audio file.');
                  return;
                }
                const url = URL.createObjectURL(file);
                setUploadedAudio?.(url);
                setSelectedTrack?.(url);
                setTrimPosition?.(0);
                console.log(`Uploaded audio: ${file.name}`);
              } else {
                console.warn('No file selected.');
              }
            } catch (error) {
              console.error('Error uploading audio:', error);
            }
          }}
        />
      </div>
      <p className="text-sm font-semibold mb-2">
        Trim: {selectedTrack ? selectedTrack.split('/').pop() : 'Select a Song'}
      </p>
      {selectedTrack && (
        <div
          ref={waveformRef}
          className="relative w-[150px] h-[40px] border border-gray-300 mb-2 select-none"
        >
          <svg width={waveWidth} height={waveHeight} style={{ display: 'block' }}>
            <defs>
              <linearGradient id="rainbowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff0000" />
                <stop offset="25%" stopColor="#ffae00" />
                <stop offset="50%" stopColor="#00ff66" />
                <stop offset="75%" stopColor="#0066ff" />
                <stop offset="100%" stopColor="#cc00ff" />
              </linearGradient>
            </defs>
            <path d={wavePath} fill="none" stroke="url(#rainbowGradient)" strokeWidth="2" />
            <rect
              x={highlightX}
              y="0"
              width={highlightRectWidth}
              height={waveHeight}
              fill="rgba(20, 184, 166, 0.5)"
              style={{ cursor: 'grab' }}
            />
            <rect
              x={(currentPlaybackTime / audioDuration) * waveWidth}
              y="0"
              width="2"
              height={waveHeight}
              fill="red"
            />
          </svg>
        </div>
      )}
      {selectedTrack && (
        <div className="flex justify-around w-full mb-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (audioPlayerRef?.current) {
                audioPlayerRef.current.currentTime = trimPosition;
                audioPlayerRef.current.play();
              } else {
                console.warn('Audio player not ready.');
              }
            }}
            className={`${sharedButtonClass} w-1/2 mr-1`}
            aria-label="Play Audio"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 inline-block"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="ml-1">Play</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (audioPlayerRef?.current) {
                audioPlayerRef.current.pause();
              } else {
                console.warn('Audio player not ready.');
              }
            }}
            className={`${sharedButtonClass} w-1/2 ml-1`}
            aria-label="Stop Audio"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 inline-block"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6 6h12v12H6z" />
            </svg>
            <span className="ml-1">Stop</span>
          </button>
        </div>
      )}
      {selectedTrack && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleChooseAudio();
          }}
          className={`${sharedButtonClass} w-full text-sm mb-2`}
          aria-label="Choose Audio"
        >
          Choose
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          closeEnhancementPopup?.();
        }}
        className="px-4 py-2 rounded text-white bg-red-600 hover:bg-red-700 transition-colors duration-300 w-full text-sm"
        aria-label="Close Options"
      >
        Close
      </button>
    </form>
  );
};

export default BackgroundMusicUI;
