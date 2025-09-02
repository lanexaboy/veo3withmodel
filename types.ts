

export interface VideoRenderOptions {
  aspectRatio: '16:9' | '9:16';
  resolution: '720p' | '1080p'; // Note: Resolution is for UI purposes, VEO API primarily uses aspectRatio.
  sound: boolean; // Note: Sound is for UI purposes, VEO API does not currently support this.
}

export interface VideoResult {
  type: 'video';
  id: string;
  prompt: string;
  videoUrl: string; // This will be a Blob URL for local playback and download
  thumbnailUrl: string; // This will be a data URL for the thumbnail
  timestamp: number;
}

export interface ImageRenderOptions {
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
}

export interface ImageResult {
    type: 'image';
    id: string;
    prompt: string;
    imageUrl: string; // This will be a data URL
    timestamp: number;
}

export type HistoryItem = VideoResult | ImageResult;

export interface ImageFile {
  file: File;
  previewUrl: string;
  base64: string;
}

export interface VideoGenerationConfig {
  model: 'veo-2.0-generate-001' | 'veo-3.0-generate-preview';
  numberOfVideos: number;
}

export interface ImageGenerationConfig {
    model: 'imagen-4.0-generate-001';
    numberOfImages: number;
}