import React, { useRef, useState, useEffect, useCallback } from 'react';

const DrawingLayer = ({ 
  width, 
  height, 
  onSave, 
  initialData, 
  color = '#6366f1', 
  brushSize = 2,
  isEraser = false,
  isActive = false
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);

  // Load initial data
  useEffect(() => {
    if (initialData) {
      try {
        const parsed = typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
        setPaths(parsed || []);
      } catch (e) {
        console.error("Failed to parse drawing data:", e);
      }
    } else {
      setPaths([]);
    }
  }, [initialData]);

  // Redraw when paths change or size changes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    paths.forEach(p => {
      if (p.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = p.isEraser ? 'rgba(0,0,0,1)' : p.color;
      ctx.lineWidth = p.size;
      
      // GlobalCompositeOperation for eraser
      if (p.isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      const start = p.points[0];
      ctx.moveTo(start.x * width, start.y * height);
      
      for (let i = 1; i < p.points.length; i++) {
        const pt = p.points[i];
        ctx.lineTo(pt.x * width, pt.y * height);
      }
      ctx.stroke();
    });
    
    // Reset composite op
    ctx.globalCompositeOperation = 'source-over';
  }, [paths, width, height]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    // Touch or Mouse
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      x: (clientX - rect.left) / width,
      y: (clientY - rect.top) / height
    };
  };

  const startDrawing = (e) => {
    if (!isActive) return;
    const pos = getPos(e);
    if (!pos) return;

    setIsDrawing(true);
    const newPath = {
      color,
      size: brushSize,
      isEraser,
      points: [pos]
    };
    setCurrentPath(newPath);
    setPaths(prev => [...prev, newPath]);
    
    // Prevent scrolling on touch
    if (e.touches) e.preventDefault();
  };

  const draw = (e) => {
    if (!isDrawing || !isActive) return;
    const pos = getPos(e);
    if (!pos) return;

    setPaths(prev => {
      const last = [...prev];
      const p = last[last.length - 1];
      p.points.push(pos);
      return last;
    });

    if (e.touches) e.preventDefault();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      onSave(JSON.stringify(paths));
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: isActive ? 100 : 5,
        cursor: isActive ? (isEraser ? 'crosshair' : 'pencil') : 'default',
        touchAction: 'none', // Critical for iPad
        pointerEvents: isActive ? 'auto' : 'none',
      }}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
    />
  );
};

export default DrawingLayer;
