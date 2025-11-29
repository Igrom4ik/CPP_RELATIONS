import React, { useState, useEffect, useRef } from 'react';

interface Props {
  direction: 'horizontal' | 'vertical';
  initialSize: number | string;
  minSize?: number;
  maxSize?: number;
  children: [React.ReactNode, React.ReactNode];
  className?: string;
  gutterSize?: number;
}

const ResizableSplit: React.FC<Props> = ({ 
  direction, 
  initialSize, 
  minSize = 50, 
  maxSize = Infinity, 
  children, 
  className = "",
  gutterSize = 4
}) => {
  const [size, setSize] = useState<number | string>(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isHorizontal = direction === 'horizontal';

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      e.preventDefault();
      const containerRect = containerRef.current.getBoundingClientRect();
      
      let newSize: number;
      if (isHorizontal) {
        newSize = e.clientX - containerRect.left;
      } else {
        newSize = e.clientY - containerRect.top;
      }

      // Constrain
      const maxAvailable = isHorizontal ? containerRect.width : containerRect.height;
      const effectiveMax = Math.min(maxSize, maxAvailable - minSize);
      
      if (newSize < minSize) newSize = minSize;
      if (newSize > effectiveMax) newSize = effectiveMax;

      setSize(newSize);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isHorizontal, minSize, maxSize]);

  const firstPanelStyle: React.CSSProperties = {
    [isHorizontal ? 'width' : 'height']: typeof size === 'number' ? `${size}px` : size,
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
    position: 'relative',
    transition: isDragging ? 'none' : 'width 0.1s ease, height 0.1s ease'
  };

  return (
    <div 
      ref={containerRef} 
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} w-full h-full ${className}`}
    >
      <div style={firstPanelStyle}>
        {children[0]}
      </div>
      
      {/* Gutter */}
      <div
        className={`relative z-50 flex-shrink-0 flex items-center justify-center transition-colors
          ${isHorizontal ? 'cursor-col-resize border-l border-r border-zinc-950 hover:bg-blue-600' : 'cursor-row-resize border-t border-b border-zinc-950 hover:bg-blue-600'}
          ${isDragging ? 'bg-blue-600' : 'bg-zinc-800'}
        `}
        style={{ [isHorizontal ? 'width' : 'height']: `${gutterSize}px` }}
        onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
      >
      </div>

      <div className="flex-1 overflow-hidden relative min-w-0 min-h-0 bg-zinc-950">
        {children[1]}
      </div>
    </div>
  );
};

export default ResizableSplit;