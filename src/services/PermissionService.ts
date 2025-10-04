
import { Platform, Alert, Linking, PermissionsAndroid } from 'react-native';
import { PERMISSIONS, ERROR_MESSAGES } from '../utils/constants';

export type PermissionType = 'microphone' | 'camera' | 'photoLibrary';

export class PermissionService {
  /**
   * Check if permission is granted
   */
  static async checkPermission(permission: PermissionType): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const androidPermission = this.getAndroidPermission(permission);
        if (androidPermission) {
          const status = await PermissionsAndroid.check(
            androidPermission as typeof PermissionsAndroid.PERMISSIONS[keyof typeof PermissionsAndroid.PERMISSIONS]
          );
          return status;
        }
      }

      // iOS permissions are handled through Info.plist
      // In a real app, you'd use @react-native-async-storage/async-storage or similar
      // to track permission state
      return true;
    } catch (error) {
      console.error(`Error checking ${permission} permission:`, error);
      return false;
    }
  }

  /**
   * Request permission
   */
  static async requestPermission(permission: PermissionType): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const androidPermission = this.getAndroidPermission(permission);
        if (androidPermission) {
          const result = await PermissionsAndroid.request(androidPermission as typeof PermissionsAndroid.PERMISSIONS[keyof typeof PermissionsAndroid.PERMISSIONS], {
            title: this.getPermissionTitle(permission),
            message: this.getPermissionMessage(permission),
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          });
          return result === PermissionsAndroid.RESULTS.GRANTED;
        }
      }

      // iOS permissions are handled through Info.plist and will be requested automatically
      return true;
    } catch (error) {
      console.error(`Error requesting ${permission} permission:`, error);
      return false;
    }
  }

  /**
   * Show permission denied alert with option to open settings
   */
  static showPermissionDeniedAlert(permission: PermissionType): void {
    // const permissionName = this.getPermissionDisplayName(permission);
    const errorMessage = this.getPermissionErrorMessage(permission);

    Alert.alert(
      'Permission Required',
      errorMessage,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Settings',
          onPress: () => {
            Linking.openSettings().catch(error => {
              console.error('Error opening settings:', error);
            });
          },
        },
      ]
    );
  }

  /**
   * Show permission rationale
   */
  static showPermissionRationale(permission: PermissionType): Promise<boolean> {
    return new Promise((resolve) => {
      // const permissionName = this.getPermissionDisplayName(permission);
      const rationaleMessage = this.getPermissionRationaleMessage(permission);

      Alert.alert(
        'Permission Needed',
        rationaleMessage,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Continue',
            onPress: () => resolve(true),
          },
        ]
      );
    });
  }

  /**
   * Check and request permission with proper flow
   */
  static async ensurePermission(permission: PermissionType): Promise<boolean> {
    try {
      // Check if permission is already granted
      const hasPermission = await this.checkPermission(permission);
      if (hasPermission) {
        return true;
      }

      // Show rationale and ask user to continue
      const shouldContinue = await this.showPermissionRationale(permission);
      if (!shouldContinue) {
        return false;
      }

      // Request permission
      const granted = await this.requestPermission(permission);
      if (granted) {
        return true;
      }

      // Show denied alert
      this.showPermissionDeniedAlert(permission);
      return false;
    } catch (error) {
      console.error(`Error ensuring ${permission} permission:`, error);
      return false;
    }
  }

  /**
   * Get Android permission constant
   */
  private static getAndroidPermission(permission: PermissionType): string | null {
    switch (permission) {
      case 'microphone':
        return PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
      case 'camera':
        return PermissionsAndroid.PERMISSIONS.CAMERA;
      case 'photoLibrary':
        return PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
      default:
        return null;
    }
  }

  /**
   * Get permission title
   */
  private static getPermissionTitle(permission: PermissionType): string {
    switch (permission) {
      case 'microphone':
        return 'Microphone Access';
      case 'camera':
        return 'Camera Access';
      case 'photoLibrary':
        return 'Photo Library Access';
      default:
        return 'Permission Required';
    }
  }

  /**
   * Get permission message
   */
  private static getPermissionMessage(permission: PermissionType): string {
    switch (permission) {
      case 'microphone':
        return PERMISSIONS.microphone.message;
      case 'camera':
        return PERMISSIONS.camera.message;
      case 'photoLibrary':
        return PERMISSIONS.photoLibrary.message;
      default:
        return 'This permission is required for the app to function properly.';
    }
  }

  /**
   * Get permission display name
   */
  private static getPermissionDisplayName(permission: PermissionType): string {
    switch (permission) {
      case 'microphone':
        return 'Microphone';
      case 'camera':
        return 'Camera';
      case 'photoLibrary':
        return 'Photo Library';
      default:
        return 'Permission';
    }
  }

  /**
   * Get permission error message
   */
  private static getPermissionErrorMessage(permission: PermissionType): string {
    switch (permission) {
      case 'microphone':
        return ERROR_MESSAGES.microphone;
      case 'camera':
        return ERROR_MESSAGES.camera;
      case 'photoLibrary':
        return 'Photo library access is required to share images with BakeBot.';
      default:
        return 'This permission is required for the app to function properly.';
    }
  }

  /**
   * Get permission rationale message
   */
  private static getPermissionRationaleMessage(permission: PermissionType): string {
    switch (permission) {
      case 'microphone':
        return PERMISSIONS.microphone.message;
      case 'camera':
        return PERMISSIONS.camera.message;
      case 'photoLibrary':
        return PERMISSIONS.photoLibrary.message;
      default:
        return 'This permission is required for the app to function properly.';
    }
  }

  /**
   * Request all necessary permissions at once
   */
  static async requestAllPermissions(): Promise<{
    microphone: boolean;
    camera: boolean;
    photoLibrary: boolean;
  }> {
    const permissions = await Promise.allSettled([
      this.ensurePermission('microphone'),
      this.ensurePermission('camera'),
      this.ensurePermission('photoLibrary'),
    ]);

    return {
      microphone: permissions[0].status === 'fulfilled' ? permissions[0].value : false,
      camera: permissions[1].status === 'fulfilled' ? permissions[1].value : false,
      photoLibrary: permissions[2].status === 'fulfilled' ? permissions[2].value : false,
    };
  }

  /**
   * Check if all required permissions are granted
   */
  static async checkAllPermissions(): Promise<boolean> {
    const permissions = await Promise.allSettled([
      this.checkPermission('microphone'),
      this.checkPermission('camera'),
      this.checkPermission('photoLibrary'),
    ]);

    return permissions.every(p => p.status === 'fulfilled' && p.value);
  }
}

export default PermissionService;