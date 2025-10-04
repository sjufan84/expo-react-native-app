import React, { useState, useCallback, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, PanResponder, Alert, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useVoice } from '../../hooks/useVoice';
import VoiceWaveform from './VoiceWaveform';

interface VoiceInputProps {
  onVoiceMessageSent?: (duration: number) => void;
  disabled?: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({
  onVoiceMessageSent,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const {
    isRecording,
    isMuted,
    recordingDuration,
    audioLevel,
    voiceMode,
    startRecording,
    stopRecording,
    toggleMute,
    setVoiceMode,
  } = useVoice();

  const [isPressing, setIsPressing] = useState(false);
  const [cancelThreshold, setCancelThreshold] = useState(0.7); // 70% up to cancel
  const startY = useRef(0);
  const currentY = useRef(0);

  // Pan responder for push-to-talk
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => voiceMode === 'push-to-talk' && !disabled,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: (evt) => {
        if (voiceMode === 'push-to-talk' && !disabled) {
          startY.current = evt.nativeEvent.pageY;
          setIsPressing(true);
          startRecording().catch(console.error);
        }
      },
      onPanResponderMove: (evt) => {
        if (voiceMode === 'push-to-talk' && isPressing) {
          currentY.current = evt.nativeEvent.pageY;
          const deltaY = startY.current - currentY.current;
          const containerHeight = 200; // Approximate height
          const cancelRatio = Math.max(0, deltaY / containerHeight);
          setCancelThreshold(cancelRatio);
        }
      },
      onPanResponderRelease: () => {
        if (voiceMode === 'push-to-talk' && isPressing) {
          setIsPressing(false);

          // Check if user canceled by swiping up
          if (cancelThreshold > 0.5) {
            // Cancel recording
            stopRecording().catch(console.error);
            console.log('Recording canceled');
          } else {
            // Send recording
            stopRecording().then(() => {
              if (onVoiceMessageSent) {
                onVoiceMessageSent(recordingDuration);
              }
            }).catch(console.error);
          }

          // Reset cancel threshold
          setCancelThreshold(0.7);
        }
      },
      onPanResponderTerminate: () => {
        if (voiceMode === 'push-to-talk' && isPressing) {
          setIsPressing(false);
          stopRecording().catch(console.error);
          setCancelThreshold(0.7);
        }
      },
    })
  ).current;

  // Handle continuous mode toggle
  const handleContinuousToggle = useCallback(async () => {
    if (voiceMode !== 'continuous') return;

    if (disabled) {
      Alert.alert('Not Available', 'Voice recording is currently disabled.');
      return;
    }

    if (isRecording) {
      await stopRecording();
      if (onVoiceMessageSent) {
        onVoiceMessageSent(recordingDuration);
      }
    } else {
      await startRecording();
    }
  }, [voiceMode, disabled, isRecording, stopRecording, startRecording, onVoiceMessageSent, recordingDuration]);

  // Format recording duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Determine button color based on state
  const getButtonColor = (): string => {
    if (disabled) return theme.colors.textMuted;
    if (isRecording && cancelThreshold > 0.5) return theme.colors.error; // Cancel zone
    if (isRecording) return theme.colors.voiceActive;
    if (isMuted) return theme.colors.voiceMuted;
    return theme.colors.voiceInactive;
  };

  // Get button size based on audio level
  const getButtonSize = (): number => {
    if (!isRecording) return 64;
    const baseSize = 64;
    const scale = 1 + (audioLevel * 0.15); // Up to 15% larger
    return baseSize * scale;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Voice Waveform */}
      {(isRecording || audioLevel > 0.1) && (
        <View style={styles.waveformContainer}>
          <VoiceWaveform
            audioLevel={audioLevel}
            isActive={isRecording}
            color={getButtonColor()}
          />
        </View>
      )}

      {/* Cancel indicator for push-to-talk */}
      {voiceMode === 'push-to-talk' && isPressing && cancelThreshold > 0.5 && (
        <View style={[styles.cancelIndicator, { backgroundColor: theme.colors.error }]}>
          <View style={styles.cancelContent}>
            <Text style={[styles.cancelText, { color: 'white' }]}>✖</Text>
            <Text style={[styles.cancelLabel, { color: 'white' }]}>Cancel</Text>
          </View>
        </View>
      )}

      {/* Recording duration */}
      {isRecording && (
        <View style={styles.durationContainer}>
          <Text style={[styles.durationText, { color: theme.colors.textSecondary }]}>
            🎙️ {formatDuration(recordingDuration)}
          </Text>
          <Text style={[styles.modeText, { color: theme.colors.textMuted }]}>
            {voiceMode === 'push-to-talk' ? 'Release to send' : 'Tap to stop'}
          </Text>
        </View>
      )}

      {/* Voice Controls */}
      <View style={styles.controlsContainer}>
        {/* Mode Toggle */}
        <View style={styles.modeContainer}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              voiceMode === 'push-to-talk' && {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
              },
              voiceMode !== 'push-to-talk' && {
                backgroundColor: theme.colors.backgroundSecondary,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => setVoiceMode('push-to-talk')}
          >
            <Text
              style={[
                styles.modeButtonText,
                {
                  color: voiceMode === 'push-to-talk' ? 'white' : theme.colors.text,
                },
              ]}
            >
              PTT
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              voiceMode === 'continuous' && {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
              },
              voiceMode !== 'continuous' && {
                backgroundColor: theme.colors.backgroundSecondary,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => setVoiceMode('continuous')}
          >
            <Text
              style={[
                styles.modeButtonText,
                {
                  color: voiceMode === 'continuous' ? 'white' : theme.colors.text,
                },
              ]}
            >
              Cont.
            </Text>
          </TouchableOpacity>
        </View>

        {/* Record Button */}
        {voiceMode === 'push-to-talk' ? (
          <TouchableOpacity
            style={[
              styles.recordButton,
              {
                width: getButtonSize(),
                height: getButtonSize(),
                borderRadius: getButtonSize() / 2,
                backgroundColor: getButtonColor(),
                transform: [{ scale: isPressing ? 0.95 : 1 }],
              },
            ]}
            {...panResponder.panHandlers}
            disabled={disabled}
            activeOpacity={1}
          >
            <Text style={[styles.recordIcon, { fontSize: isRecording ? 24 : 28, color: 'white' }]}>
              {isRecording ? '🔴' : '🎙️'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.recordButton,
              {
                width: getButtonSize(),
                height: getButtonSize(),
                borderRadius: getButtonSize() / 2,
                backgroundColor: getButtonColor(),
              },
            ]}
            onPress={handleContinuousToggle}
            disabled={disabled}
            activeOpacity={0.8}
          >
            <Text style={[styles.recordIcon, { fontSize: isRecording ? 24 : 28, color: 'white' }]}>
              {isRecording ? '⏹️' : '🎙️'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Mute Button */}
        <TouchableOpacity
          style={[
            styles.muteButton,
            {
              backgroundColor: isMuted ? theme.colors.error : theme.colors.backgroundSecondary,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={() => toggleMute()}
          disabled={disabled}
        >
          <Text style={[styles.muteIcon, { color: isMuted ? 'white' : theme.colors.text }]}>
            {isMuted ? '🔇' : '🎤'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <Text style={[styles.instructions, { color: theme.colors.textMuted }]}>
        {voiceMode === 'push-to-talk'
          ? 'Hold to record, swipe up to cancel'
          : 'Tap to start/stop recording'
        }
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderTopWidth: 1,
  },
  waveformContainer: {
    marginBottom: 12,
  },
  cancelIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 10,
  },
  cancelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  durationContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  durationText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modeText: {
    fontSize: 12,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  modeButtonText: {
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
  recordIcon: {
    textAlign: 'center',
  },
  muteButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  muteIcon: {
    fontSize: 20,
  },
  instructions: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default VoiceInput;