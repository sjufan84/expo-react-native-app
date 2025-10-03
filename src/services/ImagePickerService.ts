import { Alert, Platform } from 'react-native';
import { launchCamera, launchImageLibrary, MediaType, ImagePickerResponse, Asset } from 'react-native-image-picker';
import { ImageResult } from '../types/message.types';
import { PermissionService } from './PermissionService';

export class ImagePickerService {
  private static readonly OPTIONS = {
    mediaType: 'photo' as MediaType,
    quality: 0.8 as any, // Cast to any to avoid type issues with react-native-image-picker
    maxWidth: 1920,
    maxHeight: 1920,
    includeBase64: false, // We'll handle this in ImageProcessingService
    includeExtra: true,
  };

  /**
   * Opens the camera for image capture
   */
  static async openCamera(): Promise<ImageResult> {
    try {
      // Check camera permissions first
      const hasPermission = await PermissionService.ensurePermission('camera');
      if (!hasPermission) {
        throw new Error('Camera permission is required to take photos');
      }

      return new Promise((resolve, reject) => {
        launchCamera(this.OPTIONS, (response: ImagePickerResponse) => {
          this.handleImagePickerResponse(response, resolve, reject, 'camera');
        });
      });
    } catch (error) {
      console.error('Error opening camera:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to open camera';
      throw new Error(errorMessage);
    }
  }

  /**
   * Opens the photo gallery for image selection
   */
  static async openGallery(): Promise<ImageResult> {
    try {
      // Check photo library permissions first
      const hasPermission = await PermissionService.ensurePermission('photoLibrary');
      if (!hasPermission) {
        throw new Error('Photo library permission is required to select images');
      }

      return new Promise((resolve, reject) => {
        launchImageLibrary(this.OPTIONS, (response: ImagePickerResponse) => {
          this.handleImagePickerResponse(response, resolve, reject, 'gallery');
        });
      });
    } catch (error) {
      console.error('Error opening gallery:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to open gallery';
      throw new Error(errorMessage);
    }
  }

  /**
   * Shows image source selection dialog
   */
  static async showImageSourceDialog(): Promise<ImageResult> {
    return new Promise((resolve, reject) => {
      Alert.alert(
        'Select Image',
        'Choose an image source',
        [
          {
            text: 'Camera',
            onPress: async () => {
              try {
                const result = await this.openCamera();
                resolve(result);
              } catch (error) {
                reject(error);
              }
            },
          },
          {
            text: 'Gallery',
            onPress: async () => {
              try {
                const result = await this.openGallery();
                resolve(result);
              } catch (error) {
                reject(error);
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              reject(new Error('User cancelled image selection'));
            },
          },
        ],
        { cancelable: true }
      );
    });
  }

  /**
   * Handles the response from react-native-image-picker
   */
  private static handleImagePickerResponse(
    response: ImagePickerResponse,
    resolve: (value: ImageResult) => void,
    reject: (reason?: any) => void,
    source: 'camera' | 'gallery'
  ): void {
    try {
      if (response.didCancel) {
        reject(new Error('User cancelled image selection'));
        return;
      }

      if (response.errorMessage) {
        reject(new Error(`Image picker error: ${response.errorMessage}`));
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];

        if (!asset.uri) {
          reject(new Error('No image URI received'));
          return;
        }

        // Convert ImagePickerAsset to our ImageResult interface
        const imageResult: ImageResult = {
          uri: asset.uri,
          width: asset.width || 0,
          height: asset.height || 0,
          fileSize: asset.fileSize || 0,
          type: asset.type || 'image/jpeg',
        };

        console.log(`Image selected from ${source}:`, {
          uri: imageResult.uri,
          width: imageResult.width,
          height: imageResult.height,
          fileSize: imageResult.fileSize,
          type: imageResult.type,
        });

        resolve(imageResult);
      } else {
        reject(new Error('No image selected'));
      }
    } catch (error) {
      console.error('Error handling image picker response:', error);
      reject(error);
    }
  }

  /**
   * Validates if an image is suitable for processing
   */
  static validateImage(imageResult: ImageResult): { isValid: boolean; error?: string } {
    // Check file size (max 10MB for now)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (imageResult.fileSize > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `Image size ${(imageResult.fileSize / 1024 / 1024).toFixed(1)}MB exceeds maximum allowed size of 10MB`,
      };
    }

    // Check minimum dimensions
    if (imageResult.width < 100 || imageResult.height < 100) {
      return {
        isValid: false,
        error: 'Image is too small. Minimum dimensions are 100x100 pixels.',
      };
    }

    // Check image type
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(imageResult.type.toLowerCase())) {
      return {
        isValid: false,
        error: `Unsupported image type: ${imageResult.type}. Supported types: JPEG, PNG, WebP.`,
      };
    }

    return { isValid: true };
  }

  /**
   * Gets human readable file size
   */
  static getFormattedFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Gets platform-specific camera options
   */
  private static getPlatformSpecificOptions() {
    const baseOptions = { ...this.OPTIONS };

    if (Platform.OS === 'android') {
      return {
        ...baseOptions,
        saveToPhotos: false, // Don't save to gallery automatically
      };
    }

    return baseOptions;
  }
}