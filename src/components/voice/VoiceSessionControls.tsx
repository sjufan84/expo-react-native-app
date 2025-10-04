import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAgent } from '../../context/AgentContext';
import { useVoice } from '../../hooks/useVoice';

interface VoiceSessionControlsProps {
  onEndSession: () => void;
}

const VoiceSessionControls: React.FC<VoiceSessionControlsProps> = ({ onEndSession }) => {
  const { theme } = useTheme();
  const { session, updateSession } = useAgent();
  const voice = useVoice();

  const formatDuration = (startTime: Date | null): string => {
    if (!startTime) return '0:00';
    const seconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleToggleMute = () => {
    const newMutedState = !session.isMuted;
    updateSession({ isMuted: newMutedState });
    voice.toggleMute();
  };

  const handleToggleVoiceMode = () => {
    const newMode = session.voiceMode === 'push-to-talk' ? 'continuous' : 'push-to-talk';
    updateSession({ voiceMode: newMode });
    voice.setVoiceMode(newMode);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }]}>
      {/* Session Info */}
      <View style={styles.sessionInfo}>
        <View style={[styles.activeIndicator, { backgroundColor: theme.colors.success || '#10b981' }]} />
        <View style={styles.sessionDetails}>
          <Text style={[styles.sessionType, { color: theme.colors.text }]}>
            {session.type === 'voice-ptt' ? 'Voice (PTT)' : 'Voice (VAD)'}
          </Text>
          <Text style={[styles.sessionDuration, { color: theme.colors.textSecondary }]}>
            {formatDuration(session.startedAt)}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Mute Button */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            {
              backgroundColor: session.isMuted ? theme.colors.error : theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={handleToggleMute}
        >
          <Text style={[styles.controlIcon, { color: session.isMuted ? 'white' : theme.colors.text }]}>
            {session.isMuted ? '🔇' : '🎤'}
          </Text>
        </TouchableOpacity>

        {/* Voice Mode Toggle */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={handleToggleVoiceMode}
        >
          <Text style={[styles.controlText, { color: theme.colors.text }]}>
            {session.voiceMode === 'push-to-talk' ? 'PTT' : 'VAD'}
          </Text>
        </TouchableOpacity>

        {/* End Session Button */}
        <TouchableOpacity
          style={[
            styles.endButton,
            {
              backgroundColor: theme.colors.error || '#ef4444',
            },
          ]}
          onPress={onEndSession}
        >
          <Text style={styles.endButtonText}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sessionDetails: {
    gap: 2,
  },
  sessionType: {
    fontSize: 14,
    fontWeight: '600',
  },
  sessionDuration: {
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  controlIcon: {
    fontSize: 18,
  },
  controlText: {
    fontSize: 11,
    fontWeight: '600',
  },
  endButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default VoiceSessionControls;

