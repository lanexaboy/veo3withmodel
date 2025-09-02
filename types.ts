

export interface RenderOptions {
  aspectRatio: '16:9' | '9:16';
  resolution: '720p' | '1080p'; // Note: Resolution is for UI purposes, VEO API primarily uses aspectRatio.
  sound: boolean; // Note: Sound is for UI purposes, VEO API does not currently support this.
}

export interface VideoResult {
  id: string;
  prompt: string;
  videoUrl: string; // This will be a Blob URL for local playback and download
  thumbnailUrl: string; // This will be a data URL for the thumbnail
  timestamp: number;
}

export interface ImageFile {
  file: File;
  previewUrl: string;
  base64: string;
}

export interface GenerationConfig {
  model: 'veo-2.0-generate-001' | 'veo-1.0-generate-001';
  numberOfVideos: number;
}