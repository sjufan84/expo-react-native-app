import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Image } from 'expo-image';
import { Message } from '../../types/message.types';
import { cn } from '../../utils/cn';
import { Avatar, AvatarFallback, AvatarFallbackText } from '../ui/Avatar';
import { Card } from '../ui/Card';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';

interface MessageBubbleProps {
  message: Message;
  isUser: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  onPress?: (message: Message) => void;
  onLongPress?: (message: Message) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isUser,
  showAvatar = true,
  showTimestamp = true,
  onPress,
  onLongPress,
}) => {
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIndicator = (): string => {
    switch (message.status) {
      case 'sending': return '⏳';
      case 'sent': return '✓';
      case 'failed': return '✗';
      default: return '';
    }
  };

  const imageUri = message.imageData?.uri || message.imageUri;

  const handleImagePress = () => {
    if (message.type === 'image' && imageUri && !imageError) {
      setShowFullscreenImage(true);
    }
  };

  const bubbleClasses = cn(
    'max-w-[80%]',
    isUser ? 'bg-primary rounded-br-none' : 'bg-agentMessage dark:bg-agentMessageDark rounded-bl-none',
    'p-3 rounded-xl'
  );

  const textClasses = cn(
    'text-base',
    isUser ? 'text-white' : 'text-text dark:text-textDark'
  );

  return (
    <TouchableOpacity
      className={cn(
        'flex-row items-end gap-2 mx-4 my-1',
        isUser ? 'justify-end' : 'justify-start'
      )}
      onPress={() => onPress?.(message)}
      onLongPress={() => onLongPress?.(message)}
      activeOpacity={0.8}
    >
      {!isUser && showAvatar && (
        <Avatar>
          <AvatarFallback>
            <AvatarFallbackText>👨‍🍳</AvatarFallbackText>
          </AvatarFallback>
        </Avatar>
      )}

      <Card className={bubbleClasses}>
        {message.type === 'image' && imageUri ? (
          <TouchableOpacity onPress={handleImagePress} activeOpacity={0.8}>
            <View className="rounded-lg overflow-hidden relative aspect-video w-60">
              {imageLoading && (
                <View className="absolute inset-0 justify-center items-center bg-black/10">
                  <Spinner />
                </View>
              )}
              {imageError ? (
                <View className="w-full h-full justify-center items-center bg-black/5 dark:bg-white/5 rounded-lg">
                  <Text className="text-destructive text-center">🖼️{'\n'}Image unavailable</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: imageUri }}
                  className="w-full h-full"
                  contentFit="cover"
                  onLoadStart={() => setImageLoading(true)}
                  onLoadEnd={() => setImageLoading(false)}
                  onError={() => {
                    setImageLoading(false);
setImageError(true);
                  }}
                />
              )}
              {message.imageData?.caption && !imageError && (
                <View className="absolute bottom-0 p-2 bg-black/50 w-full">
                  <Text className="text-white text-xs" numberOfLines={2}>
                    {message.imageData.caption}
                  </Text>
                </View>
              )}
            </View>
            {message.content && message.content !== message.imageData?.caption && (
              <Text className={cn(textClasses, 'mt-2')}>{message.content}</Text>
            )}
          </TouchableOpacity>
        ) : (
          <Text className={textClasses}>
            {message.type === 'voice' ? `🎤 ${message.content}` : message.content}
          </Text>
        )}

        {(showTimestamp || message.status) && (
          <View className={cn('flex-row items-center gap-1 mt-1.5', isUser ? 'justify-end' : 'justify-start')}>
            {showTimestamp && (
              <Text className={cn('text-xs', isUser ? 'text-white/70' : 'text-textSecondary dark:text-textSecondaryDark')}>
                {formatTimestamp(message.timestamp)}
              </Text>
            )}
            {isUser && message.status && (
              <Text className={cn('text-xs', message.status === 'failed' ? 'text-destructive' : 'text-white/70')}>
                {getStatusIndicator()}
              </Text>
            )}
          </View>
        )}
      </Card>

      {isUser && showAvatar && <View className="w-10 h-10" />}

      <Modal
        visible={showFullscreenImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFullscreenImage(false)}
      >
        <View className="flex-1 bg-black/90 justify-center items-center">
          <Image source={{ uri: imageUri }} className="w-full h-[80%]" contentFit="contain" />
          <View className="absolute top-12 right-4">
            <Button
              variant="ghost"
              size="icon"
              onPress={() => setShowFullscreenImage(false)}
              className="bg-black/30 rounded-full"
            >
              <Text className="text-white text-2xl">✕</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
};

export default MessageBubble;