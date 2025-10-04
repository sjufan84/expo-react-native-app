/**
 * Example usage of ImageProcessingService
 * This file demonstrates how to use the ImageProcessingService for various scenarios
 */

import { ImageProcessingService, ProcessingOptions, ProcessingProgress } from '../services/ImageProcessingService';
import { ImageResult } from '../types/message.types';

// Example image data (would typically come from image picker)
const exampleImage: ImageResult = {
  uri: 'file:///path/to/image.jpg',
  width: 2048,
  height: 1536,
  fileSize: 2.5 * 1024 * 1024, // 2.5MB
  type: 'image/jpeg',
};

export class ImageProcessingExamples {
  /**
   * Basic image processing with progress tracking
   */
  static async processSingleImage(image: ImageResult) {
    console.log('=== Single Image Processing Example ===');

    const options: ProcessingOptions = {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.8,
      format: 'jpeg',
      includeBase64: true,
    };

    try {
      const result = await ImageProcessingService.processImage(
        image,
        options,
        (progress: ProcessingProgress) => {
          console.log(`Progress: ${progress.stage} - ${Math.round(progress.progress * 100)}% - ${progress.message}`);
        }
      );

      console.log('Processing completed:', {
        originalSize: `${image.width}x${image.height}`,
        newSize: `${result.width}x${result.height}`,
        originalFileSize: `${(image.fileSize / 1024 / 1024).toFixed(2)}MB`,
        newFileSize: `${(result.fileSize / 1024 / 1024).toFixed(2)}MB`,
        compressionRatio: result.compressionRatio?.toFixed(2),
        hasBase64: !!result.base64,
      });

      return result;
    } catch (error) {
      console.error('Processing failed:', error);
      throw error;
    }
  }

  /**
   * Optimizing image for LiveKit transmission
   */
  static async optimizeForLiveKitTransmission(image: ImageResult) {
    console.log('=== LiveKit Optimization Example ===');

    try {
      // First optimize the image
      const optimizedImage = await ImageProcessingService.optimizeForLiveKit(
        image,
        (progress: ProcessingProgress) => {
          console.log(`LiveKit optimization: ${Math.round(progress.progress * 100)}% - ${progress.message}`);
        }
      );

      console.log('LiveKit optimization completed:', {
        size: `${optimizedImage.width}x${optimizedImage.height}`,
        fileSize: `${(optimizedImage.fileSize / 1024).toFixed(2)}KB`,
        hasBase64: !!optimizedImage.base64,
      });

      // Then chunk it for transmission
      if (optimizedImage.base64) {
        const chunkedData = ImageProcessingService.chunkImageForLiveKit(optimizedImage.base64);

        console.log('Image chunked for LiveKit:', {
          totalChunks: chunkedData.metadata.totalChunks,
          chunkSize: `${(chunkedData.metadata.chunkSize / 1024).toFixed(2)}KB`,
          originalSize: `${(chunkedData.metadata.originalSize / 1024).toFixed(2)}KB`,
          format: chunkedData.metadata.format,
        });

        // Simulate sending chunks
        for (let i = 0; i < chunkedData.chunks.length; i++) {
          console.log(`Sending chunk ${i + 1}/${chunkedData.chunks.length}`);
          // Here you would send each chunk via LiveKit data channel
          // await liveKitRoom.localParticipant.publishData(chunkedData.chunks[i], { reliable: true });
        }

        // Simulate receiving and reconstructing
        const reconstructedImage = ImageProcessingService.reconstructChunkedImage(
          chunkedData.chunks,
          chunkedData.metadata
        );

        console.log('Image reconstructed successfully');
        return { optimizedImage, chunkedData, reconstructedImage };
      }

      return { optimizedImage };
    } catch (error) {
      console.error('LiveKit optimization failed:', error);
      throw error;
    }
  }

