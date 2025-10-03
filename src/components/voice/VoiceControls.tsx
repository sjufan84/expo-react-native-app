import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAgent } from '../../context/AgentContext';
import { audioService, AudioLevel } from '../../services/AudioService';
import { VoiceControlsProps } from '../../types/message.types';

const VoiceControls: React.FC<VoiceControlsProps> = ({
  mode,
  isRecording,
  isMuted,
  onToggleMute,
  onToggleRecording,
  onModeChange,
}) => {
  const { theme } = useTheme();
  const { isConnected, agentStatus } = useAgent();
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Update audio levels
  useEffect(() => {
    const handleAudioLevel = (level: AudioLevel) => {
      setAudioLevel(level.level);
    };

    audioService.onAudioLevel(handleAudioLevel);

    return () => {
      audioService.offAudioLevel();
    };
  }, []);

  // Update recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(audioService.getRecordingDuration());
      }, 100);
    } else {
      setRecordingDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Handle recording toggle
  const handleToggleRecording = useCallback(async () => {
    try {
      if (!isConnected) {
        Alert.alert('Not Connected', 'Please connect to BakeBot before using voice features.');
        return;
      }

      if (isRecording) {
        // Stop recording
        const recordingData = await audioService.stopRecording();
        if (recordingData) {
          console.log('Recording completed:', recordingData);
          // Here you would process the recording data
          // For now, just log it
        }
        onToggleRecording();
      } else {
        // Start recording
        await audioService.startRecording();
        onToggleRecording();
      }
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Recording Error', 'Failed to toggle recording. Please check microphone permissions.');
    }
  }, [isRecording, isConnected, onToggleRecording]);

  // Handle mute toggle
  const handleToggleMute = useCallback(() => {
    audioService.setMuted(!isMuted);
    onToggleMute();
  }, [isMuted, onToggleMute]);

  // Handle mode change
  const handleModeChange = useCallback((newMode: 'push-to-talk' | 'continuous') => {
    onModeChange(newMode);
  }, [onModeChange]);

  // Format recording duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get record button color based on state
  const getRecordButtonColor = (): string => {
    if (!isConnected) return theme.colors.textMuted;
    if (isRecording) return theme.colors.error;
    if (audioLevel > 0.1) return theme.colors.voiceActive;
    return theme.colors.voiceInactive;
  };

  // Get record button size based on audio level
  const getRecordButtonSize = (): number => {
    if (!isRecording) return 64;
    // Pulse effect based on audio level
    const baseSize = 64;
    const scale = 1 + (audioLevel * 0.2); // Up to 20% larger
    return baseSize * scale;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Mode Selector */}
      <View style={[styles.modeSelector, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[
            styles.modeButton,
            mode === 'push-to-talk' && {
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.primary,
            },
            mode !== 'push-to-talk' && {
              backgroundColor: theme.colors.backgroundSecondary,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={() => handleModeChange('push-to-talk')}
        >
          <Text
            style={[
              styles.modeButtonText,
              {
                color: mode === 'push-to-talk' ? 'white' : theme.colors.text,
              },
            ]}
          >
            Push to Talk
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeButton,
            mode === 'continuous' && {
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.primary,
            },
            mode !== 'continuous' && {
              backgroundColor: theme.colors.backgroundSecondary,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={() => handleModeChange('continuous')}
        >
          <Text
            style={[
              styles.modeButtonText,
              {
                color: mode === 'continuous' ? 'white' : theme.colors.text,
              },
            ]}
          >
            Continuous
          </Text>
        </TouchableOpacity>
      </View>

      {/* Voice Controls */}
      <View style={styles.controlsContainer}>
        {/* Mute Button */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            styles.muteButton,
            {
              backgroundColor: isMuted ? theme.colors.error : theme.colors.backgroundSecondary,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={handleToggleMute}
          disabled={!isConnected}
        >
          <Text style={[styles.controlIcon, { color: isMuted ? 'white' : theme.colors.text }]}>
            {isMuted ? '🔇' : '🎤'}
          </Text>
          <Text style={[styles.controlLabel, { color: isMuted ? 'white' : theme.colors.textSecondary }]}>
            {isMuted ? 'Unmute' : 'Mute'}
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
            },
          ]}
          onPress={handleToggleRecording}
          disabled={!isConnected}
          activeOpacity={0.8}
        >
          <View style={styles.recordButtonContent}>
            <Text style={[styles.recordIcon, { fontSize: isRecording ? 24 : 28 }]}>
              {isRecording ? '⏹️' : '🎙️'}
            </Text>
            {isRecording && (
              <Text style={[styles.recordingTime, { color: 'white' }]}>
                {formatDuration(recordingDuration)}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Status Indicator */}
        <View style={[styles.statusContainer]}>
          <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
            {agentStatus === 'listening' && '👂 Listening...'}
            {agentStatus === 'processing' && '🤔 Processing...'}
            {agentStatus === 'speaking' && '🔊 Speaking...'}
            {agentStatus === 'idle' && !isConnected && '🔴 Disconnected'}
            {agentStatus === 'idle' && isConnected && '🟢 Ready'}
          </Text>
          {isRecording && (
            <View style={[styles.recordingIndicator, { backgroundColor: theme.colors.error }]} />
          )}
        </View>
      </View>

      {/* Instructions */}
      {mode === 'push-to-talk' && (
        <Text style={[styles.instructions, { color: theme.colors.textMuted }]}>
          Hold the record button to speak, release to send
        </Text>
      )}
      {mode === 'continuous' && (
        <Text style={[styles.instructions, { color: theme.colors.textMuted }]}>
          Tap record to start/stop continuous recording
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
    color: 'white',
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