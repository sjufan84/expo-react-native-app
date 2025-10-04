import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SessionType, SessionState } from '../../types/message.types';

interface SessionIndicatorProps {
  sessionType: SessionType;
  sessionState: SessionState;
  isRecording?: boolean;
}

const SessionIndicator: React.FC<SessionIndicatorProps> = ({
  sessionType,
  sessionState,
  isRecording = false,
}) => {
  const { theme } = useTheme();
  const [pulseAnim] = useState(new Animated.Value(1));

  // Pulse animation for active sessions
  useEffect(() => {
    if (sessionState === 'active') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [sessionState, pulseAnim]);

  if (!sessionType || sessionState === 'idle') {
    return null;
  }

  const getSessionLabel = (): string => {
    if (sessionState === 'ending') return 'Ending...';
    
    switch (sessionType) {
      case 'text':
        return 'Text Session';
      case 'voice-ptt':
        return isRecording ? 'Recording...' : 'Push to Talk';
      case 'voice-vad':
        return isRecording ? 'Recording...' : 'Voice Active';
      default:
        return 'Active';
    }
  };

  const getSessionColor = (): string => {
    if (sessionState === 'ending') return theme.colors.textMuted;
    if (isRecording) return theme.colors.error || '#ef4444';
    return theme.colors.success || '#10b981';
  };

  const getSessionIcon = (): string => {
    if (sessionState === 'ending') return '⏹️';
    
    switch (sessionType) {
      case 'text':
        return '💬';
      case 'voice-ptt':
        return isRecording ? '🔴' : '🎙️';
      case 'voice-vad':
        return isRecording ? '🔴' : '🎤';
      default:
        return '✨';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }]}>
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: getSessionColor(),
            transform: [{ scale: sessionState === 'active' && isRecording ? pulseAnim : 1 }],
          },
        ]}
      />
      <Text style={[styles.icon]}>
        {getSessionIcon()}
      </Text>
      <Text style={[styles.label, { color: theme.colors.text }]}>
        {getSessionLabel()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    alignSelf: 'flex-start',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  icon: {
    fontSize: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default SessionIndicator;

