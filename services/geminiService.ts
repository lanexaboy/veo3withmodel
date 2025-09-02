import { GoogleGenAI } from "@google/genai";
import { ImageFile, VideoRenderOptions, VideoGenerationConfig, ImageRenderOptions, ImageGenerationConfig } from '../types';

// IMPORTANT: This assumes process.env.API_KEY is set in the environment.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // In a real app, you'd handle this more gracefully.
  // For this context, we'll alert the user and prevent API calls.
  console.error("API_KEY is not set. Please set the API_KEY environment variable.");
}

// Default AI client using environment variable.
const ai = new GoogleGenAI({ apiKey: API_KEY! });

// Utility to convert File to Base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};


// Update function to accept an optional apiKeyOverride.
export const generateVideo = async (
  prompt: string,
  image: ImageFile | null,
  options: VideoRenderOptions,
  config: VideoGenerationConfig,
  onProgress: (message: string) => void
): Promise<string> => {
  if (!API_KEY) {
    throw new Error("API_KEY is not configured. Please set the environment variable.");
  }
  
  onProgress("Initializing video generation...");

  const generateVideoParams: any = {
      model: config.model,
      prompt: prompt,
      config: {
          numberOfVideos: config.numberOfVideos,
          // Aspect Ratio is supported, but resolution and sound are not directly in the API.
          // This would be where you map them if the API supports it in the future.
      }
  };

  if (image) {
      generateVideoParams.image = {
          imageBytes: image.base64,
          mimeType: image.file.type,
      };
  }

  let operation = await ai.models.generateVideos(generateVideoParams);
  
  onProgress("Video processing started. This may take a few minutes...");

  let pollCount = 0;
  while (!operation.done) {
    pollCount++;
    await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
    
    const progressMessages = [
        "Analyzing prompt and image...",
        "Allocating creative resources...",
        "Compositing video frames...",
        "Rendering final output...",
        "Almost there, adding finishing touches...",
    ];
    const messageIndex = Math.min(pollCount - 1, progressMessages.length - 1);
    onProgress(progressMessages[messageIndex]);

    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  
  if (!downloadLink) {
    throw new Error("Video generation failed or returned no result.");
  }

  onProgress("Downloading video data...");
  const response = await fetch(`${downloadLink}&key=${API_KEY}`);
  if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
  }

  const videoBlob = await response.blob();
  return URL.createObjectURL(videoBlob);
};

export const generateImages = async (
    prompt: string,
    options: ImageRenderOptions,
    config: ImageGenerationConfig
): Promise<string[]> => {
    if (!API_KEY) {
        throw new Error("API_KEY is not configured. Please set the environment variable.");
    }

    const response = await ai.models.generateImages({
        model: config.model,
        prompt: prompt,
        config: {
            numberOfImages: config.numberOfImages,
            outputMimeType: 'image/png',
            aspectRatio: options.aspectRatio,
        },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error("Image generation failed or returned no result.");
    }

    return response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
};