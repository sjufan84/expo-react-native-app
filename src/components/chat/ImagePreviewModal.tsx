import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { ImageResult } from '../../types/message.types';
import { ImageProcessingService, ProcessedImageResult, ProcessingOptions } from '../../services/ImageProcessingService';
import { ImagePickerService } from '../../services/ImagePickerService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ImagePreviewModalProps {
  visible: boolean;
  image: ImageResult | null;
  onClose: () => void;
  onSend: (image: ProcessedImageResult, caption?: string) => void;
  processingOptions?: ProcessingOptions;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  image,
  onClose,
  onSend,
  processingOptions,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = theme.colors as any;

  const [caption, setCaption] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImage, setProcessedImage] = useState<ProcessedImageResult | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setCaption('');
      setIsProcessing(false);
      setProcessedImage(null);
      setProcessingProgress(0);
    }
  }, [visible]);

  // Calculate image dimensions for display
  useEffect(() => {
    if (image) {
      const maxWidth = screenWidth - 32;
      const maxHeight = screenHeight * 0.6;

      const aspectRatio = image.width / image.height;
      let width = image.width;
      let height = image.height;

      if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
      }

      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }

      setImageDimensions({ width, height });
    }
  }, [image]);

  // Process image when it's selected
  useEffect(() => {
    if (image && visible && !processedImage && !isProcessing) {
      processImage();
    }
  }, [image, visible]);

  const processImage = async () => {
    if (!image) return;

    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      const progressCallback = ImageProcessingService.createProgressCallback((progress) => {
        setProcessingProgress(progress);
      });

      // Use optimized options for LiveKit if not provided
      const options = processingOptions || {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.7,
        format: 'jpeg' as const,
        includeBase64: true,
      };

      const processed = await ImageProcessingService.processImage(image, options);
      setProcessedImage(processed);
      progressCallback(1.0);
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert(
        'Processing Error',
        'Failed to process the image. Please try again with a different image.',
        [{ text: 'OK', onPress: onClose }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = () => {
    if (processedImage) {
      onSend(processedImage, caption.trim() || undefined);
    }
  };

  const handleRetake = async () => {
    try {
      const newImage = await ImagePickerService.showImageSourceDialog();
      setProcessedImage(null); // Reset processed image
      // The parent component will need to handle the new image
      // For now, we'll just close the modal
      onClose();
    } catch (error) {
      // User cancelled or error occurred
      console.log('Retake cancelled or failed:', error);
    }
  };

  const canSend = processedImage && !isProcessing;

  if (!image || !visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.9)" />

      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <Text style={[styles.headerButtonText, { color: 'white' }]}>Cancel</Text>
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: 'white' }]}>
              {isProcessing ? 'Processing...' : 'Preview'}
            </Text>

            <TouchableOpacity
              onPress={handleSend}
              style={[styles.headerButton, { opacity: canSend ? 1 : 0.5 }]}
              disabled={!canSend}
            >
              <Text
                style={[
                  styles.headerButtonText,
                  { color: canSend ? colors.primary : 'rgba(255,255,255,0.5)' }
                ]}
              >
                Send
              </Text>
            </TouchableOpacity>
          </View>

          {/* Image Display */}
          <View style={styles.imageContainer}>
            {isProcessing ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.processingText, { color: 'white' }]}>
                  Processing image... {Math.round(processingProgress * 100)}%
                </Text>
              </View>
            ) : (
              <>
                <Image
                  source={{ uri: image.uri }}
                  style={[
                    styles.previewImage,
                    {
                      width: imageDimensions.width,
                      height: imageDimensions.height,
                    },
                  ]}
                  resizeMode="contain"
                />

                {/* Image Info */}
                <View style={styles.imageInfo}>
                  <Text style={[styles.imageInfoText, { color: 'rgba(255,255,255,0.8)' }]}>
                    {ImagePickerService.getFormattedFileSize(image.fileSize)} • {image.width}×{image.height}
                  </Text>
                  {processedImage && processedImage.compressionRatio && (
                    <Text style={[styles.compressionInfo, { color: 'rgba(255,255,255,0.6)' }]}>
                      Compressed: {Math.round(processedImage.compressionRatio * 100)}% size reduction
                    </Text>
                  )}
                </View>
              </>
            )}
          </View>

          {/* Caption Input */}
          <View style={[styles.captionContainer, { paddingBottom: insets.bottom }]}>
            <TextInput
              style={[
                styles.captionInput,
                {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.2)',
                }
              ]}
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a caption..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              multiline
              maxLength={500}
              editable={!isProcessing}
              textAlignVertical="center"
            />

            {/* Retake Button */}
            <TouchableOpacity
              style={[styles.retakeButton, { borderColor: 'rgba(255,255,255,0.3)' }]}
              onPress={handleRetake}
              disabled={isProcessing}
            >
              <Text style={[styles.retakeButtonText, { color: 'rgba(255,255,255,0.8)' }]}>
                📷 Retake
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  processingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  previewImage: {
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  imageInfo: {
    marginTop: 12,
    alignItems: 'center',
  },
  imageInfoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  compressionInfo: {
    fontSize: 12,
    marginTop: 4,
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  captionInput: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    marginBottom: 12,
  },
  retakeButton: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    alignSelf: 'center',
  },
  retakeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ImagePreviewModal;