  /**
   * Batch processing multiple images
   */
  static async batchProcessImages(images: ImageResult[]) {
    console.log('=== Batch Processing Example ===');

    const options: ProcessingOptions = {
      maxWidth: 1280,
      maxHeight: 1280,
      quality: 0.7,
      format: 'jpeg',
      includeBase64: false, // Skip base64 for batch processing to save memory
    };

    try {
      const results = await ImageProcessingService.batchProcessImages(
        images,
        options,
        (completed, total, currentImage) => {
          console.log(`Batch progress: ${completed}/${total} - Processing: ${currentImage?.split('/').pop()}`);
        }
      );

      console.log('Batch processing completed:', {
        totalProcessed: results.length,
        totalRequested: images.length,
        successRate: `${((results.length / images.length) * 100).toFixed(1)}%`,
      });

      // Clean up temporary files
      const tempUris = results.map(result => result.uri);
      await ImageProcessingService.cleanupTempFiles(tempUris);

      return results;
    } catch (error) {
      console.error('Batch processing failed:', error);
      throw error;
    }
  }

  /**
   * Processing with memory management
   */
  static async processWithMemoryManagement(image: ImageResult) {
    console.log('=== Memory Management Example ===');

    try {
      // Estimate processing time
      const estimatedTime = ImageProcessingService.estimateProcessingTime(image, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8,
      });

      console.log(`Estimated processing time: ${(estimatedTime / 1000).toFixed(1)}s`);

      // Process with progress tracking
      const result = await ImageProcessingService.processImage(
        image,
        {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.8,
          format: 'jpeg',
          includeBase64: true,
        },
        (progress: ProcessingProgress) => {
          console.log(`Memory-aware processing: ${Math.round(progress.progress * 100)}%`);
        }
      );

      // Get file information
      const fileInfo = await ImageProcessingService.getImageInfo(result.uri);
      console.log('Processed file info:', fileInfo);

      return result;
    } catch (error) {
      console.error('Memory-managed processing failed:', error);
      throw error;
    }
  }

  /**
   * Error handling example
   */
  static async demonstrateErrorHandling() {
    console.log('=== Error Handling Example ===');

    // Test with invalid image
    const invalidImage: ImageResult = {
      uri: 'file:///nonexistent/path/image.jpg',
      width: 100,
      height: 100,
      fileSize: 1024,
      type: 'image/jpeg',
    };

    try {
      await ImageProcessingService.processImage(invalidImage);
    } catch (error) {
      console.log('Expected error caught:', error instanceof Error ? error.message : error);
    }

    // Test with invalid options
    try {
      await ImageProcessingService.processImage(exampleImage, {
        maxWidth: 5000, // Invalid: exceeds max allowed
        quality: 1.5,   // Invalid: exceeds max quality
      });
    } catch (error) {
      console.log('Expected validation error caught:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Complete workflow example
   */
  static async completeWorkflow(images: ImageResult[]) {
    console.log('=== Complete Workflow Example ===');

    const tempFiles: string[] = [];

    try {
      // Step 1: Process images
      console.log('Step 1: Processing images...');
      const processedImages = await this.batchProcessImages(images);

      // Step 2: Optimize for LiveKit
      console.log('\nStep 2: Optimizing for LiveKit...');
      const liveKitPromises = processedImages.map(image =>
        this.optimizeForLiveKitTransmission(image)
      );
      const liveKitResults = await Promise.allSettled(liveKitPromises);

      // Step 3: Clean up
      console.log('\nStep 3: Cleaning up temporary files...');
      const allUris = processedImages.map(img => img.uri);
      await ImageProcessingService.cleanupTempFiles(allUris);

      console.log('Workflow completed successfully!');
      return { processedImages, liveKitResults };
    } catch (error) {
      console.error('Workflow failed:', error);

      // Ensure cleanup even on failure
      if (tempFiles.length > 0) {
        await ImageProcessingService.cleanupTempFiles(tempFiles);
      }

      throw error;
    }
  }
}

// Export for easy testing
export default ImageProcessingExamples;