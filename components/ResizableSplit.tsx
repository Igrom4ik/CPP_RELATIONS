import React, { useState, useEffect, useRef } from 'react';

interface Props {
  direction: 'horizontal' | 'vertical';
  initialSize: number | string; // px or %
  minSize?: number;
  maxSize?: number;
  children: [React.ReactNode, React.ReactNode]; // Exactly two children
  className?: string;
  gutterSize?: number;
}

const ResizableSplit: React.FC<Props> = ({ 
  direction, 
  initialSize, 
  minSize = 100, 
  maxSize = Infinity, 
  children, 
  className = "",
  gutterSize = 4
}) => {
  const [size, setSize] = useState<number | string>(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isHorizontal = direction === 'horizontal'; // Left | Right

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
      // If maxSize is provided use it, otherwise strictly constrain by container minus gutter
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
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isHorizontal, minSize, maxSize]);

  // Convert size to style
  const firstPanelStyle: React.CSSProperties = {
    flexBasis: typeof size === 'number' ? `${size}px` : size,
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
    position: 'relative'
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
        className={`relative z-50 flex-shrink-0 bg-[#1f2125] hover:bg-blue-500 transition-colors bg-opacity-50 flex items-center justify-center
          ${isHorizontal ? 'cursor-col-resize w-[4px] border-l border-r border-[#000]' : 'cursor-row-resize h-[4px] border-t border-b border-[#000]'}
          ${isDragging ? 'bg-blue-600' : ''}
        `}
        style={{ [isHorizontal ? 'width' : 'height']: `${gutterSize}px` }}
        onMouseDown={() => setIsDragging(true)}
      >
          {/* Handle Icon */}
          <div className={`bg-gray-500 rounded-full opacity-0 hover:opacity-100 transition-opacity ${isHorizontal ? 'w-[2px] h-4' : 'w-4 h-[2px]'}`}></div>
      </div>

      <div className="flex-1 overflow-hidden relative min-w-0 min-h-0">
        {children[1]}
      </div>
    </div>
  );
};

export default ResizableSplit;