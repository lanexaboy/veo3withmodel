import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Film, Download, Play, Trash2, Wand2, Image as ImageIcon, Loader, Settings, Key } from 'lucide-react';
import { RenderOptions, VideoResult, ImageFile, GenerationConfig } from './types';
import { generateVideo, fileToBase64 } from './services/geminiService';
import { Card } from './components/Card';
import { Button } from './components/Button';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { ApiKeyModal } from './components/ApiKeyModal';

const sampleVideos: VideoResult[] = [];

const generateThumbnail = (videoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';

        const cleanup = () => {
            video.onloadeddata = null;
            video.onseeked = null;
            video.onerror = null;
        };

        video.onloadeddata = () => {
            video.currentTime = 1; // Seek to 1 second in
        };

        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                const targetWidth = 320;
                const scaleFactor = targetWidth / video.videoWidth;
                canvas.width = targetWidth;
                canvas.height = video.videoHeight * scaleFactor;
                
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    cleanup();
                    return reject(new Error('Could not get canvas context'));
                }
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                cleanup();
                resolve(dataUrl);
            } catch (error) {
                cleanup();
                reject(error);
            }
        };

        video.onerror = (e) => {
            cleanup();
            reject(new Error(`Failed to load video for thumbnail generation.`));
        };

        video.src = videoUrl;
    });
};


