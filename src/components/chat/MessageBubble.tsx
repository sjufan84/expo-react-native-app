import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Message } from '../../types/message.types';

const { width: screenWidth } = Dimensions.get('window');

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
  const { theme } = useTheme();
  const colors = theme.colors as any;
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Format timestamp
  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) {
      // Today: show time only
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      // Other days: show date and time
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  // Get message status indicator
  const getStatusIndicator = (): string => {
    switch (message.status) {
      case 'sending':
        return '⏳';
      case 'sent':
        return '✓';
      case 'failed':
        return '✗';
      default:
        return '';
    }
  };

  // Get bubble background color
  const getBubbleBackgroundColor = (): string => {
    if (message.type === 'voice') {
      return isUser ? colors.primary : colors.voiceBubble || '#e8f4fd';
    }
    return isUser ? colors.primary : colors.backgroundSecondary;
  };

  // Get text color
  const getTextColor = (): string => {
    return isUser ? '#ffffff' : colors.text;
  };

  // Get message content
  const getMessageContent = (): string => {
    if (message.type === 'voice') {
      return `🎤 ${message.content}`;
    }
    if (message.type === 'image') {
      return message.imageData?.caption || message.content;
    }
    return message.content;
  };

  // Get image source URI
  const getImageUri = (): string | undefined => {
    return message.imageData?.uri || message.imageUri;
  };

  // Calculate image dimensions for bubble
  const getImageDimensions = () => {
    const maxBubbleWidth = screenWidth * 0.6;
    const maxBubbleHeight = screenWidth * 0.4;

    if (message.imageData) {
      const { width, height } = message.imageData;
      const aspectRatio = width / height;

      let displayWidth = width;
      let displayHeight = height;

      if (displayWidth > maxBubbleWidth) {
        displayWidth = maxBubbleWidth;
        displayHeight = displayWidth / aspectRatio;
      }

      if (displayHeight > maxBubbleHeight) {
        displayHeight = maxBubbleHeight;
        displayWidth = displayHeight * aspectRatio;
      }

      return { width: displayWidth, height: displayHeight };
    }

    return { width: 200, height: 150 }; // Default dimensions
  };

  // Handle image load start
  const handleImageLoadStart = () => {
    setImageLoading(true);
    setImageError(false);
  };

  // Handle image load success
  const handleImageLoadEnd = () => {
    setImageLoading(false);
    setImageError(false);
  };

  // Handle image load error
  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  // Handle image press for fullscreen view
  const handleImagePress = () => {
    if (message.type === 'image' && getImageUri()) {
      setShowFullscreenImage(true);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.messageContainer,
        isUser ? styles.userContainer : styles.agentContainer,
      ]}
      onPress={() => onPress?.(message)}
      onLongPress={() => onLongPress?.(message)}
      activeOpacity={0.8}
    >
      {/* Avatar */}
      {showAvatar && !isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: 'white' }]}>
            👨‍🍳
          </Text>
        </View>
      )}

      {/* Message Bubble */}
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.agentBubble,
          { backgroundColor: getBubbleBackgroundColor() },
        ]}
      >
        {/* Message Content */}
        {message.type === 'image' ? (
          <TouchableOpacity onPress={handleImagePress} activeOpacity={0.8}>
            {/* Image Container */}
            <View style={styles.imageContainer}>
              {imageLoading && (
                <View style={styles.imageLoadingContainer}>
                  <ActivityIndicator size="small" color={isUser ? '#ffffff' : colors.primary} />
                </View>
              )}

              {imageError ? (
                <View style={[styles.imageErrorContainer, { backgroundColor: isUser ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                  <Text style={[styles.imageErrorText, { color: isUser ? '#ffffff' : colors.textSecondary }]}>
                    🖼️ Image unavailable
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri: getImageUri() }}
                  style={[
                    styles.messageImage,
                    getImageDimensions(),
                  ]}
                  resizeMode="cover"
                  onLoadStart={handleImageLoadStart}
                  onLoadEnd={handleImageLoadEnd}
                  onError={handleImageError}
                />
              )}

              {/* Caption overlay */}
              {message.imageData?.caption && (
                <View style={[styles.captionOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                  <Text style={styles.captionText} numberOfLines={2}>
                    {message.imageData.caption}
                  </Text>
                </View>
              )}
            </View>

            {/* Image metadata text */}
            <Text
              style={[
                styles.messageText,
                { color: getTextColor(), marginTop: 4 },
              ]}
            >
              {getMessageContent()}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text
            style={[
              styles.messageText,
              { color: getTextColor() },
              message.type === 'voice' && styles.voiceMessageText,
            ]}
          >
            {getMessageContent()}
          </Text>
        )}

        {/* Timestamp and Status */}
        {(showTimestamp || message.status) && (
          <View
            style={[
              styles.footer,
              isUser ? styles.userFooter : styles.agentFooter,
            ]}
          >
            {showTimestamp && (
              <Text
                style={[
                  styles.timestamp,
                  {
                    color: isUser
                      ? 'rgba(255, 255, 255, 0.7)'
                      : colors.textSecondary,
                  },
                ]}
              >
                {formatTimestamp(message.timestamp)}
              </Text>
            )}

            {/* Status indicator for user messages */}
            {isUser && message.status && (
              <Text
                style={[
                  styles.statusIndicator,
                  {
                    color: message.status === 'failed'
                      ? '#ff4444'
                      : 'rgba(255, 255, 255, 0.7)',
                  },
                ]}
              >
                {getStatusIndicator()}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Avatar placeholder for user messages */}
      {showAvatar && isUser && <View style={styles.avatarPlaceholder} />}

      {/* Fullscreen Image Modal */}
      <Modal
        visible={showFullscreenImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFullscreenImage(false)}
      >
        <TouchableOpacity
          style={styles.fullscreenOverlay}
          activeOpacity={1}
          onPress={() => setShowFullscreenImage(false)}
        >
          <Image
            source={{ uri: getImageUri() }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowFullscreenImage(false)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 2,
    marginHorizontal: 16,
    alignItems: 'flex-end',
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  agentContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
  },
  avatarPlaceholder: {
    width: 32,
    marginLeft: 8,
  },
  bubble: {
    maxWidth: screenWidth * 0.75,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    minHeight: 40,
    justifyContent: 'center',
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  voiceMessageText: {
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  userFooter: {
    justifyContent: 'flex-end',
  },
  agentFooter: {
    justifyContent: 'flex-start',
  },
  timestamp: {
    fontSize: 11,
    lineHeight: 12,
  },
  statusIndicator: {
    fontSize: 12,
    lineHeight: 12,
  },
  // Image-related styles
  imageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  messageImage: {
    borderRadius: 8,
  },
  imageLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
  },
  imageErrorContainer: {
    width: 200,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  imageErrorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  captionText: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 16,
  },
  // Fullscreen image styles
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: screenWidth,
    height: screenWidth,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default MessageBubble;