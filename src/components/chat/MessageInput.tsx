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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAgent } from '../../context/AgentContext';
import { ImagePickerService } from '../../services/ImagePickerService';
import { ImageResult, ProcessedImageResult } from '../../types/message.types';
import ImagePreviewModal from './ImagePreviewModal';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  onTypingStart?: () => void;
  onTypingEnd?: () => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onTypingStart,
  onTypingEnd,
  placeholder = 'Type a message...',
  maxLength = 1000,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const { isConnected, sendProcessedImage } = useAgent();
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageResult | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const insets = useSafeAreaInsets();

  const colors = theme.colors as any;

  // Handle typing indicators with debouncing
  const handleTypingStart = useCallback(() => {
    if (!isTyping && message.trim().length > 0) {
      setIsTyping(true);
      onTypingStart?.();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        onTypingEnd?.();
      }
    }, 1000);
  }, [isTyping, message, onTypingStart, onTypingEnd]);

  // Handle text change
  const handleTextChange = useCallback((text: string) => {
    if (text.length > maxLength) {
      // Show alert for max length
      Alert.alert('Message Too Long', `Maximum message length is ${maxLength} characters.`);
      return;
    }

    setMessage(text);

    // Trigger typing indicator if user is actually typing
    if (text.trim().length > 0) {
      handleTypingStart();
    } else {
      // Stop typing indicator if text is empty
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        setIsTyping(false);
        onTypingEnd?.();
      }
    }
  }, [maxLength, handleTypingStart, isTyping, onTypingEnd]);

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
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTyping) {
      setIsTyping(false);
      onTypingEnd?.();
    }

    // Keep focus on input for continuous messaging
    inputRef.current?.focus();
  }, [message, isConnected, onSendMessage, isTyping, onTypingEnd]);

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
    };
  }, []);

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

  const canSend = message.trim().length > 0 && isConnected && !disabled;

  return (
    <>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom + 8, 20), // Account for Android navigation controls
        },
      ]}
    >
      <View style={styles.inputRow}>
        {/* Attachment Button */}
        <TouchableOpacity
          style={[
            styles.attachButton,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border,
            },
          ]}
          onPress={handleImageSelection}
          disabled={disabled || isProcessingImage}
        >
          <Text style={[styles.attachIcon, {
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
                opacity: disabled ? 0.5 : 1, // Ensure text is visible
                height: Math.max(24, Math.min(120, message.split('\n').length * 22)), // Dynamic height
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
            editable={!disabled}
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

        {/* Send Button */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: canSend
                ? colors.primary
                : colors.backgroundSecondary,
              borderColor: colors.border,
            },
          ]}
          onPress={handleSendMessage}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.sendIcon,
            {
              color: canSend
                ? 'white'
                : colors.textMuted,
            },
          ]}>
            ➤
          </Text>
        </TouchableOpacity>
      </View>

      {/* Connection Status in Input */}
      {!isConnected && (
        <View style={[styles.connectionStatus, { backgroundColor: colors.error || '#ef4444' }]}>
          <Text style={[styles.connectionStatusText, { color: 'white' }]}>
            🔴 Disconnected - Reconnecting...
          </Text>
        </View>
      )}
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  attachIcon: {
    fontSize: 18,
  },
  inputContainer: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120, // Limit height to prevent input from taking too much space
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10, // Balanced padding for text visibility
    justifyContent: 'center', // Center content vertically
  },
  textInput: {
    fontSize: 16,
    lineHeight: 22, // Increased line height for better spacing
    flex: 1,
    minHeight: 24, // Minimum height for single line
    textAlignVertical: 'center', // Center text vertically for better visibility
    paddingTop: 0, // Remove extra padding
    paddingBottom: 0, // Remove extra padding
  },
  characterCount: {
    fontSize: 11,
    position: 'absolute',
    bottom: 4,
    right: 12,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  sendIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  connectionStatus: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  connectionStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default MessageInput;