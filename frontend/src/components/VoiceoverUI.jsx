import React, { useState, useEffect, useRef } from 'react';

// A full-screen modal component for detailed audio playback controls.
function PlaybackModal({ audioUrl, volume, onClose }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Initialize a separate Audio object to manage playback.
  useEffect(() => {
    const audio = new Audio(audioUrl);
    audio.volume = volume;
    audioRef.current = audio;

    const updateProgress = () => {
      setProgress(audio.currentTime);
    };

    // When metadata is loaded, save the duration.
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });
    audio.addEventListener('timeupdate', updateProgress);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.pause();
    };
  }, [audioUrl, volume]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (e) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setProgress(newTime);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '16px',
          borderRadius: '8px',
          maxWidth: '90%',
          width: '300px',
          textAlign: 'center',
        }}
      >
        <h2 style={{ marginBottom: '8px' }}>Playback Preview</h2>
        <button
          onClick={togglePlay}
          style={{
            marginBottom: '8px',
            padding: '8px 12px',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div>
          <input
            type="range"
            min="0"
            max={duration}
            step="0.1"
            value={progress}
            onChange={handleSliderChange}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            {Math.floor(progress)} / {Math.floor(duration)} sec
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: '8px',
            padding: '6px 10px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Close Preview
        </button>
      </div>
    </div>
  );
}

