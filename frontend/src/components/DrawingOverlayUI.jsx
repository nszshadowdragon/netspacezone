// DrawingOverlayUI.jsx
import React, { useRef, useState, useEffect } from 'react';

const sharedButtonClass =
  'px-3 py-1 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 ' +
  'hover:from-teal-600 hover:to-teal-700 transition-colors duration-300 text-xs';

export default function DrawingOverlayUI({ videoSrc, closeEnhancementPopup, onDrawingCommit }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Instead of fixed pixel dimensions, use 100% width and an aspect ratio (e.g., 9:16)
  // You can adjust the aspect ratio as needed.
  // The control bar height is set as a percentage of container height.
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setContainerDimensions({ width: rect.width, height: rect.height });
      // Also update the canvas dimensions dynamically:
      if (canvasRef.current) {
        canvasRef.current.width = rect.width;
        // Reserve, say, 12% of height for the control bar
        canvasRef.current.height = rect.height * 0.88;
      }
    }
  }, [videoSrc]);

  // Drawing state
  const [drawing, setDrawing] = useState(false);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [color, setColor] = useState('#ff0000');
  const [lineWidth, setLineWidth] = useState(3);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentPath([{ x, y }]);
    setDrawing(true);
  };

  const draw = (e) => {
    if (!drawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentPath(prev => [...prev, { x, y }]);
  };

  const endDrawing = () => {
    if (!drawing || currentPath.length < 2) {
      setDrawing(false);
      return;
    }
    setPaths(prev => [...prev, currentPath]);
    setCurrentPath([]);
    setDrawing(false);
  };

  const clearCanvas = () => {
    setPaths([]);
    setCurrentPath([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawPath = (path) => {
      if (path.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      path.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    };

    paths.forEach(drawPath);
    drawPath(currentPath);
  }, [paths, currentPath, color, lineWidth]);

  const commitDrawing = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataURL = canvas.toDataURL('image/png');
      onDrawingCommit && onDrawingCommit(dataURL);
      closeEnhancementPopup && closeEnhancementPopup();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
    >
      {/* Video Element */}
      <video
        src={videoSrc}
        className="w-full h-full object-cover"
        autoPlay
        loop
        muted
      />
      
      {/* Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 z-20"
        style={{ cursor: 'crosshair' }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
      />

      {/* Control Bar at the Bottom - spans the full width of the container */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center justify-center p-2"
        style={{
          height: containerDimensions.height ? containerDimensions.height * 0.12 : '80px',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Drawing Settings */}
        <div className="flex justify-between items-center w-full px-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 border rounded"
          />
          <input
            type="number"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-12 border rounded p-1 text-sm"
            min="1"
            max="20"
          />
        </div>
        {/* Action Buttons */}
        <div className="flex justify-around w-full px-2">
          <button
            onClick={clearCanvas}
            className={sharedButtonClass}
          >
            Clear
          </button>
          <button
            onClick={commitDrawing}
            className={sharedButtonClass}
          >
            Commit
          </button>
          <button
            onClick={closeEnhancementPopup}
            className={`${sharedButtonClass} bg-red-500 hover:bg-red-700`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
