
import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { Room, LocalAudioTrack, Track } from 'livekit-client';
import { audioService } from '../services/AudioService';
import { useAgent } from '../context/AgentContext';
import { useLiveKit } from '../hooks/useLiveKit';
import { ERROR_MESSAGES, AUDIO_CONFIG } from '../utils/constants';
import { DataChannelMessage } from '../types/message.types';

export interface VoiceActivityDetection {
  isActive: boolean;
  level: number;
  timestamp: number;
}

export interface UseVoiceReturn {
  // Recording state
  isRecording: boolean;
  isMuted: boolean;
  recordingDuration: number;
  audioLevel: number;

  // Voice mode
  voiceMode: 'push-to-talk' | 'continuous';

  // Audio track info
  hasAudioTrack: boolean;
  audioTrackId: string | null;

  // Voice activity detection
  voiceActivity: VoiceActivityDetection;

  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  toggleRecording: () => Promise<void>;
  toggleMute: () => void;
  setVoiceMode: (mode: 'push-to-talk' | 'continuous') => void;

  // Push-to-talk specific
  startPushToTalk: () => Promise<void>;
  stopPushToTalk: () => Promise<void>;

  // Setup
  initializeAudio: (room: Room) => Promise<void>;
  cleanupAudio: () => Promise<void>;

  // Audio processing
  enableEchoCancellation: (enabled: boolean) => void;
  enableNoiseSuppression: (enabled: boolean) => void;
  enableAutoGainControl: (enabled: boolean) => void;
}

