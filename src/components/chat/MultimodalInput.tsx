import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  Text,
  KeyboardAvoidingView,
  Platform,
  Alert,
  PanResponder,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgent } from '../../context/AgentContext';
import { useVoice } from '../../hooks/useVoice';
import { ImagePickerService } from '../../services/ImagePickerService';
import { ImageResult, ProcessedImageResult } from '../../types/message.types';
import ImagePreviewModal from './ImagePreviewModal';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { Spinner } from '../ui/Spinner';

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
  const { isConnected, sendProcessedImage, session, startSession } = useAgent();
  const voice = useVoice();
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageResult | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isPressingRecord, setIsPressingRecord] = useState(false);
  const pressStartTime = useRef(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const insets = useSafeAreaInsets();

  const handlePressIn = () => {
    setIsPressingRecord(true);
    Animated.spring(scaleAnim, {
      toValue: 1.1,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    setIsPressingRecord(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && message.trim().length === 0,
      onPanResponderGrant: async () => {
        if (voice.isRecording) return;
        if (session.state === 'idle') {
          await startSession('voice-ptt', 'push-to-talk');
        }
        handlePressIn();
        pressStartTime.current = Date.now();
        voice.startRecording().catch(error => {
          console.error('Failed to start voice recording:', error);
          handlePressOut();
        });
      },
      onPanResponderRelease: () => {
        if (!voice.isRecording) return;
        handlePressOut();
        const pressDuration = Date.now() - pressStartTime.current;
        voice.stopRecording().catch(error => console.error('Failed to stop voice recording:', error));
        if (pressDuration > 300) {
          onSendVoiceMessage();
        }
      },
      onPanResponderTerminate: () => {
        if (voice.isRecording) {
          handlePressOut();
          voice.stopRecording().catch(error => console.error('Failed to stop voice recording on terminate:', error));
        }
      },
    })
  ).current;

  const handleTypingStart = useCallback(() => {
    if (!isTyping && message.trim().length > 0) {
      setIsTyping(true);
      onTypingStart?.();
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        onTypingEnd?.();
      }
    }, 1000);
  }, [isTyping, message, onTypingStart, onTypingEnd]);

  const handleTextChange = useCallback((text: string) => {
    if (text.length > maxLength) {
      Alert.alert('Message Too Long', `Maximum message length is ${maxLength} characters.`);
      return;
    }
    setMessage(text);
    if (text.trim().length > 0) {
      handleTypingStart();
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (isTyping) {
        setIsTyping(false);
        onTypingEnd?.();
      }
    }
  }, [maxLength, handleTypingStart, isTyping, onTypingEnd]);

  const handleSendMessage = useCallback(() => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please wait for the connection to be established.');
      return;
    }
    onSendMessage(trimmedMessage);
    setMessage('');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTyping) {
      setIsTyping(false);
      onTypingEnd?.();
    }
    inputRef.current?.focus();
  }, [message, isConnected, onSendMessage, isTyping, onTypingEnd]);

  const handleImageSelection = useCallback(async () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please wait for the connection to be established.');
      return;
    }
    try {
      setIsProcessingImage(true);
      const imageResult = await ImagePickerService.showImageSourceDialog();
      const validation = ImagePickerService.validateImage(imageResult);
      if (!validation.isValid) {
        Alert.alert('Invalid Image', validation.error);
        return;
      }
      setSelectedImage(imageResult);
      setShowImagePreview(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to select image';
      if (!errorMessage.includes('cancelled') && !errorMessage.includes('User cancelled')) {
        Alert.alert('Image Selection Error', errorMessage);
      }
    } finally {
      setIsProcessingImage(false);
    }
  }, [isConnected]);

  const handleSendImage = useCallback(async (processedImage: ProcessedImageResult, caption?: string) => {
    setShowImagePreview(false);
    setSelectedImage(null);
    await sendProcessedImage(processedImage, caption);
  }, [sendProcessedImage]);

  const handleCloseImagePreview = useCallback(() => {
    setShowImagePreview(false);
    setSelectedImage(null);
  }, []);

  const showSendButton = message.trim().length > 0;

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
        className="bg-background dark:bg-backgroundDark border-t border-border dark:border-borderDark"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        {voice.isRecording && (
          <View className="flex-row items-center px-4 pt-2">
            <View className="w-2 h-2 rounded-full bg-destructive mr-2" />
            <Text className="text-text dark:text-textDark font-semibold">
              Recording... {formatDuration(voice.recordingDuration)}
            </Text>
          </View>
        )}
        <View className="flex-row items-end p-3 gap-2">
          <Button
            variant="ghost"
            size="icon"
            onPress={handleImageSelection}
            disabled={disabled || isProcessingImage}
            className="bg-backgroundSecondary dark:bg-backgroundSecondaryDark rounded-full w-11 h-11"
          >
            {isProcessingImage ? <Spinner size="small" /> : <Text className="text-xl text-textSecondary dark:text-textSecondaryDark">📷</Text>}
          </Button>

          <View className="flex-1 min-h-[44px] max-h-32 justify-center rounded-2xl border border-border dark:border-borderDark bg-backgroundSecondary dark:bg-backgroundSecondaryDark px-4">
            <TextInput
              ref={inputRef}
              value={message}
              onChangeText={handleTextChange}
              onSubmitEditing={handleSendMessage}
              placeholder={placeholder}
              placeholderTextColor={'#94a3b8'}
              multiline
              maxLength={maxLength}
              editable={!disabled && !voice.isRecording}
              blurOnSubmit={false}
              returnKeyType="send"
              enablesReturnKeyAutomatically
              className="text-base text-text dark:text-textDark leading-6"
              style={{ paddingTop: 0, paddingBottom: 0 }}
            />
            {message.length > maxLength * 0.8 && (
              <Text className={cn(
                "text-xs absolute bottom-1 right-3",
                message.length >= maxLength ? "text-destructive" : "text-textSecondary dark:text-textSecondaryDark"
              )}>
                {message.length}/{maxLength}
              </Text>
            )}
          </View>

          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <View {...(!showSendButton ? panResponder.panHandlers : {})}>
              <Button
                size="icon"
                onPress={showSendButton ? handleSendMessage : undefined}
                disabled={disabled || (showSendButton && message.trim().length === 0)}
                className={cn(
                  "w-11 h-11 rounded-full",
                  showSendButton ? "bg-primary" : "bg-primary",
                  isPressingRecord && "bg-destructive"
                )}
              >
                <Text className="text-white text-xl font-bold">
                  {showSendButton ? '➤' : '🎤'}
                </Text>
              </Button>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      <ImagePreviewModal
        visible={showImagePreview}
        image={selectedImage}
        onClose={handleCloseImagePreview}
        onSend={handleSendImage}
      />
    </>
  );
};

export default MultimodalInput;