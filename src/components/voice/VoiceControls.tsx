import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  Dimensions,
  PanResponder,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAgent } from '../../context/AgentContext';
import { useVoice } from '../../hooks/useVoice';
import VoiceWaveform from './VoiceWaveform';

const { width: screenWidth } = Dimensions.get('window');

interface VoiceControlsProps {
  mode?: 'push-to-talk' | 'continuous';
  onModeChange?: (mode: 'push-to-talk' | 'continuous') => void;
  showModeSelector?: boolean;
  compact?: boolean;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  mode = 'push-to-talk',
  onModeChange,
  showModeSelector = true,
  compact = false,
}) => {
  const { theme } = useTheme();
  const { isConnected, agentStatus } = useAgent();
  const voice = useVoice();
  const [isPressing, setIsPressing] = useState(false);
  const [pressStartTime, setPressStartTime] = useState(0);

  // Update voice mode when prop changes
  useEffect(() => {
    if (voice.voiceMode !== mode) {
      voice.setVoiceMode(mode);
    }
  }, [mode, voice]);

  // Pan responder for push-to-talk functionality
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => mode === 'push-to-talk',
    onMoveShouldSetPanResponder: () => false,

    onPanResponderGrant: () => {
      if (mode === 'push-to-talk' && !voice.isRecording) {
        setIsPressing(true);
        setPressStartTime(Date.now());
        voice.startRecording();
      }
    },

    onPanResponderRelease: () => {
      if (mode === 'push-to-talk' && voice.isRecording) {
        const pressDuration = Date.now() - pressStartTime;

        // If pressed for less than 300ms, treat as accidental press
        if (pressDuration < 300) {
          voice.stopRecording();
          setIsPressing(false);
          return;
        }

        setIsPressing(false);
        voice.stopRecording();
      }
    },

    onPanResponderTerminate: () => {
      if (mode === 'push-to-talk' && voice.isRecording) {
        setIsPressing(false);
        voice.stopRecording();
      }
    },
  });

  const handleContinuousToggle = async () => {
    if (mode === 'continuous') {
      if (voice.isRecording) {
        await voice.stopRecording();
      } else {
        await voice.startRecording();
      }
    }
  };

  const handleMuteToggle = () => {
    voice.toggleMute();
  };

  const handleModeChange = (newMode: 'push-to-talk' | 'continuous') => {
    if (voice.isRecording) {
      Alert.alert(
        'Recording in Progress',
        'Please stop recording before switching modes.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    voice.setVoiceMode(newMode);
    onModeChange?.(newMode);
  };

  // Format recording duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get record button color based on state
  const getRecordButtonColor = (): string => {
    if (!isConnected) return (theme.colors as any).textMuted || '#64748b';
    if (voice.isRecording) return isPressing ? (theme.colors as any).error || '#ef4444' : (theme.colors as any).warning || '#f59e0b';
    if (voice.audioLevel > 0.1) return (theme.colors as any).voiceActive || '#22c55e';
    return (theme.colors as any).primary || '#2563eb';
  };

  // Get record button size based on audio level
  const getRecordButtonSize = (): number => {
    const baseSize = compact ? 60 : 80;
    if (!voice.isRecording) return baseSize;
    // Pulse effect based on audio level
    const scale = 1 + (voice.audioLevel * 0.15); // Up to 15% larger
    return baseSize * scale;
  };

  const buttonText = voice.isRecording
    ? (mode === 'push-to-talk' ? 'Release' : 'Stop')
    : (mode === 'push-to-talk' ? 'Press & Hold' : 'Start');

  const colors = theme.colors as any;

  return (
    <View style={[styles.container, { backgroundColor: colors.background || '#ffffff' }]}>

      {/* Mode Selector */}
      {showModeSelector && !compact && (
        <View style={[styles.modeSelector, { borderBottomColor: colors.border || '#e2e8f0' }]}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              voice.voiceMode === 'push-to-talk' && {
                backgroundColor: colors.primary || '#2563eb',
                borderColor: colors.primary || '#2563eb',
              },
              voice.voiceMode !== 'push-to-talk' && {
                backgroundColor: colors.backgroundSecondary || '#f8fafc',
                borderColor: colors.border || '#e2e8f0',
              },
            ]}
            onPress={() => handleModeChange('push-to-talk')}
          >
            <Text
              style={[
                styles.modeButtonText,
                {
                  color: voice.voiceMode === 'push-to-talk' ? 'white' : colors.text || '#1e293b',
                },
              ]}
            >
              Push to Talk
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              voice.voiceMode === 'continuous' && {
                backgroundColor: colors.primary || '#2563eb',
                borderColor: colors.primary || '#2563eb',
              },
              voice.voiceMode !== 'continuous' && {
                backgroundColor: colors.backgroundSecondary || '#f8fafc',
                borderColor: colors.border || '#e2e8f0',
              },
            ]}
            onPress={() => handleModeChange('continuous')}
          >
            <Text
              style={[
                styles.modeButtonText,
                {
                  color: voice.voiceMode === 'continuous' ? 'white' : colors.text || '#1e293b',
                },
              ]}
            >
              Continuous
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Voice Waveform */}
      {voice.isRecording && (
        <VoiceWaveform
          audioLevel={voice.audioLevel}
          isActive={voice.isRecording}
          color={getRecordButtonColor()}
        />
      )}

      {/* Recording Duration */}
      {voice.isRecording && !compact && (
        <Text style={[styles.duration, { color: colors.textSecondary || '#64748b' }]}>
          {formatDuration(voice.recordingDuration)}
        </Text>
      )}

      {/* Main Controls */}
      <View style={styles.controlsContainer}>
        {/* Mute Button */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            styles.muteButton,
            {
              backgroundColor: voice.isMuted ? colors.error || '#ef4444' : colors.backgroundSecondary || '#f8fafc',
              borderColor: colors.border || '#e2e8f0',
            },
          ]}
          onPress={handleMuteToggle}
          disabled={!isConnected}
        >
          <Text style={[styles.controlIcon, { color: voice.isMuted ? 'white' : colors.text || '#1e293b' }]}>
            {voice.isMuted ? '🔇' : '🎤'}
          </Text>
          <Text style={[styles.controlLabel, { color: voice.isMuted ? 'white' : colors.textSecondary || '#64748b' }]}>
            {voice.isMuted ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>

        {/* Record Button */}
        <TouchableOpacity
          style={[
            styles.recordButton,
            {
              width: getRecordButtonSize(),
              height: getRecordButtonSize(),
              borderRadius: getRecordButtonSize() / 2,
              backgroundColor: getRecordButtonColor(),
              transform: [{ scale: isPressing ? 0.95 : 1 }],
            },
          ]}
          onPress={mode === 'continuous' ? handleContinuousToggle : undefined}
          {...(mode === 'push-to-talk' ? panResponder.panHandlers : {})}
          disabled={!isConnected}
          activeOpacity={mode === 'continuous' ? 0.8 : 1}
        >
          <View style={styles.recordButtonContent}>
            <Text style={[styles.recordIcon, {
              fontSize: compact ? 16 : voice.isRecording ? 24 : 28,
              color: colors.background || '#ffffff'
            }]}>
              {buttonText}
            </Text>
            {voice.isRecording && !compact && (
              <Text style={[styles.recordingTime, { color: colors.background || '#ffffff' }]}>
                {formatDuration(voice.recordingDuration)}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Status Indicator */}
        <View style={[styles.statusContainer]}>
          <Text style={[styles.statusText, { color: colors.textSecondary || '#64748b' }]}>
            {agentStatus === 'listening' && '👂 Listening...'}
            {agentStatus === 'processing' && '🤔 Processing...'}
            {agentStatus === 'speaking' && '🔊 Speaking...'}
            {agentStatus === 'idle' && !isConnected && '🔴 Disconnected'}
            {agentStatus === 'idle' && isConnected && '🟢 Ready'}
          </Text>
          {voice.isRecording && (
            <View style={[styles.recordingIndicator, { backgroundColor: colors.error || '#ef4444' }]} />
          )}
        </View>
      </View>

      {/* Instructions */}
      {!compact && (
        <Text style={[styles.instructions, { color: colors.textMuted || '#94a3b8' }]}>
          {voice.voiceMode === 'push-to-talk'
            ? 'Press and hold the record button to speak, release to send'
            : 'Tap the record button to start/stop continuous recording'
          }
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderTopWidth: 1,
  },
  modeSelector: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  duration: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 80,
  },
  muteButton: {
    backgroundColor: 'transparent',
  },
  controlIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  recordButton: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recordButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordIcon: {
    textAlign: 'center',
    fontWeight: 'bold',
  },
  recordingTime: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  statusContainer: {
    alignItems: 'center',
    minWidth: 80,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  instructions: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default VoiceControls;