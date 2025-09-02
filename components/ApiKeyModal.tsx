import React, { useState, useEffect } from 'react';
import { X, Key, Save } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
  currentApiKey: string | null;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentApiKey }) => {
  const [key, setKey] = useState('');

  useEffect(() => {
    if (currentApiKey) {
      setKey(currentApiKey);
    } else {
      setKey('');
    }
  }, [currentApiKey]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  const handleSave = () => {
    onSave(key);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <Card
        className="relative animate-in fade-in-0 zoom-in-95 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Key size={20} className={`${currentApiKey ? 'text-green-400 drop-shadow-[0_0_4px_theme(colors.green.400)]' : 'text-red-400 drop-shadow-[0_0_4px_theme(colors.red.400)]'} transition-all`} />
                    Update API Key
                </h2>
                <Button variant="icon" onClick={onClose} className="h-8 w-8 -mr-2 -mt-2">
                    <X size={20} />
                </Button>
            </div>
            <p className="text-sm text-blue-200 mb-4">
                If your current API key has reached its usage limit, you can provide a new one here. The key will be saved in your browser's local storage.
            </p>
            <div className="space-y-4">
                <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Enter your new Google AI API Key"
                    className="w-full p-3 bg-blue-900/40 border border-blue-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder:text-blue-200/50"
                    aria-label="API Key Input"
                />
                <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSave} disabled={!key.trim()}>
                        <Save size={16} className="mr-2"/>
                        Save Key
                    </Button>
                </div>
            </div>
        </div>
      </Card>
    </div>
  );
};