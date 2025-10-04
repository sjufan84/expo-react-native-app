# ImageProcessingService

A comprehensive image processing service for the BakeBot React Native app that provides real image manipulation, compression, and optimization for various use cases including LiveKit transmission.

## Features

- **Real Image Processing**: Uses `expo-image-manipulator` for actual image resizing and compression
- **Base64 Conversion**: Converts images to base64 using `expo-file-system`
- **LiveKit Optimization**: Specialized optimization for real-time transmission with chunking
- **Progress Tracking**: Detailed progress callbacks for user feedback
- **Batch Processing**: Process multiple images with error handling
- **Memory Management**: Efficient memory usage and cleanup
- **Error Handling**: Comprehensive error handling and validation
- **Type Safety**: Full TypeScript support with proper typing

## Installation

The service requires the following dependencies:

```bash
npm install expo-file-system expo-image-manipulator --legacy-peer-deps
```

## Basic Usage

### Single Image Processing

```typescript
import { ImageProcessingService } from '../services/ImageProcessingService';
import { ImageResult } from '../types/message.types';

const imageResult: ImageResult = {
  uri: 'file:///path/to/image.jpg',
  width: 2048,
  height: 1536,
  fileSize: 2.5 * 1024 * 1024, // 2.5MB
  type: 'image/jpeg',
};

// Process with progress tracking
const processedImage = await ImageProcessingService.processImage(
  imageResult,
  {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.8,
    format: 'jpeg',
    includeBase64: true,
  },
  (progress) => {
    console.log(`${progress.stage}: ${Math.round(progress.progress * 100)}% - ${progress.message}`);
  }
);
```

### LiveKit Optimization

```typescript
// Optimize for LiveKit transmission
const liveKitImage = await ImageProcessingService.optimizeForLiveKit(
  imageResult,
  (progress) => console.log(`Optimizing: ${Math.round(progress.progress * 100)}%`)
);

// Chunk for data channel transmission
if (liveKitImage.base64) {
  const chunkedData = ImageProcessingService.chunkImageForLiveKit(liveKitImage.base64);

  // Send chunks via LiveKit
  for (const chunk of chunkedData.chunks) {
    await liveKitRoom.localParticipant.publishData(chunk, { reliable: true });
  }

  // Reconstruct on receiving end
  const reconstructedImage = ImageProcessingService.reconstructChunkedImage(
    receivedChunks,
    chunkedData.metadata
  );
}
```

### Batch Processing

```typescript
const images: ImageResult[] = [image1, image2, image3];

const results = await ImageProcessingService.batchProcessImages(
  images,
  {
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.7,
    format: 'jpeg',
    includeBase64: false, // Skip base64 for batch to save memory
  },
  (completed, total, currentImage) => {
    console.log(`Processed ${completed}/${total}: ${currentImage}`);
  }
);
```

## API Reference

### Core Methods

#### `processImage(imageResult, options?, onProgress?)`

Processes a single image with the specified options.

**Parameters:**
- `imageResult: ImageResult` - The image to process
- `options?: ProcessingOptions` - Processing options
- `onProgress?: (progress: ProcessingProgress) => void` - Progress callback

**Returns:** `Promise<ProcessedImageResult>`

#### `optimizeForLiveKit(imageResult, onProgress?)`

Optimizes an image specifically for LiveKit data channel transmission.

**Parameters:**
- `imageResult: ImageResult` - The image to optimize
- `onProgress?: (progress: ProcessingProgress) => void` - Progress callback

**Returns:** `Promise<ProcessedImageResult>`

#### `batchProcessImages(images, options?, onProgress?)`

Processes multiple images in sequence.

**Parameters:**
- `images: ImageResult[]` - Array of images to process
- `options?: ProcessingOptions` - Processing options
- `onProgress?: (completed: number, total: number, currentImage?: string) => void` - Progress callback

**Returns:** `Promise<ProcessedImageResult[]>`

#### `chunkImageForLiveKit(base64Data, chunkSize?)`

Chunks a base64 image for LiveKit data channel transmission.

