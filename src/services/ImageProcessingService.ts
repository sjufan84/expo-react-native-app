/* eslint-disable @typescript-eslint/no-explicit-any */
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { ImageResult } from '../types/message.types';
import { handleError } from '../utils/errorRecovery';
import { createErrorContext } from '../types/error.types';

export interface ProcessedImageResult {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
  type: string;
  base64?: string;
  compressionRatio?: number;
}

export interface ProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png';
  includeBase64?: boolean;
}

export interface ProcessingProgress {
  stage: 'validating' | 'reading' | 'processing' | 'encoding' | 'completed';
  progress: number; // 0-1
  message?: string;
}

export interface ChunkedImageData {
  chunks: string[];
  metadata: {
    totalChunks: number;
    chunkSize: number;
    originalSize: number;
    format: string;
  };
}

export class ImageProcessingService {
  private static readonly DEFAULT_OPTIONS: ProcessingOptions = {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.8,
    format: 'jpeg',
    includeBase64: true,
  };

  private static readonly LIVEKIT_MAX_CHUNK_SIZE = 16384; // 16KB chunks for LiveKit data channel
  private static readonly MAX_MEMORY_USAGE = 50 * 1024 * 1024; // 50MB max memory usage

  /**
   * Processes an image for transmission
   */
  static async processImage(
    imageResult: ImageResult,
    options: ProcessingOptions = {},
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessedImageResult> {
    const finalOptions = { ...this.DEFAULT_OPTIONS, ...options };

    try {
      this.validateOptions(finalOptions);

      this.reportProgress(onProgress, {
        stage: 'validating',
        progress: 0.1,
        message: 'Validating image and options...',
      });

      console.log('Starting image processing:', {
        originalSize: `${imageResult.width}x${imageResult.height}`,
        originalFileSize: this.formatFileSize(imageResult.fileSize),
        options: finalOptions,
      });

      // Validate image file exists and is accessible
      await this.validateImageFile(imageResult.uri);

      this.reportProgress(onProgress, {
        stage: 'reading',
        progress: 0.2,
        message: 'Reading image file...',
      });

      // Check if image needs processing
      const needsProcessing = this.needsProcessing(imageResult, finalOptions);

      if (!needsProcessing) {
        console.log('Image does not need processing, returning original');

        this.reportProgress(onProgress, {
          stage: 'encoding',
          progress: 0.7,
          message: 'Encoding image...',
        });

        const base64 = finalOptions.includeBase64
          ? await this.convertToBase64(imageResult.uri)
          : undefined;

        const actualFileSize = await this.getFileSize(imageResult.uri);

        this.reportProgress(onProgress, {
          stage: 'completed',
          progress: 1.0,
          message: 'Processing completed',
        });

        return {
          ...imageResult,
          fileSize: actualFileSize,
          base64,
          compressionRatio: 1.0,
        };
      }

      // Process the image
      const processedImage = await this.processImageData(imageResult, finalOptions, onProgress);

      console.log('Image processing completed:', {
        newSize: `${processedImage.width}x${processedImage.height}`,
        newFileSize: this.formatFileSize(processedImage.fileSize),
        compressionRatio: processedImage.compressionRatio,
      });

      this.reportProgress(onProgress, {
        stage: 'completed',
        progress: 1.0,
        message: 'Processing completed',
      });

      return processedImage;
    } catch (error) {
      console.error('Error processing image:', error);

      // Handle error through recovery system
      const errorContext = createErrorContext(
        'processImage',
        'ImageProcessingService',
        {
          imageUri: imageResult.uri,
          originalSize: `${imageResult.width}x${imageResult.height}`,
          originalFileSize: imageResult.fileSize,
          options: finalOptions,
          platform: Platform.OS
        }
      );

      const appError = await handleError(error as Error, 'processImage', 'ImageProcessingService', {
        imageUri: imageResult.uri,
        originalSize: `${imageResult.width}x${imageResult.height}`,
        originalFileSize: imageResult.fileSize,
        options: finalOptions,
        platform: Platform.OS
      });
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Determines if an image needs processing
   */
  private static needsProcessing(imageResult: ImageResult, options: ProcessingOptions): boolean {
    const { maxWidth = 1920, maxHeight = 1920, quality = 0.8 } = options;

    // Check dimensions
    if (imageResult.width > maxWidth || imageResult.height > maxHeight) {
      return true;
    }

    // Check file size (if larger than 1MB, probably worth compressing)
    const MAX_SIZE_FOR_COMPRESSION = 1024 * 1024; // 1MB
    if (imageResult.fileSize > MAX_SIZE_FOR_COMPRESSION && quality < 1.0) {
      return true;
    }

    return false;
  }

  /**
   * Processes the image data (resize, compress, format conversion)
   */
  private static async processImageData(
    imageResult: ImageResult,
    options: ProcessingOptions,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessedImageResult> {
    const { maxWidth = 1920, maxHeight = 1920, quality = 0.8, format = 'jpeg' } = options;

    // Calculate new dimensions maintaining aspect ratio
    const { width, height } = this.calculateNewDimensions(
      imageResult.width,
      imageResult.height,
      maxWidth,
      maxHeight
    );

    try {
      this.reportProgress(onProgress, {
        stage: 'processing',
        progress: 0.5,
        message: `Resizing image to ${width}x${height}...`,
      });

      // Check memory usage before processing
      const estimatedMemoryUsage = width * height * 4; // 4 bytes per pixel (RGBA)
      if (estimatedMemoryUsage > this.MAX_MEMORY_USAGE) {
        console.warn('High memory usage estimated, proceeding with caution');
      }

      // Use expo-image-manipulator for actual image processing
      const manipResult = await ImageManipulator.manipulateAsync(
        imageResult.uri,
        [
          {
            resize: {
              width,
              height,
            },
          },
        ],
        {
          compress: quality,
          format: format === 'jpeg' ? ('jpeg' as any) : ('png' as any),
          base64: options.includeBase64 || false,
        }
      );

      if (!manipResult) {
        throw new Error('Image manipulation returned null result');
      }

      // Get the actual file size
      const fileSize = await this.getFileSize(manipResult.uri);

      this.reportProgress(onProgress, {
        stage: 'encoding',
        progress: 0.8,
        message: 'Finalizing image...',
      });

      const processedImage: ProcessedImageResult = {
        uri: manipResult.uri,
        width: manipResult.width,
        height: manipResult.height,
        fileSize,
        type: `image/${format}`,
        base64: manipResult.base64 || undefined,
        compressionRatio: this.calculateCompressionRatio(imageResult.fileSize, width, height, quality),
      };

      // Convert to base64 if not already done by ImageManipulator
      if (options.includeBase64 && !processedImage.base64) {
        processedImage.base64 = await this.convertToBase64(manipResult.uri);
      }

      return processedImage;
    } catch (error) {
      console.error('Error in processImageData:', error);
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculates new dimensions maintaining aspect ratio
   */
  private static calculateNewDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    // If image is already within bounds, return original dimensions
    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return { width: originalWidth, height: originalHeight };
    }

    // Calculate aspect ratio
    const aspectRatio = originalWidth / originalHeight;

    let newWidth = originalWidth;
    let newHeight = originalHeight;

    // First check width
    if (originalWidth > maxWidth) {
      newWidth = maxWidth;
      newHeight = Math.round(maxWidth / aspectRatio);
    }

    // Then check height (might need further adjustment)
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = Math.round(maxHeight * aspectRatio);
    }

    return { width: newWidth, height: newHeight };
  }

  /**
   * Estimates compression ratio
   */
  private static calculateCompressionRatio(
    originalFileSize: number,
    newWidth: number,
    newHeight: number,
    quality: number
  ): number {
    // Estimate new file size based on dimensions and quality
    const pixelRatio = (newWidth * newHeight) / (1000 * 1000); // Megapixels
    const estimatedNewSize = pixelRatio * 0.5 * 1024 * 1024 * quality; // Rough estimate
    return Math.min(originalFileSize / estimatedNewSize, 10); // Cap at 10x compression
  }

  /**
   * Converts image URI to base64
   */
  private static async convertToBase64(uri: string): Promise<string> {
    try {
      console.log('Converting image to base64:', uri);

      // Check if the URI is a base64 string already
      if (uri.startsWith('data:image/')) {
        return uri;
      }

      // Read the file as base64 using expo-file-system
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64' as any,
      });

      // Determine the image type from the URI
      const fileExtension = uri.split('.').pop()?.toLowerCase() || 'jpeg';
      const mimeType = this.getMimeTypeFromExtension(fileExtension);

      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error(`Failed to convert image to base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates processing options
   */
  private static validateOptions(options: ProcessingOptions): void {
    const { maxWidth, maxHeight, quality, format } = options;

    if (maxWidth && (maxWidth < 100 || maxWidth > 4096)) {
      throw new Error('maxWidth must be between 100 and 4096 pixels');
    }

    if (maxHeight && (maxHeight < 100 || maxHeight > 4096)) {
      throw new Error('maxHeight must be between 100 and 4096 pixels');
    }

    if (quality && (quality < 0.1 || quality > 1.0)) {
      throw new Error('quality must be between 0.1 and 1.0');
    }

    if (format && !['jpeg', 'png'].includes(format)) {
      throw new Error('format must be either "jpeg" or "png"');
    }
  }

  /**
   * Validates that the image file exists and is accessible
   */
  private static async validateImageFile(uri: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);

      if (!fileInfo.exists) {
        throw new Error(`Image file does not exist: ${uri}`);
      }

      if ((fileInfo as any).size === 0) {
        throw new Error(`Image file is empty: ${uri}`);
      }

      // Check if it's a readable file
      if (!fileInfo.uri) {
        throw new Error(`Invalid image URI: ${uri}`);
      }

      console.log('Image file validation successful:', {
        uri,
        size: this.formatFileSize((fileInfo as any).size || 0),
      });
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to validate image file: ${uri}`);
    }
  }

  /**
   * Gets the actual file size for a given URI
   */
  private static async getFileSize(uri: string): Promise<number> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      return (fileInfo as any).size || 0;
    } catch (error) {
      console.warn('Failed to get file size:', error);
      return 0;
    }
  }

  /**
   * Gets MIME type from file extension
   */
  private static getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'webp': 'image/webp',
    };

    return mimeTypes[extension] || 'image/jpeg';
  }

  /**
   * Reports progress to the callback
   */
  private static reportProgress(
    onProgress?: (progress: ProcessingProgress) => void,
    progress?: ProcessingProgress
  ): void {
    if (onProgress && progress) {
      try {
        onProgress(progress);
      } catch (error) {
        console.warn('Error reporting progress:', error);
      }
    }
  }

  /**
   * Gets processing progress callback
   */
  static createProgressCallback(onProgress?: (progress: number) => void) {
    return (progress: number) => {
      console.log(`Image processing progress: ${Math.round(progress * 100)}%`);
      onProgress?.(progress);
    };
  }

  /**
   * Formats file size for display
   */
  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Optimizes image for LiveKit transmission
   */
  static async optimizeForLiveKit(
    imageResult: ImageResult,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessedImageResult> {
    // LiveKit has specific requirements for data channel transmission
    const livekitOptions: ProcessingOptions = {
      maxWidth: 1024, // Smaller for real-time transmission
      maxHeight: 1024,
      quality: 0.7, // Lower quality for faster transmission
      format: 'jpeg', // JPEG is more efficient for photos
      includeBase64: true, // Required for data channel transmission
    };

    return this.processImage(imageResult, livekitOptions, onProgress);
  }

  /**
   * Chunks a base64 image for LiveKit data channel transmission
   */
  static chunkImageForLiveKit(base64Data: string, chunkSize?: number): ChunkedImageData {
    const actualChunkSize = chunkSize || this.LIVEKIT_MAX_CHUNK_SIZE;

    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

    // Determine format from the original base64 data
    const formatMatch = base64Data.match(/data:image\/([a-z]+);base64,/);
    const format = formatMatch ? formatMatch[1] : 'jpeg';

    // Split into chunks
    const chunks: string[] = [];
    for (let i = 0; i < base64Content.length; i += actualChunkSize) {
      chunks.push(base64Content.substring(i, i + actualChunkSize));
    }

    return {
      chunks,
      metadata: {
        totalChunks: chunks.length,
        chunkSize: actualChunkSize,
        originalSize: base64Content.length,
        format,
      },
    };
  }

  /**
   * Reconstructs a chunked image from LiveKit transmission
   */
  static reconstructChunkedImage(
    chunks: string[],
    metadata: ChunkedImageData['metadata']
  ): string {
    if (chunks.length !== metadata.totalChunks) {
      throw new Error(`Expected ${metadata.totalChunks} chunks, received ${chunks.length}`);
    }

    const base64Content = chunks.join('');
    return `data:image/${metadata.format};base64,${base64Content}`;
  }

  /**
   * Batch process multiple images
   */
  static async batchProcessImages(
    images: ImageResult[],
    options: ProcessingOptions = {},
    onProgress?: (completed: number, total: number, currentImage?: string) => void
  ): Promise<ProcessedImageResult[]> {
    const results: ProcessedImageResult[] = [];
    const errors: Array<{ index: number; error: Error }> = [];

    for (let i = 0; i < images.length; i++) {
      try {
        const imageResult = images[i];
        console.log(`Processing image ${i + 1}/${images.length}:`, imageResult.uri);

        const result = await this.processImage(
          imageResult,
          options,
          (progress) => {
            const overallProgress = (i + progress.progress) / images.length;
            console.log(`Batch processing progress: ${Math.round(overallProgress * 100)}%`);
          }
        );

        results.push(result);
        onProgress?.(i + 1, images.length, imageResult.uri);
      } catch (error) {
        console.error(`Error processing image ${i + 1}:`, error);
        errors.push({ index: i, error: error instanceof Error ? error : new Error('Unknown error') });
        // Continue processing other images
      }
    }

    if (errors.length > 0) {
      console.warn(`Batch processing completed with ${errors.length} errors:`, errors);
      // Optionally throw an error if all images failed
      if (results.length === 0) {
        throw new Error('All images failed to process');
      }
    }

    console.log(`Batch processing completed: ${results.length}/${images.length} images processed successfully`);
    return results;
  }

  /**
   * Cleans up temporary files created during processing
   */
  static async cleanupTempFiles(fileUris: string[]): Promise<void> {
    const cleanupPromises = fileUris.map(async (uri) => {
      try {
        // Only clean up files in the cache directory
        if (uri.includes('Cache/') || uri.includes('tmp/')) {
          const fileInfo = await FileSystem.getInfoAsync(uri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(uri);
            console.log('Cleaned up temporary file:', uri);
          }
        }
      } catch (error) {
        console.warn('Failed to clean up temporary file:', uri, error);
      }
    });

    await Promise.allSettled(cleanupPromises);
  }

  /**
   * Estimates processing time for an image
   */
  static estimateProcessingTime(imageResult: ImageResult, options: ProcessingOptions): number {
    const { width, height, fileSize } = imageResult;
    const { quality = 0.8 } = options;

    // Base time in milliseconds
    let baseTime = 1000;

    // Factor in image size
    const megapixels = (width * height) / (1000 * 1000);
    baseTime += megapixels * 500;

    // Factor in file size
    const fileSizeMB = fileSize / (1024 * 1024);
    baseTime += fileSizeMB * 1000;

    // Factor in compression (lower quality = faster)
    baseTime *= (2.0 - quality);

    // Add buffer for safety
    return baseTime * 1.2;
  }

  /**
   * Gets image information without processing
   */
  static async getImageInfo(uri: string): Promise<{
    width: number;
    height: number;
    fileSize: number;
    type: string;
    exists: boolean;
  }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);

      if (!fileInfo.exists) {
        return {
          width: 0,
          height: 0,
          fileSize: 0,
          type: 'unknown',
          exists: false,
        };
      }

      // For detailed image info, we'd need to parse the image headers
      // For now, return basic file info
      return {
        width: 0, // Would need image parsing library
        height: 0, // Would need image parsing library
        fileSize: (fileInfo as any).size || 0,
        type: this.getMimeTypeFromExtension(uri.split('.').pop() || 'jpg'),
        exists: true,
      };
    } catch (error) {
      console.error('Error getting image info:', error);
      return {
        width: 0,
        height: 0,
        fileSize: 0,
        type: 'unknown',
        exists: false,
      };
    }
  }
}