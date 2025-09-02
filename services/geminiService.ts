import { GoogleGenAI } from "@google/genai";
import { ImageFile, RenderOptions, GenerationConfig } from '../types';

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
  options: RenderOptions,
  config: GenerationConfig,
  onProgress: (message: string) => void,
  apiKeyOverride: string | null // New parameter
): Promise<string> => {
  const effectiveApiKey = apiKeyOverride || API_KEY;
  if (!effectiveApiKey) {
    throw new Error("API_KEY is not configured. Please provide one or set the environment variable.");
  }
  
  // Use the module-level 'ai' instance if no override is provided,
  // otherwise, create a new instance with the override key.
  const geminiClient = apiKeyOverride ? new GoogleGenAI({ apiKey: apiKeyOverride }) : ai;
    
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

  // Use the determined geminiClient
  let operation = await geminiClient.models.generateVideos(generateVideoParams);
  
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

    // Use the determined geminiClient
    operation = await geminiClient.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  
  if (!downloadLink) {
    throw new Error("Video generation failed or returned no result.");
  }

  onProgress("Downloading video data...");
  // Use the effectiveApiKey for fetching the video
  const response = await fetch(`${downloadLink}&key=${effectiveApiKey}`);
  if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
  }

  const videoBlob = await response.blob();
  return URL.createObjectURL(videoBlob);
};