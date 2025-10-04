import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { TypingState } from '../../types/message.types';

const { width: screenWidth } = Dimensions.get('window');

interface TypingIndicatorProps {
  typingState: TypingState;
  showUserTyping?: boolean;
  isUser?: boolean;
}

interface TypingDotProps {
  delay: number;
  color: string;
}

const TypingDot: React.FC<TypingDotProps> = ({ delay, color }) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = () => {
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 600,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(() => {
        animateDot();
      });
    };

    animateDot();
  }, [animValue, delay]);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3],
  });

  return (
    <Animated.View
      style={[
        styles.typingDot,
        {
          backgroundColor: color,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    />
  );
};

const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  typingState,
  showUserTyping = false,
  isUser = false,
}) => {
  const { theme } = useTheme();
  const colors = theme.colors as any;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const shouldShow = isUser
    ? (showUserTyping && typingState.userTyping)
    : typingState.agentTyping;

  const indicatorText = isUser
    ? 'You are typing...'
    : 'BakeBot is typing...';

  const dotColor = isUser
    ? colors.primary
    : colors.secondary;

  useEffect(() => {
    if (shouldShow) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [shouldShow, fadeAnim]);

  if (!shouldShow) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.border,
        },
        isUser && styles.userContainer,
      ]}
    >
      <View style={styles.content}>
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.avatarText, { color: colors.background }]}>
              BB
            </Text>
          </View>
        )}

        <View style={[
          styles.typingBubble,
          {
            backgroundColor: isUser ? colors.primary : colors.backgroundSecondary,
            borderColor: colors.border,
          }
        ]}>
          <Text style={[
            styles.typingText,
            {
              color: isUser ? colors.background : colors.text,
            }
          ]}>
            {indicatorText}
          </Text>

          <View style={styles.typingDotsContainer}>
            <TypingDot delay={0} color={dotColor} />
            <TypingDot delay={200} color={dotColor} />
            <TypingDot delay={400} color={dotColor} />
          </View>
        </View>

        {isUser && (
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.background }]}>
              You
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: screenWidth * 0.8,
    alignSelf: 'flex-start',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
  },
  typingText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  typingDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 20,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
  },
});

export default TypingIndicator;