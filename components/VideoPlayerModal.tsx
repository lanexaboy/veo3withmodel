import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface VideoPlayerModalProps {
  videoUrl: string | null;
  onClose: () => void;
  onDownload: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ videoUrl, onClose, onDownload }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!videoUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="relative animate-in fade-in-0 zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
          <button
            onClick={onDownload}
            title="Download Video"
            className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-all hover:scale-110 shadow-lg backdrop-blur-sm"
            aria-label="Download video"
          >
            <Download size={20} />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-all hover:scale-110 shadow-lg backdrop-blur-sm"
            aria-label="Close video player"
          >
            <X size={20} />
          </button>
        </div>
        <video 
          src={videoUrl} 
          controls 
          autoPlay 
          className="block rounded-lg shadow-2xl shadow-black/50 max-w-[90vw] max-h-[90vh]" 
        />
      </div>
    </div>
  );
};
