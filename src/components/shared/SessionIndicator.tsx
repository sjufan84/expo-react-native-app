import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { SessionType, SessionState } from '../../types/message.types';
import { cn } from '../../utils/cn';

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
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (sessionState === 'active' && isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [sessionState, isRecording, pulseAnim]);

  if (!sessionType || sessionState === 'idle') {
    return null;
  }

  const getSessionLabel = (): string => {
    if (sessionState === 'ending') return 'Ending...';
    switch (sessionType) {
      case 'text': return 'Text Session';
      case 'voice-ptt': return isRecording ? 'Recording' : 'Push to Talk';
      case 'voice-vad': return isRecording ? 'Recording' : 'Voice Active';
      default: return 'Active';
    }
  };

  const getSessionIcon = (): string => {
    if (sessionState === 'ending') return '⏹️';
    switch (sessionType) {
      case 'text': return '💬';
      case 'voice-ptt':
      case 'voice-vad':
        return isRecording ? '🔴' : '🎙️';
      default: return '✨';
    }
  };

  const indicatorColorClass =
    sessionState === 'ending' ? 'bg-textMuted' :
    isRecording ? 'bg-destructive' :
    'bg-success';

  return (
    <View
      className={cn(
        'flex-row items-center gap-2 self-start rounded-full border px-3 py-1.5',
        'border-border bg-backgroundSecondary dark:border-borderDark dark:bg-backgroundSecondaryDark'
      )}
    >
      <Animated.View style={[{ transform: [{ scale: pulseAnim }] }]}>
        <View className={cn('h-2 w-2 rounded-full', indicatorColorClass)} />
      </Animated.View>
      <Text className="text-base" allowFontScaling={false}>
        {getSessionIcon()}
      </Text>
      <Text className="text-sm font-semibold text-text dark:text-textDark">
        {getSessionLabel()}
      </Text>
    </View>
  );
};

export default SessionIndicator;