export const useVoice = (): UseVoiceReturn => {
  const { isConnected, sendMessage } = useAgent();
  const liveKit = useLiveKit();
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceMode, setVoiceModeState] = useState<'push-to-talk' | 'continuous'>('push-to-talk');
  const [hasAudioTrack, setHasAudioTrack] = useState(false);
  const [audioTrackId, setAudioTrackId] = useState<string | null>(null);
  const [voiceActivity, setVoiceActivity] = useState<VoiceActivityDetection>({
    isActive: false,
    level: 0,
    timestamp: Date.now(),
  });

  const currentRoom = useRef<Room | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const recordingStartTime = useRef<number>(0);
  const vadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time audio level monitoring from LiveKit track
  useEffect(() => {
    const monitorAudioLevels = () => {
      if (!audioTrackRef.current || !isRecording) return;

      try {
        // Get audio level from LiveKit LocalAudioTrack
        const audioTrack = audioTrackRef.current;

        // In React Native, we monitor audio levels through the track's analyzer
        if (audioTrack.getAnalyzer) {
          const analyzer = audioTrack.getAnalyzer();
          if (analyzer) {
            const float32Array = new Float32Array(analyzer.fftSize);
            analyzer.getFloatFrequencyData(float32Array);

            // Calculate RMS (Root Mean Square) for audio level
            let sum = 0;
            for (let i = 0; i < float32Array.length; i++) {
              const amplitude = Math.pow(10, float32Array[i] / 20);
              sum += amplitude * amplitude;
            }
            const rms = Math.sqrt(sum / float32Array.length);
            const normalizedLevel = Math.min(1, Math.max(0, rms * 10)); // Normalize to 0-1

            setAudioLevel(normalizedLevel);

            // Update voice activity for VAD
            const newVoiceActivity: VoiceActivityDetection = {
              isActive: normalizedLevel > 0.05, // Threshold for voice activity
              level: normalizedLevel,
              timestamp: Date.now(),
            };
            setVoiceActivity(newVoiceActivity);

            // Handle continuous mode with VAD
            if (voiceMode === 'continuous' && newVoiceActivity.isActive) {
              handleVoiceActivityDetection(newVoiceActivity);
            }
          }
        } else {
          // Fallback for development mode or when analyzer is not available
          const mockLevel = isRecording ? Math.random() * 0.8 : 0;
          setAudioLevel(mockLevel);
          setVoiceActivity({
            isActive: mockLevel > 0.1,
            level: mockLevel,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.warn('Error monitoring audio levels:', error);
      }
    };

    if (isRecording && hasAudioTrack) {
      audioLevelTimerRef.current = setInterval(monitorAudioLevels, 100); // 10Hz monitoring
    }

    return () => {
      if (audioLevelTimerRef.current) {
        clearInterval(audioLevelTimerRef.current);
        audioLevelTimerRef.current = null;
      }
    };
  }, [isRecording, hasAudioTrack, voiceMode]);

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

  // Voice Activity Detection handler
  const handleVoiceActivityDetection = useCallback((activity: VoiceActivityDetection) => {
    if (!isRecording || voiceMode !== 'continuous') return;

    // Send real-time audio data via LiveKit data channel
    if (activity.isActive && liveKit.isConnected()) {
      const voiceDataMessage: DataChannelMessage = {
        type: 'control',
        payload: {
          action: 'voice_activity',
          level: activity.level,
          timestamp: activity.timestamp,
          is_speaking: true,
        },
        timestamp: Date.now(),
        messageId: `vad-${Date.now()}`,
      };

      liveKit.sendData(voiceDataMessage).catch(error => {
        console.warn('Failed to send VAD data:', error);
      });
    }
  }, [isRecording, voiceMode, liveKit]);

  // Initialize audio for a room
  const initializeAudio = useCallback(async (room: Room): Promise<void> => {
    try {
      if (!isConnected) {
        throw new Error('Not connected to agent');
      }

      currentRoom.current = room;

      // Enable microphone through LiveKit
      await room.localParticipant.setMicrophoneEnabled(true);

      // Get the published audio track
      const audioPublications = Array.from(room.localParticipant.audioTrackPublications.values());
      if (audioPublications.length > 0) {
        const audioPublication = audioPublications[0];
        audioTrackRef.current = audioPublication.track as LocalAudioTrack;
        setHasAudioTrack(true);
        setAudioTrackId(audioTrackRef.current.sid);

        console.log('Audio track initialized:', audioTrackRef.current.sid);
      }

      // Initialize audio service with the LiveKit room
      await audioService.publishAudioTrack(room);

      console.log('Audio successfully initialized for room');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      throw error;
    }
  }, [isConnected]);

  // Auto-initialize audio when connected
  useEffect(() => {
    if (isConnected && !currentRoom.current) {
      // In development mode, we need to get the room from LiveKit service
      // For now, we'll handle this in the startRecording method
      console.log('Connected - audio will be initialized on first recording');
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

      recordingStartTime.current = Date.now();

      // Initialize audio if not already done
      if (!currentRoom.current) {
        // Development mode: simulate recording
        if (__DEV__) {
          console.log('🔧 Development Mode: Simulating audio recording');
          setIsRecording(true);
          setHasAudioTrack(true);
          setAudioTrackId('dev-mock-track');
          return;
        } else {
          // Production: get room from LiveKit service
          const room = liveKit.room;
          if (!room) {
            throw new Error('No LiveKit room available');
          }
          await initializeAudio(room);
        }
      } else {
        // Ensure audio track is enabled
        if (audioTrackRef.current) {
          await audioTrackRef.current.setEnabled(true);
          setHasAudioTrack(true);
        }
      }

      // Start recording through audio service
      await audioService.startRecording();
      setIsRecording(true);

      console.log('Recording started - Mode:', voiceMode);

      // Send recording start notification via LiveKit
      if (liveKit.isConnected()) {
        const startMessage: DataChannelMessage = {
          type: 'control',
          payload: {
            action: 'start_recording',
            mode: voiceMode,
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
          messageId: `start-${Date.now()}`,
        };

        await liveKit.sendData(startMessage);
      }

      // For continuous mode with VAD, set up voice activity monitoring
      if (voiceMode === 'continuous') {
        console.log('Continuous recording mode with VAD enabled');
      }

    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Recording Error', ERROR_MESSAGES.microphone);
      setIsRecording(false);
    }
  }, [isConnected, isRecording, voiceMode, initializeAudio, liveKit]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      if (!isRecording) {
        console.warn('Not recording');
        return;
      }

      setIsRecording(false);
      const recordingDuration = Date.now() - recordingStartTime.current;

      // Stop audio service recording
      const recordingData = await audioService.stopRecording();

      // Send recording stop notification via LiveKit
      if (liveKit.isConnected()) {
        const stopMessage: DataChannelMessage = {
          type: 'control',
          payload: {
            action: 'stop_recording',
            duration: recordingDuration,
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
          messageId: `stop-${Date.now()}`,
        };

        await liveKit.sendData(stopMessage);
      }

      // Development mode handling
      if (__DEV__ && !currentRoom.current) {
        console.log('🔧 Development Mode: Simulating recording completion');

        // Send voice message
        try {
          await sendMessage('Voice message sent', 'voice');
        } catch (error) {
          console.error('Failed to send voice message:', error);
          Alert.alert('Send Error', 'Failed to send voice message. Please try again.');
        }
      } else {
        // Production mode with actual recording data
        if (recordingData) {
          console.log('Recording completed:', {
            duration: recordingData.duration,
            size: recordingData.size,
            uri: recordingData.uri,
          });

          // Send voice message with metadata
          try {
            const voiceMessage = `Voice message (${Math.round(recordingData.duration / 1000)}s)`;
            await sendMessage(voiceMessage, 'voice');
          } catch (error) {
            console.error('Failed to send voice message:', error);
            Alert.alert('Send Error', 'Failed to send voice message. Please try again.');
          }
        }
      }

    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Recording Error', 'Failed to stop recording. Please try again.');
    }
  }, [isRecording, sendMessage, liveKit]);

  // Push-to-talk specific methods
  const startPushToTalk = useCallback(async (): Promise<void> => {
    if (voiceMode !== 'push-to-talk') {
      console.warn('Not in push-to-talk mode');
      return;
    }

    await startRecording();
  }, [voiceMode, startRecording]);

  const stopPushToTalk = useCallback(async (): Promise<void> => {
    if (voiceMode !== 'push-to-talk') {
      console.warn('Not in push-to-talk mode');
      return;
    }

    await stopRecording();
  }, [voiceMode, stopRecording]);

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

    // Mute both the audio service and the LiveKit track
    audioService.setMuted(newMutedState);

    if (audioTrackRef.current) {
      if (newMutedState) {
        audioTrackRef.current.mute().catch(console.error);
      } else {
        audioTrackRef.current.unmute().catch(console.error);
      }
    }

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

  // Audio processing methods
  const enableEchoCancellation = useCallback((enabled: boolean): void => {
    audioService.setEchoCancellation(enabled);
    console.log(`Echo cancellation ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  const enableNoiseSuppression = useCallback((enabled: boolean): void => {
    audioService.setNoiseSuppression(enabled);
    console.log(`Noise suppression ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  const enableAutoGainControl = useCallback((enabled: boolean): void => {
    audioService.setAutoGainControl(enabled);
    console.log(`Auto gain control ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear timers
      if (vadTimerRef.current) {
        clearTimeout(vadTimerRef.current);
      }
      if (audioLevelTimerRef.current) {
        clearInterval(audioLevelTimerRef.current);
      }

      cleanupAudio().catch(console.error);
    };
  }, []);

  // Handle connection state changes
  useEffect(() => {
    if (!isConnected && isRecording) {
      // Stop recording if disconnected
      stopRecording().catch(console.error);
    }
  }, [isConnected, isRecording]);

  // Auto-initialize audio with LiveKit room when connected
  useEffect(() => {
    if (isConnected && liveKit.room && !currentRoom.current) {
      const room = liveKit.room;
      initializeAudio(room).catch(error => {
        console.error('Failed to auto-initialize audio:', error);
      });
    }
  }, [isConnected, liveKit.room, initializeAudio]);

  return {
    isRecording,
    isMuted,
    recordingDuration,
    audioLevel,
    voiceMode,
    hasAudioTrack,
    audioTrackId,
    voiceActivity,
    startRecording,
    stopRecording,
    toggleRecording,
    toggleMute,
    setVoiceMode,
    startPushToTalk,
    stopPushToTalk,
    initializeAudio,
    cleanupAudio,
    enableEchoCancellation,
    enableNoiseSuppression,
    enableAutoGainControl,
  };
};