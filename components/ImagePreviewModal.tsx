import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface ImagePreviewModalProps {
  imageData: { url: string; prompt: string } | null;
  onClose: () => void;
  onDownload: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ imageData, onClose, onDownload }) => {
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

  if (!imageData) return null;

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
            title="Download Image"
            className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-all hover:scale-110 shadow-lg backdrop-blur-sm"
            aria-label="Download image"
          >
            <Download size={20} />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-all hover:scale-110 shadow-lg backdrop-blur-sm"
            aria-label="Close image preview"
          >
            <X size={20} />
          </button>
        </div>
        <img 
          src={imageData.url} 
          alt={imageData.prompt}
          className="block rounded-lg shadow-2xl shadow-black/50 max-w-[90vw] max-h-[85vh]" 
        />
        <p className="text-center text-white/80 mt-2 text-sm max-w-lg truncate">{imageData.prompt}</p>
      </div>
    </div>
  );
};
