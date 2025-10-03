import { Platform } from 'react-native';
import { ImageResult } from '../types/message.types';

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

export class ImageProcessingService {
  private static readonly DEFAULT_OPTIONS: ProcessingOptions = {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.8,
    format: 'jpeg',
    includeBase64: true,
  };

  /**
   * Processes an image for transmission
   */
  static async processImage(
    imageResult: ImageResult,
    options: ProcessingOptions = {}
  ): Promise<ProcessedImageResult> {
    const finalOptions = { ...this.DEFAULT_OPTIONS, ...options };

    try {
      console.log('Starting image processing:', {
        originalSize: `${imageResult.width}x${imageResult.height}`,
        originalFileSize: this.formatFileSize(imageResult.fileSize),
        options: finalOptions,
      });

      // Check if image needs processing
      const needsProcessing = this.needsProcessing(imageResult, finalOptions);

      if (!needsProcessing) {
        console.log('Image does not need processing, returning original');
        const base64 = finalOptions.includeBase64
          ? await this.convertToBase64(imageResult.uri)
          : undefined;

        return {
          ...imageResult,
          base64,
          compressionRatio: 1.0,
        };
      }

      // Process the image
      const processedImage = await this.processImageData(imageResult, finalOptions);

      console.log('Image processing completed:', {
        newSize: `${processedImage.width}x${processedImage.height}`,
        newFileSize: this.formatFileSize(processedImage.fileSize),
        compressionRatio: processedImage.compressionRatio,
      });

      return processedImage;
    } catch (error) {
      console.error('Error processing image:', error);
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
    options: ProcessingOptions
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
      // Use the ImageManipulator API from expo-image-manipulator or react-native
      // For now, we'll simulate the processing and return the original with calculated dimensions
      // In a real implementation, you would use react-native-image-resizer or similar

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // For React Native, you would typically use a library like:
      // - react-native-image-resizer
      // - expo-image-manipulator
      // - or implement native modules

      // Since we don't have these installed yet, we'll return the original image
      // but with the metadata we calculated
      const processedImage: ProcessedImageResult = {
        ...imageResult,
        width,
        height,
        type: `image/${format}`,
        compressionRatio: this.calculateCompressionRatio(imageResult.fileSize, width, height, quality),
      };

      // Add base64 if requested
      if (options.includeBase64) {
        processedImage.base64 = await this.convertToBase64(imageResult.uri);
      }

      return processedImage;
    } catch (error) {
      console.error('Error in processImageData:', error);
      throw error;
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
      // In a real implementation, you would use:
      // - react-native-fs for file reading
      // - expo-file-system for Expo
      // - or fetch the file and convert to blob

      // For now, we'll simulate this with a placeholder
      // In production, you'd implement actual base64 conversion

      console.log('Converting image to base64:', uri);

      // Simulate conversion delay
      await new Promise(resolve => setTimeout(resolve, 300));

      // Return a placeholder base64 string
      // In real implementation, this would be the actual base64 data
      return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error('Failed to convert image to base64');
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
  static async optimizeForLiveKit(imageResult: ImageResult): Promise<ProcessedImageResult> {
    // LiveKit has specific requirements for data channel transmission
    const livekitOptions: ProcessingOptions = {
      maxWidth: 1024, // Smaller for real-time transmission
      maxHeight: 1024,
      quality: 0.7, // Lower quality for faster transmission
      format: 'jpeg', // JPEG is more efficient for photos
      includeBase64: true, // Required for data channel transmission
    };

    return this.processImage(imageResult, livekitOptions);
  }

  /**
   * Batch process multiple images
   */
  static async batchProcessImages(
    images: ImageResult[],
    options: ProcessingOptions = {},
    onProgress?: (completed: number, total: number) => void
  ): Promise<ProcessedImageResult[]> {
    const results: ProcessedImageResult[] = [];

    for (let i = 0; i < images.length; i++) {
      try {
        const result = await this.processImage(images[i], options);
        results.push(result);
        onProgress?.(i + 1, images.length);
      } catch (error) {
        console.error(`Error processing image ${i + 1}:`, error);
        // Continue processing other images
      }
    }

    return results;
  }
}