**Parameters:**
- `base64Data: string` - Base64 image data
- `chunkSize?: number` - Custom chunk size (default: 16KB)

**Returns:** `ChunkedImageData`

#### `reconstructChunkedImage(chunks, metadata)`

Reconstructs a chunked image from LiveKit transmission.

**Parameters:**
- `chunks: string[]` - Array of chunk data
- `metadata: ChunkedImageData['metadata']` - Chunk metadata

**Returns:** `string` (base64 image data)

### Utility Methods

#### `cleanupTempFiles(fileUris)`

Cleans up temporary files created during processing.

#### `estimateProcessingTime(imageResult, options)`

Estimates processing time for an image in milliseconds.

#### `getImageInfo(uri)`

Gets basic image information without processing.

## Types

### ProcessingOptions

```typescript
interface ProcessingOptions {
  maxWidth?: number;      // Maximum width (default: 1920)
  maxHeight?: number;     // Maximum height (default: 1920)
  quality?: number;       // Quality 0.1-1.0 (default: 0.8)
  format?: 'jpeg' | 'png'; // Output format (default: 'jpeg')
  includeBase64?: boolean; // Include base64 data (default: true)
}
```

### ProcessingProgress

```typescript
interface ProcessingProgress {
  stage: 'validating' | 'reading' | 'processing' | 'encoding' | 'completed';
  progress: number;       // 0-1
  message?: string;       // Descriptive message
}
```

### ProcessedImageResult

```typescript
interface ProcessedImageResult {
  uri: string;           // Processed image URI
  width: number;         // New width
  height: number;        // New height
  fileSize: number;      // New file size in bytes
  type: string;          // MIME type
  base64?: string;       // Base64 data (if requested)
  compressionRatio?: number; // Compression ratio achieved
}
```

### ChunkedImageData

```typescript
interface ChunkedImageData {
  chunks: string[];
  metadata: {
    totalChunks: number;
    chunkSize: number;
    originalSize: number;
    format: string;
  };
}
```

## Constraints and Best Practices

### LiveKit Optimization

- **Max dimensions**: 1024x1024px for real-time transmission
- **Quality**: 70% for balance of quality and speed
- **Format**: JPEG for efficiency
- **Chunk size**: 16KB for reliable data channel transmission

### Memory Management

- **Max memory usage**: 50MB per processing operation
- **Cleanup**: Always clean up temporary files after batch processing
- **Base64**: Consider skipping base64 conversion in batch operations to save memory

### Error Handling

- **Validation**: All inputs are validated before processing
- **File access**: Verifies file existence and accessibility
- **Graceful degradation**: Continues processing other images in batch operations
- **Detailed errors**: Provides specific error messages for debugging

## Performance Considerations

1. **Image Size**: Larger images take longer to process
2. **Quality vs Speed**: Lower quality processes faster
3. **Memory Usage**: Monitor memory usage with large images
4. **Batch Processing**: Process images sequentially to avoid memory issues

## Examples

See `src/examples/ImageProcessingExamples.ts` for comprehensive usage examples including:
- Basic image processing
- LiveKit optimization with chunking
- Batch processing with error handling
- Memory management workflows
- Complete end-to-end examples

## Troubleshooting

### Common Issues

1. **File not found**: Ensure the image URI is accessible
2. **Memory issues**: Reduce image dimensions or quality
3. **Processing timeouts**: Use progress callbacks for user feedback
4. **Base64 errors**: Verify file system permissions

### Debug Tips

- Enable console logging to track processing stages
- Use `getImageInfo()` to verify file accessibility
- Monitor memory usage during batch operations
- Check chunk sizes for LiveKit transmission

## Dependencies

- `expo-image-manipulator`: Image manipulation operations
- `expo-file-system`: File system operations and base64 conversion
- `react-native`: Platform-specific functionality

## Platform Support

- **iOS**: Fully supported
- **Android**: Fully supported
- **Expo Go**: Not supported (requires custom development client)
- **Web**: Limited support (file system restrictions)