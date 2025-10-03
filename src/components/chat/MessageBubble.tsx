import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
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
    return message.content;
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
        <Text
          style={[
            styles.messageText,
            { color: getTextColor() },
            message.type === 'voice' && styles.voiceMessageText,
          ]}
        >
          {getMessageContent()}
        </Text>

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
});

export default MessageBubble;