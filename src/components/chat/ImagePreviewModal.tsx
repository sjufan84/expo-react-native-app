import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageResult, ProcessedImageResult, ProcessingOptions } from '../../types/message.types';
import { ImageProcessingService } from '../../services/ImageProcessingService';
import { ImagePickerService } from '../../services/ImagePickerService';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../utils/cn';

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
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImage, setProcessedImage] = useState<ProcessedImageResult | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!visible) {
      setCaption('');
      setIsProcessing(false);
      setProcessedImage(null);
      setProcessingProgress(0);
    }
  }, [visible]);

  useEffect(() => {
    if (image) {
      const maxWidth = screenWidth - 32;
      const maxHeight = screenHeight * 0.5;
      const { width, height } = image;
      const aspectRatio = width / height;
      let displayWidth = Math.min(width, maxWidth);
      let displayHeight = displayWidth / aspectRatio;
      if (displayHeight > maxHeight) {
        displayHeight = maxHeight;
        displayWidth = displayHeight * aspectRatio;
      }
      setImageDimensions({ width: displayWidth, height: displayHeight });
    }
  }, [image]);

  useEffect(() => {
    const process = async () => {
      if (image && visible && !processedImage && !isProcessing) {
        setIsProcessing(true);
        setProcessingProgress(0);
        try {
          const options = processingOptions || {
            maxWidth: 1024,
            maxHeight: 1024,
            quality: 0.7,
            format: 'jpeg' as const,
            includeBase64: true,
          };
          const processed = await ImageProcessingService.processImage(image, options, (p) => setProcessingProgress(p));
          setProcessedImage(processed);
          setProcessingProgress(1);
        } catch (error) {
          Alert.alert('Processing Error', 'Failed to process the image.', [{ text: 'OK', onPress: onClose }]);
        } finally {
          setIsProcessing(false);
        }
      }
    };
    process();
  }, [image, visible, processedImage, isProcessing, onClose, processingOptions]);

  const handleSend = () => {
    if (processedImage) {
      onSend(processedImage, caption.trim() || undefined);
    }
  };

  if (!image || !visible) return null;
  const canSend = processedImage && !isProcessing;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View className="flex-1 bg-black/95">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <View className="flex-row items-center justify-between px-4 pb-4 border-b border-white/10" style={{ paddingTop: insets.top }}>
            <Button variant="ghost" onPress={onClose}><Text className="text-base font-semibold text-white">Cancel</Text></Button>
            <Text className="text-lg font-semibold text-white">{isProcessing ? 'Processing...' : 'Preview'}</Text>
            <Button variant="ghost" onPress={handleSend} disabled={!canSend}>
              <Text className={cn("text-base font-semibold", canSend ? "text-primary" : "text-white/50")}>Send</Text>
            </Button>
          </View>

          <View className="flex-1 items-center justify-center p-4">
            {isProcessing ? (
              <View className="items-center justify-center p-10">
                <Spinner size="large" colorKey="primary" />
                <Text className="mt-4 text-base text-center text-white">
                  Processing... {Math.round(processingProgress * 100)}%
                </Text>
              </View>
            ) : (
              <>
                <Image
                  source={{ uri: image.uri }}
                  style={{ width: imageDimensions.width, height: imageDimensions.height }}
                  className="rounded-lg bg-white/5"
                  contentFit="contain"
                />
                <View className="items-center mt-3">
                  <Text className="text-sm font-medium text-white/80">
                    {ImagePickerService.getFormattedFileSize(image.fileSize)} • {image.width}×{image.height}
                  </Text>
                  {processedImage?.compressionRatio && (
                    <Text className="mt-1 text-xs text-white/60">
                      Compressed by {Math.round((1 - processedImage.compressionRatio) * 100)}%
                    </Text>
                  )}
                </View>
              </>
            )}
          </View>

          <View className="px-4 pt-4 border-t border-white/10" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a caption..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              multiline
              maxLength={500}
              editable={!isProcessing}
              className="px-4 py-3 text-base text-white border rounded-2xl bg-white/10 border-white/20 max-h-24"
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default ImagePreviewModal;