export default function VoiceoverUI({ closeEnhancementPopup, onVoiceoverCommit, videoAudioUrl }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [volume, setVolume] = useState(0.8); // Range: 0 to 1
  const [mixWithVideo, setMixWithVideo] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [finalAudioUrl, setFinalAudioUrl] = useState(null);
  const [showPlaybackModal, setShowPlaybackModal] = useState(false);

  const audioPlayerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Initialize microphone and MediaRecorder on mount.
  useEffect(() => {
    async function initMicrophone() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        let options = { mimeType: 'audio/webm;codecs=opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'audio/webm' };
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = {}; // Fallback to browser defaults.
          }
        }
        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          setIsProcessing(true);
          setStatusText('Processing voiceover...');
          const voiceBlob = new Blob(audioChunksRef.current, { type: options.mimeType || 'audio/webm' });
          audioChunksRef.current = [];
          await handleRecordingComplete(voiceBlob);
        };
      } catch (error) {
        console.error('Error accessing microphone:', error);
        setStatusText('Microphone access error');
      }
    }
    initMicrophone();
  }, []);

  // Update the inline audio player’s volume when volume changes.
  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.volume = volume;
    }
  }, [volume]);

  // Toggle recording when the user clicks the record button.
  const handleRecordClick = () => {
    if (!mediaRecorderRef.current || isProcessing) {
      return;
    }
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatusText('Stopped recording, processing...');
    } else {
      audioChunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setStatusText('Recording...');
    }
  };

  // Process the recorded blob: merge with video audio if requested.
  const handleRecordingComplete = async (voiceBlob) => {
    try {
      let finalUrl;
      if (mixWithVideo && videoAudioUrl) {
        finalUrl = await mergeAudios(videoAudioUrl, voiceBlob);
      } else {
        finalUrl = URL.createObjectURL(voiceBlob);
      }
      setFinalAudioUrl(finalUrl);
      setStatusText('Processing complete');
      setIsProcessing(false);

      // Set inline preview for a quick check.
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = finalUrl;
        audioPlayerRef.current.volume = volume;
      }
      console.log('[onVoiceoverCommit] Final audio URL:', finalUrl);
      onVoiceoverCommit({ url: finalUrl, volume });
    } catch (err) {
      console.error('Error during processing:', err);
      setStatusText('Error processing audio.');
      setIsProcessing(false);
    }
  };

  // Merge the video audio and voiceover blob using OfflineAudioContext.
  const mergeAudios = async (videoUrl, voiceBlob) => {
    const audioContext = new AudioContext();
    // Fetch and decode video audio.
    const videoResponse = await fetch(videoUrl);
    const videoArrayBuffer = await videoResponse.arrayBuffer();
    const videoAudioBuffer = await audioContext.decodeAudioData(videoArrayBuffer);

    // Decode voiceover blob.
    const voiceArrayBuffer = await voiceBlob.arrayBuffer();
    const voiceAudioBuffer = await audioContext.decodeAudioData(voiceArrayBuffer);

    const maxDuration = Math.max(videoAudioBuffer.duration, voiceAudioBuffer.duration);
    const sampleRate = audioContext.sampleRate;

    const offlineContext = new OfflineAudioContext(2, sampleRate * maxDuration, sampleRate);

    const videoSource = offlineContext.createBufferSource();
    videoSource.buffer = videoAudioBuffer;
    videoSource.connect(offlineContext.destination);
    videoSource.start(0);

    const voiceSource = offlineContext.createBufferSource();
    voiceSource.buffer = voiceAudioBuffer;
    const gainNode = offlineContext.createGain();
    gainNode.gain.value = 1.0;
    voiceSource.connect(gainNode);
    gainNode.connect(offlineContext.destination);
    voiceSource.start(0);

    const renderedBuffer = await offlineContext.startRendering();
    const mergedBlob = bufferToWaveBlob(renderedBuffer, renderedBuffer.length);
    return URL.createObjectURL(mergedBlob);
  };

  // Helper: Convert AudioBuffer to a WAV blob.
  const bufferToWaveBlob = (buffer, len) => {
    const wavBuffer = bufferToWave(buffer, len);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  };

  // Helper: Convert AudioBuffer to a WAV-format ArrayBuffer.
  const bufferToWave = (abuffer, len) => {
    const numOfChan = abuffer.numberOfChannels;
    const length = len * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    let channels = [];
    let offset = 0;
    let pos = 0;

    // Write WAV header.
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164); // "data" chunk
    setUint32(length - pos - 4);

    for (let i = 0; i < numOfChan; i++) {
      channels.push(abuffer.getChannelData(i));
    }
    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = channels[i][offset];
        if (sample > 1) sample = 1;
        else if (sample < -1) sample = -1;
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }
    return buffer;

    function setUint16(data) {
      view.setUint16(pos, data, true);
      pos += 2;
    }
    
    function setUint32(data) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  };

  return (
    <div style={{ padding: '8px', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* Main inline voiceover controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Voiceover</span>
        
        <button
          onClick={handleRecordClick}
          disabled={isProcessing}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            backgroundColor: isRecording ? '#E53E3E' : '#3182CE',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            minWidth: '50px',
          }}
        >
          {isRecording ? 'Stop' : 'Rec'}
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>Vol</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ width: '80px' }}
          />
          <span>{Math.round(volume * 100)}%</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="checkbox"
            checked={mixWithVideo}
            onChange={(e) => setMixWithVideo(e.target.checked)}
            style={{ width: '14px', height: '14px' }}
          />
          <span>Mix</span>
        </label>

        <button
          onClick={closeEnhancementPopup}
          style={{
            padding: '4px 10px',
            fontSize: '12px',
            backgroundColor: '#E53E3E',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>

        {/* Show a Preview button if processing is complete */}
        {finalAudioUrl && (
          <button
            onClick={() => setShowPlaybackModal(true)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              backgroundColor: '#38A169',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Preview
          </button>
        )}
      </div>

      <div style={{ marginTop: '8px' }}>
        {statusText && <div style={{ fontSize: '11px', color: '#4A5568' }}>{statusText}</div>}
        {/* Minimal inline audio preview for a quick check */}
        <audio ref={audioPlayerRef} controls style={{ width: '100%', maxWidth: '300px', marginTop: '8px' }} />
      </div>

      {/* Render the playback modal if toggled */}
      {showPlaybackModal && finalAudioUrl && (
        <PlaybackModal
          audioUrl={finalAudioUrl}
          volume={volume}
          onClose={() => setShowPlaybackModal(false)}
        />
      )}
    </div>
  );
}