const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [promptError, setPromptError] = useState<string | null>(null);
  const [image, setImage] = useState<ImageFile | null>(null);
  const [options, setOptions] = useState<RenderOptions>({
    aspectRatio: '16:9',
    resolution: '1080p',
    sound: true,
  });
  const [generationConfig, setGenerationConfig] = useState<GenerationConfig>({
    model: 'veo-2.0-generate-001',
    numberOfVideos: 1,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [latestVideo, setLatestVideo] = useState<VideoResult | null>(null);
  const [history, setHistory] = useState<VideoResult[]>([]);
  const [modalVideoData, setModalVideoData] = useState<{ url: string; prompt: string } | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load API key from local storage on initial render
    const savedKey = localStorage.getItem('userApiKey');
    if (savedKey) {
      setUserApiKey(savedKey);
    }

    // Inject custom scrollbar styles dynamically and specifically.
    const styleId = 'custom-scrollbar-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background-color: rgba(14, 24, 41, 0.2);
        border-radius: 10px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: #38bdf8; /* sky-400 */
        border-radius: 10px;
        border: 2px solid transparent;
        background-clip: content-box;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: #7dd3fc; /* sky-300 */
      }
      /* Firefox Support */
      .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: #38bdf8 rgba(14, 24, 41, 0.2);
      }
    `;
    document.head.appendChild(style);

    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  useEffect(() => {
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.startsWith('{') || trimmedPrompt.startsWith('[')) {
      try {
        JSON.parse(trimmedPrompt);
        setPromptError(null);
      } catch (error) {
        setPromptError('Invalid JSON format.');
      }
    } else {
      setPromptError(null);
    }
  }, [prompt]);

  const handleSaveApiKey = (newKey: string) => {
    setUserApiKey(newKey);
    if (newKey) {
        localStorage.setItem('userApiKey', newKey);
    } else {
        localStorage.removeItem('userApiKey');
    }
    setIsApiKeyModalOpen(false); // Close modal on save
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (image?.previewUrl) {
          URL.revokeObjectURL(image.previewUrl);
      }
      const base64 = await fileToBase64(file);
      setImage({
        file: file,
        previewUrl: URL.createObjectURL(file),
        base64: base64,
      });
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || promptError) return;
    setIsLoading(true);
    setLatestVideo(null);
    let videoUrl: string | null = null;
    try {
      videoUrl = await generateVideo(prompt, image, options, generationConfig, setLoadingMessage, userApiKey);
      let thumbnailUrl: string;
      try {
        thumbnailUrl = await generateThumbnail(videoUrl);
      } catch (thumbError) {
        console.error("Thumbnail generation failed:", thumbError);
        thumbnailUrl = ''; // Fallback to no thumbnail
      }
      
      const newVideo: VideoResult = {
        id: new Date().toISOString(),
        prompt,
        videoUrl,
        thumbnailUrl,
        timestamp: Date.now(),
      };
      setLatestVideo(newVideo);
      setHistory(prev => [newVideo, ...prev]);
    } catch (error) {
      console.error(error);
      if (videoUrl) {
          URL.revokeObjectURL(videoUrl); // Clean up blob if process failed after blob creation
      }
      alert(error instanceof Error ? error.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };
  
  const handleDownload = async (videoUrl: string, promptText: string) => {
    try {
      const link = document.createElement('a');
      let finalUrl = videoUrl;

      // For remote URLs, fetch as a blob to bypass cross-origin download restrictions.
      if (videoUrl.startsWith('http')) {
        const response = await fetch(videoUrl);
        if (!response.ok) throw new Error('Network response was not ok.');
        const blob = await response.blob();
        finalUrl = URL.createObjectURL(blob);
      }
      
      link.href = finalUrl;
      const safeFilename = promptText.substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `veo_video_${safeFilename || 'generated'}.mp4`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // If a new blob URL was created, revoke it to free up memory.
      if (finalUrl !== videoUrl) {
        URL.revokeObjectURL(finalUrl);
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('An error occurred while preparing the video for download.');
    }
  };
  
  const handleDelete = (id: string) => {
      setHistory(prev => prev.filter(v => v.id !== id));
      const videoToDelete = history.find(v => v.id === id);
      if (videoToDelete && !videoToDelete.videoUrl.startsWith('http')) { // Don't revoke remote URLs
        URL.revokeObjectURL(videoToDelete.videoUrl);
      }
      if (latestVideo?.id === id) {
          setLatestVideo(null);
      }
  }

  const renderOptionButton = <K extends keyof Pick<RenderOptions, 'aspectRatio' | 'resolution'>>(
    prop: K,
    value: RenderOptions[K],
    currentValue: RenderOptions[K],
    label: string
  ) => (
    <button
      onClick={() => setOptions(o => ({ ...o, [prop]: value }))}
      className={`px-3 py-1.5 text-xs rounded-full transition-all duration-300 w-full
        ${currentValue === value ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-100'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans bg-gradient-to-br from-blue-900 to-slate-800">
      {/* Background Blobs */}
      <div className="absolute top-0 -left-1/4 w-96 h-96 sm:w-[32rem] sm:h-[32rem] lg:w-[40rem] lg:h-[40rem] bg-indigo-500/30 rounded-full filter blur-3xl opacity-50 animate-blob"></div>
      <div className="absolute top-0 -right-1/4 w-96 h-96 sm:w-[32rem] sm:h-[32rem] lg:w-[40rem] lg:h-[40rem] bg-blue-500/30 rounded-full filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-0 left-1/4 w-96 h-96 sm:w-[32rem] sm:h-[32rem] lg:w-[40rem] lg:h-[40rem] bg-sky-600/30 rounded-full filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen px-4 sm:px-6 lg:px-8 py-6 flex items-start justify-center">
        <VideoPlayerModal 
          videoUrl={modalVideoData?.url ?? null} 
          onClose={() => setModalVideoData(null)} 
          onDownload={() => {
            if (modalVideoData) {
              handleDownload(modalVideoData.url, modalVideoData.prompt);
            }
          }}
        />
        <ApiKeyModal 
          isOpen={isApiKeyModalOpen} 
          onClose={() => setIsApiKeyModalOpen(false)} 
          onSave={handleSaveApiKey}
          currentApiKey={userApiKey}
        />
        <div className="w-full">
          <header className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold text-white flex items-center justify-center gap-3">
              <Film className="w-10 h-10 text-sky-400" /> VEO3 Video Generator
            </h1>
            <p className="text-blue-200 mt-2">Craft stunning videos from your imagination.</p>
          </header>

          <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-start">
            {/* Left Panel: Controls */}
            <div className="lg:col-start-2 lg:col-span-2 space-y-8 flex flex-col">
              <Card className="p-6 flex flex-col">
                 <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg flex items-center gap-2"><Wand2 size={20} className="text-sky-400"/> Your Prompt</h2>
                  <span className="text-base font-semibold text-blue-300/30 select-none">LANEXA</span>
                </div>
                <div className="relative h-48">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="A cinematic shot of a raccoon DJing at a neon-lit rooftop party..."
                    className="w-full h-full p-3 bg-blue-900/20 border border-blue-400/20 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder:text-blue-200/50"
                  />
                  {promptError && <p className="text-xs text-red-400 mt-1">{promptError}</p>}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><ImageIcon size={20} className="text-sky-400"/> Reference Image (Optional)</h3>
                {image ? (
                  <div className="relative group">
                    <img src={image.previewUrl} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                      <Button variant="icon" onClick={() => setImage(null)}><Trash2 size={20} className="text-white"/></Button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()} className="w-full h-40 border-2 border-dashed border-blue-400/30 rounded-lg flex flex-col items-center justify-center text-blue-200/60 hover:border-blue-400 hover:text-blue-100 transition-colors">
                    <UploadCloud size={32} />
                    <span className="mt-2 text-sm">Click to upload</span>
                  </button>
                )}
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              </Card>

              <Button variant="primary" onClick={handleGenerate} disabled={isLoading || !prompt.trim() || !!promptError} className="w-full text-lg py-3">
                {isLoading ? <><Loader className="animate-spin mr-2" /> {loadingMessage || 'Generating...'}</> : 'Generate Video'}
              </Button>
            </div>

            {/* Center Panel: Preview */}
            <div className="lg:col-span-6">
              <Card className="p-6">
                {isLoading && !latestVideo && (
                  <div className="flex flex-col items-center justify-center aspect-video lg:aspect-auto lg:h-[512px] bg-blue-900/20 rounded-lg">
                      <Loader size={48} className="animate-spin text-sky-400" />
                      <p className="mt-4 text-blue-200">{loadingMessage}</p>
                      <p className="text-xs text-blue-300/50 mt-1">Video generation can take a few minutes.</p>
                  </div>
                )}

                {latestVideo && (
                  <div className="animate-in fade-in-0">
                    <div className="rounded-lg overflow-hidden relative group aspect-video lg:aspect-auto lg:h-[512px]">
                      <video key={latestVideo.videoUrl} src={latestVideo.videoUrl} controls className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}

                {!isLoading && !latestVideo && (
                   <div className="flex flex-col items-center justify-center aspect-video lg:aspect-auto lg:h-[512px] text-center text-blue-300/50 bg-blue-900/20 rounded-lg">
                      <Film size={48} />
                      <p className="mt-4">Your generated video will appear here.</p>
                  </div>
                )}
              </Card>
            </div>

            {/* Right Panel: History & Options */}
            <div className="lg:col-span-2 space-y-8 flex flex-col">
              <Card className="p-6 flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                  <h3 className="font-semibold text-xl">History</h3>
                  <Button variant="icon" className="h-8 w-8" title="Update API Key" onClick={() => setIsApiKeyModalOpen(true)}>
                    <Key size={16} className={`${userApiKey ? 'text-green-400 drop-shadow-[0_0_4px_theme(colors.green.400)]' : 'text-red-400 drop-shadow-[0_0_4px_theme(colors.red.400)]'} transition-all`} />
                  </Button>
                </div>
                <div className="overflow-y-auto pr-2 -mr-2 custom-scrollbar h-40">
                  {history.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {history.map(video => (
                        <div key={video.id} className="relative group bg-black rounded-lg aspect-video overflow-hidden">
                           {video.thumbnailUrl ? (
                              <img src={video.thumbnailUrl} alt={video.prompt} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-blue-900 to-slate-800 flex items-center justify-center">
                                  <Film size={24} className="text-blue-300/50" />
                              </div>
                            )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-3">
                            <p className="text-xs text-white/80 truncate">{video.prompt}</p>
                          </div>
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                            <Button variant="icon" onClick={() => setModalVideoData({ url: video.videoUrl, prompt: video.prompt })}><Play className="fill-white"/></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-center text-blue-300/60 h-full">
                      <div>
                        <Film size={32} className="mx-auto opacity-50" />
                        <p className="mt-2 text-sm">No videos generated yet.</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
               <Card className="p-6 space-y-6">
                  {/* Settings Section */}
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-4"><Settings size={20} className="text-sky-400"/> Settings</h3>
                    <div className="space-y-4">
                      <div>
                          <label htmlFor="model-select" className="text-sm font-medium text-blue-200 block mb-2">Model</label>
                          <select 
                              id="model-select" 
                              value={generationConfig.model}
                              onChange={(e) => setGenerationConfig(c => ({...c, model: e.target.value as GenerationConfig['model']}))}
                              className="w-full p-2 bg-blue-900/20 border border-blue-400/20 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                              <option className="bg-blue-900" value="veo-2.0-generate-001">VEO 2.0</option>
                              <option className="bg-blue-900" value="veo-3.0-generate-preview">VEO 3.0 Preview</option>
			      <option className="bg-blue-900" value="veo-3.0-fast-generate-preview">VEO 3.0 Fast Preview</option>
                          </select>
                      </div>
                    </div>
                  </div>

                  {/* Render Options Section */}
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">Render Options</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-blue-200 block mb-2">Aspect Ratio</label>
                        <div className="flex gap-2">
                          {renderOptionButton('aspectRatio', '16:9', options.aspectRatio, '16:9')}
                          {renderOptionButton('aspectRatio', '9:16', options.aspectRatio, '9:16')}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-blue-200 block mb-2">Resolution</label>
                        <div className="flex gap-2">
                          {renderOptionButton('resolution', '720p', options.resolution, '720p')}
                          {renderOptionButton('resolution', '1080p', options.resolution, '1080p')}
                        </div>
                      </div>
                    </div>
                  </div>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;