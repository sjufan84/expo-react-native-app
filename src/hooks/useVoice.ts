/* eslint-disable no-undef */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { Room } from 'livekit-client';
import { audioService } from '../services/AudioService';
import { useAgent } from '../context/AgentContext';
import { ERROR_MESSAGES } from '../utils/constants';

export interface UseVoiceReturn {
  // Recording state
  isRecording: boolean;
  isMuted: boolean;
  recordingDuration: number;
  audioLevel: number;

  // Voice mode
  voiceMode: 'push-to-talk' | 'continuous';

  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  toggleRecording: () => Promise<void>;
  toggleMute: () => void;
  setVoiceMode: (mode: 'push-to-talk' | 'continuous') => void;

  // Setup
  initializeAudio: (room: Room) => Promise<void>;
  cleanupAudio: () => Promise<void>;
}

export const useVoice = (): UseVoiceReturn => {
  const { isConnected, sendMessage } = useAgent();
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceMode, setVoiceModeState] = useState<'push-to-talk' | 'continuous'>('push-to-talk');
  const currentRoom = useRef<Room | null>(null);

  // Audio level monitoring
  useEffect(() => {
    const handleAudioLevel = (level: { level: number; timestamp: number }) => {
      setAudioLevel(level.level);
    };

    audioService.onAudioLevel(handleAudioLevel);

    return () => {
      audioService.offAudioLevel();
    };
  }, []);

  // Recording duration monitoring
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

  // Initialize audio for a room
  const initializeAudio = useCallback(async (room: Room): Promise<void> => {
    try {
      if (!isConnected) {
        throw new Error('Not connected to agent');
      }

      // Create and publish audio track
      await audioService.createLocalAudioTrack();
      await audioService.publishAudioTrack(room);

      currentRoom.current = room;

      console.log('Audio initialized for room');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      throw error;
    }
  }, [isConnected]);

  // Cleanup audio resources
  const cleanupAudio = useCallback(async (): Promise<void> => {
    try {
      if (isRecording) {
        await stopRecording();
      }

      if (currentRoom.current) {
        await audioService.unpublishAudioTrack(currentRoom.current);
      }

      await audioService.cleanup();
      currentRoom.current = null;

      console.log('Audio cleaned up');
    } catch (error) {
      console.error('Error during audio cleanup:', error);
    }
  }, [isRecording]);

  // Start recording
  const startRecording = useCallback(async (): Promise<void> => {
    try {
      if (!isConnected) {
        Alert.alert('Not Connected', 'Please connect to BakeBot before recording.');
        return;
      }

      if (isRecording) {
        console.warn('Already recording');
        return;
      }

      await audioService.startRecording();
      setIsRecording(true);

      console.log('Recording started');

      // For continuous mode, we might want to send audio data in real-time
      if (voiceMode === 'continuous') {
        // TODO: Implement real-time audio streaming
        console.log('Continuous recording mode - streaming audio');
      }

    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Recording Error', ERROR_MESSAGES.microphone);
    }
  }, [isConnected, isRecording, voiceMode]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      if (!isRecording) {
        console.warn('Not recording');
        return;
      }

      const recordingData = await audioService.stopRecording();
      setIsRecording(false);

      if (recordingData) {
        console.log('Recording completed:', recordingData);

        // Send voice message
        try {
          await sendMessage('Voice message sent', 'voice');
        } catch (error) {
          console.error('Failed to send voice message:', error);
          Alert.alert('Send Error', 'Failed to send voice message. Please try again.');
        }
      }

    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Recording Error', 'Failed to stop recording. Please try again.');
    }
  }, [isRecording, sendMessage]);

  // Toggle recording
  const toggleRecording = useCallback(async (): Promise<void> => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Toggle mute
  const toggleMute = useCallback((): void => {
    const newMutedState = !isMuted;
    audioService.setMuted(newMutedState);
    setIsMuted(newMutedState);
    console.log(`Audio ${newMutedState ? 'muted' : 'unmuted'}`);
  }, [isMuted]);

  // Set voice mode
  const setVoiceMode = useCallback((mode: 'push-to-talk' | 'continuous'): void => {
    setVoiceModeState(mode);

    // Stop recording if switching modes while recording
    if (isRecording && mode !== voiceMode) {
      stopRecording().catch(console.error);
    }

    console.log(`Voice mode changed to: ${mode}`);
  }, [isRecording, voiceMode, stopRecording]);

  // Handle push-to-talk (press and hold)
  /*const startPushToTalk = useCallback(async (): Promise<void> => {
    if (voiceMode !== 'push-to-talk') return;
    await startRecording();
  }, [voiceMode, startRecording]);

  const stopPushToTalk = useCallback(async (): Promise<void> => {
    if (voiceMode !== 'push-to-talk') return;
    await stopRecording();
  }, [voiceMode, stopRecording]);*/

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio().catch(console.error);
    };
  }, [cleanupAudio]);

  // Handle connection state changes
  useEffect(() => {
    if (!isConnected && isRecording) {
      // Stop recording if disconnected
      stopRecording().catch(console.error);
    }
  }, [isConnected, isRecording, stopRecording]);

  return {
    isRecording,
    isMuted,
    recordingDuration,
    audioLevel,
    voiceMode,
    startRecording,
    stopRecording,
    toggleRecording,
    toggleMute,
    setVoiceMode,
    initializeAudio,
    cleanupAudio,
  };
};