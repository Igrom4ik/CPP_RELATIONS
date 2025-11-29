import React from 'react';
import { Icons } from '../ui/Icons';

interface StatusBarProps {
  fileCount: number;
  linkCount: number;
  selectedFile?: string;
  aiStatus: 'idle' | 'processing' | 'error';
  aiProvider?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  fileCount,
  linkCount,
  selectedFile,
  aiStatus,
  aiProvider = 'Gemini',
}) => {
  const getAIStatusColor = () => {
    switch (aiStatus) {
      case 'processing':
        return 'text-blue-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-green-400';
    }
  };

  const getAIStatusText = () => {
    switch (aiStatus) {
      case 'processing':
        return 'Processing...';
      case 'error':
        return 'Error';
      default:
        return 'Ready';
    }
  };

  return (
    <div className="h-6 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-3 text-xs text-zinc-400 select-none">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Icons.File className="w-3 h-3" />
          <span>{fileCount} files</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Icons.Graph className="w-3 h-3" />
          <span>{linkCount} links</span>
        </div>
        {selectedFile && (
          <>
            <div className="w-px h-3 bg-zinc-700" />
            <span className="text-blue-400 font-mono truncate max-w-md">{selectedFile}</span>
          </>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${getAIStatusColor()}`} />
          <span className={getAIStatusColor()}>
            {aiProvider} · {getAIStatusText()}
          </span>
        </div>
      </div>
    </div>
  );
};
