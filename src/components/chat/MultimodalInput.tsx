import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  PanResponder,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAgent } from '../../context/AgentContext';
import { useVoice } from '../../hooks/useVoice';
import { ImagePickerService } from '../../services/ImagePickerService';
import { ImageResult, ProcessedImageResult } from '../../types/message.types';
import ImagePreviewModal from './ImagePreviewModal';

interface MultimodalInputProps {
  onSendMessage: (message: string) => void;
  onSendVoiceMessage: () => void;
  onTypingStart?: () => void;
  onTypingEnd?: () => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}

const MultimodalInput: React.FC<MultimodalInputProps> = ({
  onSendMessage,
  onSendVoiceMessage,
  onTypingStart,
  onTypingEnd,
  placeholder = 'Type a message...',
  maxLength = 1000,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const { isConnected, sendProcessedImage, session, startSession, sendUserTypingIndicator } = useAgent();
  const voice = useVoice();
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageResult | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isPressingRecord, setIsPressingRecord] = useState(false);
  const pressStartTime = useRef(0);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const insets = useSafeAreaInsets();

  const colors = theme.colors as any;

  // Pan responder for push-to-talk voice recording
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && message.trim().length === 0,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: async () => {
        if (voice.isRecording) return;
        
        // Start voice session if not active
        if (session.state === 'idle') {
          await startSession('voice-ptt', 'push-to-talk');
        }
        
        setIsPressingRecord(true);
        pressStartTime.current = Date.now();
        voice.startRecording().catch(error => {
          console.error('Failed to start voice recording:', error);
          setIsPressingRecord(false);
        });
      },
      onPanResponderRelease: () => {
        if (!voice.isRecording) return;

        const pressDuration = Date.now() - pressStartTime.current;
        setIsPressingRecord(false);
        voice.stopRecording().catch(error => {
          console.error('Failed to stop voice recording:', error);
        });

        if (pressDuration > 300) { // Avoid accidental taps
          onSendVoiceMessage();
        }
      },
      onPanResponderTerminate: () => {
        if (voice.isRecording) {
          setIsPressingRecord(false);
          voice.stopRecording().catch(error => {
            console.error('Failed to stop voice recording on terminate:', error);
          });
        }
      },
    })
  ).current;

  // Handle typing indicators with debouncing (500ms delay)
  const handleTypingIndicator = useCallback((isTyping: boolean) => {
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (isTyping) {
      // Send typing start indicator only if not already typing
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        sendUserTypingIndicator(true);
        onTypingStart?.();
      }

      // Set timeout to automatically stop typing after 500ms of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        sendUserTypingIndicator(false);
        onTypingEnd?.();
      }, 500);
    } else {
      // Send typing stop indicator
      isTypingRef.current = false;
      sendUserTypingIndicator(false);
      onTypingEnd?.();
    }
  }, [sendUserTypingIndicator, onTypingStart, onTypingEnd]);

  // Handle text change with debounced typing detection
  const handleTextChange = useCallback((text: string) => {
    if (text.length > maxLength) {
      // Show alert for max length
      Alert.alert('Message Too Long', `Maximum message length is ${maxLength} characters.`);
      return;
    }

    setMessage(text);

    // Trigger typing indicator if user is actually typing (non-empty text)
    const hasText = text.trim().length > 0;
    handleTypingIndicator(hasText);
  }, [maxLength, handleTypingIndicator]);

  // Handle sending message
  const handleSendMessage = useCallback(() => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    if (!isConnected) {
      Alert.alert('Not Connected', 'Please wait for the connection to be established.');
      return;
    }

    // Send the message
    onSendMessage(trimmedMessage);

    // Clear input
    setMessage('');

    // Stop typing indicator
    handleTypingIndicator(false);

    // Keep focus on input for continuous messaging
    inputRef.current?.focus();
  }, [message, isConnected, onSendMessage, handleTypingIndicator]);

  // Handle keyboard submit
  const handleKeyPress = useCallback((e: any) => {
    if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault(); // Prevent default behavior (new line)
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Clean up typing timeout on unmount
  React.useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Clear typing indicator on unmount
      if (isTypingRef.current) {
        isTypingRef.current = false;
        sendUserTypingIndicator(false);
      }
    };
  }, [sendUserTypingIndicator]);

  // Handle image selection
  const handleImageSelection = useCallback(async () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please wait for the connection to be established.');
      return;
    }

    try {
      setIsProcessingImage(true);
      const imageResult = await ImagePickerService.showImageSourceDialog();

      // Validate the image
      const validation = ImagePickerService.validateImage(imageResult);
      if (!validation.isValid) {
        Alert.alert('Invalid Image', validation.error);
        return;
      }

      setSelectedImage(imageResult);
      setShowImagePreview(true);
    } catch (error) {
      console.error('Error selecting image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to select image';

      // Don't show alert for user cancellation
      if (!errorMessage.includes('cancelled') && !errorMessage.includes('User cancelled')) {
        Alert.alert('Image Selection Error', errorMessage);
      }
    } finally {
      setIsProcessingImage(false);
    }
  }, [isConnected]);

  // Handle image sending from preview modal
  const handleSendImage = useCallback(async (processedImage: ProcessedImageResult, caption?: string) => {
    try {
      // Close the preview modal
      setShowImagePreview(false);
      setSelectedImage(null);

      // Send the image using the AgentContext
      await sendProcessedImage(processedImage, caption);

      console.log('Image sent successfully:', {
        uri: processedImage.uri,
        caption,
        size: processedImage.fileSize,
        dimensions: `${processedImage.width}x${processedImage.height}`,
      });
    } catch (error) {
      console.error('Error sending image:', error);
      // The error is already handled in AgentContext, but we can add additional UI feedback here if needed
    }
  }, [sendProcessedImage]);

  // Handle closing image preview
  const handleCloseImagePreview = useCallback(() => {
    setShowImagePreview(false);
    setSelectedImage(null);
  }, []);

  const showSendButton = message.trim().length > 0;

  const getRecordButtonColor = (): string => {
    if (!isConnected) return colors.textMuted || '#64748b';
    if (isPressingRecord) return colors.error || '#ef4444';
    return colors.primary || '#2563eb';
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      {voice.isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={[styles.redDot, { backgroundColor: colors.error }]} />
          <Text style={[styles.recordingText, { color: colors.text }]}>
            Recording... {formatDuration(voice.recordingDuration)}
          </Text>
        </View>
      )}
      <View style={styles.inputRow}>
        {/* Attachment Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border,
            },
          ]}
          onPress={handleImageSelection}
          disabled={disabled || isProcessingImage}
        >
          <Text style={[styles.buttonIcon, {
            color: isProcessingImage ? colors.primary : colors.textSecondary,
            opacity: (disabled || isProcessingImage) ? 0.5 : 1
          }]}>
            {isProcessingImage ? '⏳' : '📷'}
          </Text>
        </TouchableOpacity>

        {/* Text Input */}
        <View style={[
          styles.inputContainer,
          {
            backgroundColor: colors.backgroundSecondary,
            borderColor: disabled ? colors.border : colors.primary,
          }
        ]}>
          <TextInput
            ref={inputRef}
            style={[
              styles.textInput,
              {
                color: colors.text,
                opacity: disabled ? 0.5 : 1,
                height: Math.max(24, Math.min(120, message.split('\n').length * 22)),
              },
            ]}
            value={message}
            onChangeText={handleTextChange}
            onKeyPress={handleKeyPress}
            onSubmitEditing={handleSendMessage}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={maxLength}
            editable={!disabled && !voice.isRecording}
            blurOnSubmit={false}
            returnKeyType="send"
            enablesReturnKeyAutomatically
            textAlignVertical="center"
            autoCorrect
            autoCapitalize="sentences"
          />

          {/* Character count */}
          {message.length > maxLength * 0.8 && (
            <Text style={[
              styles.characterCount,
              {
                color: message.length >= maxLength
                  ? colors.error || '#ef4444'
                  : colors.textSecondary,
              },
            ]}>
              {message.length}/{maxLength}
            </Text>
          )}
        </View>

        {/* Dynamic Send/Record Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: showSendButton ? colors.primary : getRecordButtonColor(),
              borderColor: showSendButton ? colors.primary : colors.border,
              transform: [{ scale: isPressingRecord ? 1.1 : 1 }],
            },
          ]}
          onPress={showSendButton ? handleSendMessage : undefined}
          {...(!showSendButton ? panResponder.panHandlers : {})}
          disabled={disabled || (showSendButton && message.trim().length === 0)}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.buttonIcon,
            {
              color: 'white',
            },
          ]}>
            {showSendButton ? '➤' : '🎤'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>

    {/* Image Preview Modal */}
    <ImagePreviewModal
      visible={showImagePreview}
      image={selectedImage}
      onClose={handleCloseImagePreview}
      onSend={handleSendImage}
    />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  buttonIcon: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  inputContainer: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
    minHeight: 24,
    textAlignVertical: 'center',
    paddingTop: 0,
    paddingBottom: 0,
  },
  characterCount: {
    fontSize: 11,
    position: 'absolute',
    bottom: 4,
    right: 12,
  },
});

export default MultimodalInput;