import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Film, Download, Play, Trash2, Wand2, Image as ImageIcon, Loader, Settings, Video, Maximize } from 'lucide-react';
import { VideoRenderOptions, VideoResult, ImageFile, VideoGenerationConfig, ImageRenderOptions, ImageGenerationConfig, ImageResult, HistoryItem } from './types';
import { generateVideo, fileToBase64, generateImages } from './services/geminiService';
import { Card } from './components/Card';
import { Button } from './components/Button';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';

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
  const [mode, setMode] = useState<'video' | 'image'>('video');
  const [prompt, setPrompt] = useState<string>('');
  const [promptError, setPromptError] = useState<string | null>(null);
  const [isPromptFocused, setIsPromptFocused] = useState<boolean>(false);
  const [image, setImage] = useState<ImageFile | null>(null);
  
  // Video specific state
  const [videoOptions, setVideoOptions] = useState<VideoRenderOptions>({
    aspectRatio: '16:9',
    resolution: '1080p',
    sound: true,
  });
  const [videoGenerationConfig, setVideoGenerationConfig] = useState<VideoGenerationConfig>({
    model: 'veo-3.0-generate-preview',
    numberOfVideos: 1,
  });

  // Image specific state
  const [imageOptions, setImageOptions] = useState<ImageRenderOptions>({
    aspectRatio: '1:1',
  });
  const [imageGenerationConfig, setImageGenerationConfig] = useState<ImageGenerationConfig>({
      model: 'imagen-4.0-generate-001',
      numberOfImages: 1,
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [latestResult, setLatestResult] = useState<HistoryItem | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [modalVideoData, setModalVideoData] = useState<{ url: string; prompt: string } | null>(null);
  const [modalImageData, setModalImageData] = useState<{ url: string; prompt: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const styleId = 'custom-scrollbar-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .custom-scrollbar::-webkit-scrollbar { width: 8px; }
      .custom-scrollbar::-webkit-scrollbar-track { background-color: rgba(10, 20, 35, 0.4); border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #2563eb; border-radius: 10px; border: 2px solid transparent; background-clip: content-box; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #3b82f6; }
      .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #2563eb rgba(10, 20, 35, 0.4); }
    `;
    document.head.appendChild(style);

    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

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

  const handleGenerateVideo = async () => {
    setLatestResult(null);
    let videoUrl: string | null = null;
    try {
      videoUrl = await generateVideo(prompt, image, videoOptions, videoGenerationConfig, setLoadingMessage);
      const thumbnailUrl = await generateThumbnail(videoUrl).catch(err => {
        console.error("Thumbnail generation failed:", err);
        return ''; // Fallback
      });
      
      const newVideo: VideoResult = {
        type: 'video',
        id: new Date().toISOString(),
        prompt,
        videoUrl,
        thumbnailUrl,
        timestamp: Date.now(),
      };
      setLatestResult(newVideo);
      setHistory(prev => [newVideo, ...prev]);
    } catch (error) {
      console.error(error);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      alert(error instanceof Error ? error.message : "An unknown error occurred.");
    }
  };

  const handleGenerateImage = async () => {
    setLatestResult(null);
    setLoadingMessage("Generating creative images...");
    try {
      const imageUrls = await generateImages(prompt, imageOptions, imageGenerationConfig);
      const newImages: ImageResult[] = imageUrls.map((url, index) => ({
        type: 'image',
        id: `${new Date().toISOString()}-${index}`,
        prompt,
        imageUrl: url,
        timestamp: Date.now(),
      }));

      setLatestResult(newImages[0]);
      setHistory(prev => [...newImages, ...prev]);

    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "An unknown error occurred.");
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    if (mode === 'video') {
      await handleGenerateVideo();
    } else {
      await handleGenerateImage();
    }
    setIsLoading(false);
    setLoadingMessage('');
  };
  
  const handleDownload = async (url: string, promptText: string, type: 'video' | 'image') => {
    try {
      const link = document.createElement('a');
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      link.href = blobUrl;
      const safeFilename = promptText.substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${type}_${safeFilename || 'generated'}.${type === 'video' ? 'mp4' : 'png'}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

    } catch (error) {
      console.error('Download failed:', error);
      alert('An error occurred while preparing for download.');
    }
  };
  
  const renderOptionButton = <T extends string>(
    prop: string,
    value: T,
    currentValue: T,
    setter: React.Dispatch<React.SetStateAction<any>>,
    label: string
  ) => (
    <button
      onClick={() => setter((o: any) => ({ ...o, [prop]: value }))}
      className={`px-3 py-1.5 text-xs rounded-full transition-all duration-300 w-full
        ${currentValue === value ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-100'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans bg-gradient-to-br from-blue-900 to-slate-800">
      <div className="absolute top-0 -left-1/4 w-96 h-96 sm:w-[32rem] sm:h-[32rem] lg:w-[40rem] lg:h-[40rem] bg-indigo-500/30 rounded-full filter blur-3xl opacity-50 animate-blob"></div>
      <div className="absolute top-0 -right-1/4 w-96 h-96 sm:w-[32rem] sm:h-[32rem] lg:w-[40rem] lg:h-[40rem] bg-blue-500/30 rounded-full filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-0 left-1/4 w-96 h-96 sm:w-[32rem] sm:h-[32rem] lg:w-[40rem] lg:h-[40rem] bg-sky-600/30 rounded-full filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

      <div className="relative z-10 min-h-screen px-4 sm:px-6 lg:px-8 py-6 flex items-start justify-center">
        <VideoPlayerModal 
          videoUrl={modalVideoData?.url ?? null} 
          onClose={() => setModalVideoData(null)} 
          onDownload={() => {
            if (modalVideoData) {
              handleDownload(modalVideoData.url, modalVideoData.prompt, 'video');
            }
          }}
        />
        <ImagePreviewModal
          imageData={modalImageData}
          onClose={() => setModalImageData(null)}
          onDownload={() => {
            if (modalImageData) {
              handleDownload(modalImageData.url, modalImageData.prompt, 'image');
            }
          }}
        />
        <div className="w-full">
          <header className="text-center mb-6">
            <h1 className="text-4xl sm:text-5xl font-bold text-sky-300 drop-shadow-[0_0_8px_theme(colors.sky.400)] flex items-center justify-center gap-3">
              {mode === 'video' ? <Film className="w-10 h-10 text-sky-400" /> : <ImageIcon className="w-10 h-10 text-sky-400" />}
              {mode === 'video' ? 'VEO Video Generator' : 'Imagen Image Generator'}
            </h1>
            <p className="text-blue-200 mt-2">Craft stunning {mode}s from your imagination.</p>
          </header>
          
          <div className="flex justify-center mb-8">
            <div className="bg-blue-950/20 p-1.5 rounded-full flex gap-2">
              <Button onClick={() => setMode('video')} variant={mode === 'video' ? 'primary' : 'secondary'} className="rounded-full !px-6"><Video size={16} className="mr-2"/>Video</Button>
              <Button onClick={() => setMode('image')} variant={mode === 'image' ? 'primary' : 'secondary'} className="rounded-full !px-6"><ImageIcon size={16} className="mr-2"/>Image</Button>
            </div>
          </div>

          <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-center">
            {/* Left Panel */}
            <div className="lg:col-start-2 lg:col-span-2 space-y-8 flex flex-col">
              <Card className="p-6 flex flex-col group">
                 <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg flex items-center gap-2 text-sky-400 drop-shadow-[0_0_5px_theme(colors.sky.400)]"><Wand2 size={20}/> Your Prompt</h2>
                  <span className={`text-base font-semibold text-blue-300/30 select-none transition-all group-hover:text-sky-400/80 group-hover:drop-shadow-[0_0_4px_theme(colors.sky.400)] ${isPromptFocused ? 'text-sky-400/80 drop-shadow-[0_0_4px_theme(colors.sky.400)]' : ''}`}>LANEXA</span>
                </div>
                <div className="relative h-44">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onFocus={() => setIsPromptFocused(true)}
                    onBlur={() => setIsPromptFocused(false)}
                    placeholder={mode === 'video' ? "A cinematic shot of a raccoon DJing..." : "A photorealistic image of a majestic lion..."}
                    className="w-full h-full p-3 bg-blue-900/20 border border-blue-400/20 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder:text-blue-200/50 custom-scrollbar"
                  />
                </div>
              </Card>

              {mode === 'video' && (
                <Card className="p-6 animate-in fade-in-0">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-sky-400 drop-shadow-[0_0_5px_theme(colors.sky.400)]"><ImageIcon size={20}/> Reference Image (Optional)</h3>
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
              )}

              <Button variant="primary" onClick={handleGenerate} disabled={isLoading || !prompt.trim()} className="w-full text-lg py-3">
                {isLoading ? <><Loader className="animate-spin mr-2" /> {loadingMessage || 'Generating...'}</> : `Generate ${mode === 'video' ? 'Video' : 'Image'}`}
              </Button>
            </div>

            {/* Center Panel: Preview */}
            <div className="lg:col-span-6">
              <Card className="p-6">
                {isLoading && !latestResult && (
                  <div className="flex flex-col items-center justify-center aspect-video lg:aspect-auto lg:h-[576px] bg-blue-900/20 rounded-lg">
                      <Loader size={48} className="animate-spin text-sky-400" />
                      <p className="mt-4 text-blue-200">{loadingMessage}</p>
                      <p className="text-xs text-blue-300/50 mt-1">{mode === 'video' ? 'Video generation can take a few minutes.' : 'Image generation is usually quick.'}</p>
                  </div>
                )}

                {latestResult && (
                  <div className="animate-in fade-in-0">
                    <div className="rounded-lg overflow-hidden relative group aspect-video lg:aspect-auto lg:h-[576px]">
                      {latestResult.type === 'video' ? (
                        <video key={latestResult.id} src={latestResult.videoUrl} controls className="w-full h-full object-contain" />
                      ) : (
                         <div className="w-full h-full overflow-y-auto no-scrollbar">
                           <img src={latestResult.imageUrl} alt={latestResult.prompt} className="w-full h-auto mx-auto" />
                         </div>
                      )}
                      <div className="absolute top-4 right-4 z-10">
                        {latestResult.type === 'video' && (
                           <Button variant='icon' onClick={() => handleDownload(latestResult.videoUrl, latestResult.prompt, 'video')} title="Download"><Download size={20}/></Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {!isLoading && !latestResult && (
                   <div className="flex flex-col items-center justify-center aspect-video lg:aspect-auto lg:h-[576px] text-center text-blue-300/50 bg-blue-900/20 rounded-lg">
                      {mode === 'video' ? <Film size={48} /> : <ImageIcon size={48} />}
                      <p className="mt-4">Your generated {mode} will appear here.</p>
                  </div>
                )}
              </Card>
            </div>

            {/* Right Panel: History & Options */}
            <div className="lg:col-span-2 space-y-8 flex flex-col">
              <Card className="p-6 flex flex-col">
                <h3 className="font-semibold text-xl mb-4 text-sky-400 drop-shadow-[0_0_5px_theme(colors.sky.400)]">History</h3>
                <div className="overflow-y-auto pr-2 -mr-2 custom-scrollbar flex-grow h-40">
                  {history.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {history.map(item => (
                        <div key={item.id} className="relative group bg-black rounded-lg aspect-video overflow-hidden">
                          {item.type === 'video' ? (
                            <img src={item.thumbnailUrl} alt={item.prompt} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          ) : (
                            <img src={item.imageUrl} alt={item.prompt} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-3">
                            <p className="text-xs text-white/80 truncate">{item.prompt}</p>
                          </div>
                          {item.type === 'video' && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                              <Button variant="icon" onClick={() => setModalVideoData({ url: item.videoUrl, prompt: item.prompt })}><Play className="fill-white"/></Button>
                            </div>
                          )}
                          {item.type === 'image' && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                              <Button variant="icon" onClick={() => setModalImageData({ url: item.imageUrl, prompt: item.prompt })} title="Enlarge image"><Maximize size={20}/></Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-center text-blue-300/60 h-full">
                      <p className="text-sm">No generations yet.</p>
                    </div>
                  )}
                </div>
              </Card>
               <Card className="p-6 space-y-6">
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-4 text-sky-400 drop-shadow-[0_0_5px_theme(colors.sky.400)]"><Settings size={20}/> Settings</h3>
                {mode === 'video' ? (
                  <div className="space-y-4 animate-in fade-in-0">
                    <div>
                      <label className="text-sm font-medium text-sky-400 drop-shadow-[0_0_5px_theme(colors.sky.400)] block mb-2">Model</label>
                      <select 
                          value={videoGenerationConfig.model}
                          onChange={(e) => setVideoGenerationConfig(c => ({...c, model: e.target.value as VideoGenerationConfig['model']}))}
                          className="w-full p-2 bg-blue-900/20 border border-blue-400/20 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                          <option className="bg-blue-900" value="veo-2.0-generate-001">VEO 2.0</option>
                          <option className="bg-blue-900" value="veo-3.0-generate-preview">VEO 3.0</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-sky-400 drop-shadow-[0_0_5px_theme(colors.sky.400)] block mb-2">Aspect Ratio</label>
                          <div className="flex gap-2">
                            {renderOptionButton('aspectRatio', '16:9', videoOptions.aspectRatio, setVideoOptions, '16:9')}
                            {renderOptionButton('aspectRatio', '9:16', videoOptions.aspectRatio, setVideoOptions, '9:16')}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-sky-400 drop-shadow-[0_0_5px_theme(colors.sky.400)] block mb-2">Resolution</label>
                          <div className="flex gap-2">
                            {renderOptionButton('resolution', '720p', videoOptions.resolution, setVideoOptions, '720p')}
                            {renderOptionButton('resolution', '1080p', videoOptions.resolution, setVideoOptions, '1080p')}
                          </div>
                        </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in-0">
                    <div>
                      <label className="text-sm font-medium text-sky-400 drop-shadow-[0_0_5px_theme(colors.sky.400)] block mb-2">Model</label>
                      <p className="text-sm p-2 bg-blue-900/20 border border-blue-400/20 rounded-md">Imagen 4.0</p>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-sky-400 drop-shadow-[0_0_5px_theme(colors.sky.400)] block mb-2">Aspect Ratio</label>
                        <div className="grid grid-cols-3 gap-2">
                          {renderOptionButton('aspectRatio', '1:1', imageOptions.aspectRatio, setImageOptions, '1:1')}
                          {renderOptionButton('aspectRatio', '16:9', imageOptions.aspectRatio, setImageOptions, '16:9')}
                          {renderOptionButton('aspectRatio', '9:16', imageOptions.aspectRatio, setImageOptions, '9:16')}
                          {renderOptionButton('aspectRatio', '4:3', imageOptions.aspectRatio, setImageOptions, '4:3')}
                          {renderOptionButton('aspectRatio', '3:4', imageOptions.aspectRatio, setImageOptions, '3:4')}
                        </div>
                      </div>
                  </div>
                )}
              </Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;