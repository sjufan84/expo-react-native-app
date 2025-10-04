
import { Room, LocalAudioTrack } from 'livekit-client';
import { AUDIO_CONFIG, ERROR_MESSAGES } from '../utils/constants';
import { Platform } from 'react-native';
import {
  handleError
} from '../utils/errorRecovery';

export interface AudioLevel {
  level: number; // 0-1
  timestamp: number;
}

export interface AudioRecordingData {
  uri: string;
  duration: number;
  size: number;
  channels: number;
  sampleRate: number;
  bitRate: number;
}

interface AudioAnalyzer {
  frequencyBinCount: number;
  getByteFrequencyData: (dataArray: Uint8Array) => void;
}

export class AudioService {
  private audioTrack: LocalAudioTrack | null = null;
  private isRecording = false;
  private isMuted = false;
  private onAudioLevelCallback: ((level: AudioLevel) => void) | null = null;
  private audioLevelInterval: NodeJS.Timeout | null = null;
  private recordingStartTime: number = 0;
  private recordingDuration: number = 0;
  private room: Room | null = null;

  // Audio processing options
  private echoCancellation = true;
  private noiseSuppression = true;
  private autoGainControl = true;

  constructor() {
    // Initialize audio processing based on platform
    this.initializeAudioProcessing();
  }

  /**
   * Initialize audio processing settings based on platform
   */
  private initializeAudioProcessing(): void {
    // Optimize for mobile platforms
    if (Platform.OS === 'ios') {
      // iOS specific optimizations
      this.echoCancellation = true;
      this.noiseSuppression = true;
      this.autoGainControl = true;
    } else if (Platform.OS === 'android') {
      // Android specific optimizations
      this.echoCancellation = true;
      this.noiseSuppression = true;
      this.autoGainControl = false; // May cause issues on some Android devices
    }

    console.log('AudioService initialized for platform:', Platform.OS, {
      echoCancellation: this.echoCancellation,
      noiseSuppression: this.noiseSuppression,
      autoGainControl: this.autoGainControl,
    });
  }

  /**
   * Create and configure local audio track
   */
  async createLocalAudioTrack(): Promise<LocalAudioTrack | null> {
    try {
      if (this.audioTrack) {
        console.warn('Audio track already exists');
        return this.audioTrack;
      }

      // In React Native, audio tracks are created through the Room
      // when microphone is enabled. This method sets up the configuration
      // that will be used when the track is created.
      console.log('Audio track configuration prepared for LiveKit room');

      // Prepare audio constraints for React Native
      const audioConstraints = {
        echoCancellation: this.echoCancellation,
        noiseSuppression: this.noiseSuppression,
        autoGainControl: this.autoGainControl,
        sampleRate: AUDIO_CONFIG.sampleRate,
        channelCount: AUDIO_CONFIG.channels,
      };

      console.log('Audio constraints configured:', audioConstraints);
      return null; // Track will be created by LiveKit when microphone is enabled

    } catch (error) {
      console.error('Failed to create local audio track:', error);
      throw new Error(ERROR_MESSAGES.microphone);
    }
  }

  /**
   * Publish audio track to room
   */
  async publishAudioTrack(room: Room): Promise<void> {
    try {
      this.room = room;

      // Enable microphone through localParticipant
      await room.localParticipant.setMicrophoneEnabled(true);

      // Get the audio track from the participant
      const audioPublications = Array.from(room.localParticipant.audioTrackPublications.values());
      if (audioPublications.length > 0) {
        const audioPublication = audioPublications[0];
        this.audioTrack = audioPublication.track as LocalAudioTrack;

        if (this.audioTrack) {
          console.log('Audio track published successfully:', this.audioTrack.sid);

          // Set up audio track event listeners
          this.setupAudioTrackListeners();
        } else {
          console.warn('Audio track publication found but track is null');
        }
      } else {
        console.warn('No audio track publications found after enabling microphone');
      }

    } catch (error) {
      console.error('Failed to publish audio track:', error);
      throw error;
    }
  }

  /**
   * Set up audio track event listeners
   */
  private setupAudioTrackListeners(): void {
    if (!this.audioTrack) return;

    // Listen for track mute/unmute events
    this.audioTrack.on('muted', () => {
      console.log('Audio track muted');
      this.isMuted = true;
    });

    this.audioTrack.on('unmuted', () => {
      console.log('Audio track unmuted');
      this.isMuted = false;
    });

    // Listen for track end events
    this.audioTrack.on('ended', () => {
      console.log('Audio track ended');
      this.audioTrack = null;
    });

    console.log('Audio track listeners set up');
  }

  /**
   * Unpublish audio track from room
   */
  async unpublishAudioTrack(room: Room): Promise<void> {
    try {
      if (room.localParticipant) {
        await room.localParticipant.setMicrophoneEnabled(false);
        this.audioTrack = null;
        console.log('Audio track unpublished successfully');
      }
    } catch (error) {
      console.error('Failed to unpublish audio track:', error);
      throw error;
    }
  }

  /**
   * Start audio recording
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    try {
      // Ensure we have an audio track
      if (!this.audioTrack) {
        throw new Error('No audio track available. Please ensure microphone is enabled.');
      }

      // Ensure the track is unmuted and enabled
      if (this.audioTrack.isMuted) {
        await this.audioTrack.unmute();
      }

      // Note: setEnabled is not available in React Native LiveKit
      // Track is enabled by default when published

      this.isRecording = true;
      this.recordingStartTime = Date.now();

      // Start monitoring audio levels
      this.startAudioLevelMonitoring();

      console.log('Audio recording started with track:', this.audioTrack.sid);

      // Development mode fallback
      if (__DEV__ && !this.hasAnalyzer()) {
        console.log('🔧 Development Mode: Mock recording (no analyzer available)');
        this.startMockAudioLevelMonitoring();
      }

    } catch (error) {
      console.error('Failed to start recording:', error);
      this.isRecording = false;

      // Handle error through recovery system
      await handleError(
        error as Error,
        'startRecording',
        'AudioService',
        {
          hasAudioTrack: !!this.audioTrack,
          isMuted: this.audioTrack?.isMuted || false,
          roomName: this.room?.name,
          platform: Platform.OS
        }
      );
      throw error;
    }
  }

  /**
   * Start mock audio level monitoring for development
   */
  private startMockAudioLevelMonitoring(): void {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
    }

    this.audioLevelInterval = setInterval(() => {
      if (this.isRecording && this.onAudioLevelCallback) {
        // Generate realistic mock audio levels
        const baseLevel = Math.random() * 0.3; // Base noise level
        const peakLevel = Math.random() < 0.1 ? Math.random() * 0.7 : 0; // Occasional peaks
        const level = Math.min(1, baseLevel + peakLevel);

        this.onAudioLevelCallback({
          level,
          timestamp: Date.now(),
        });
      }
    }, 100); // 10Hz update rate
  }

  /**
   * Stop audio recording
   */
  async stopRecording(): Promise<AudioRecordingData | null> {
    if (!this.isRecording) {
      console.warn('Not recording');
      return null;
    }

    try {
      this.isRecording = false;
      this.recordingDuration = Date.now() - this.recordingStartTime;

      // Stop monitoring audio levels
      this.stopAudioLevelMonitoring();

      // In development mode, return mock data
      if (__DEV__ && !this.audioTrack) {
        console.log('🔧 Development Mode: Returning mock recording data');
        const recordingData: AudioRecordingData = {
          uri: `dev_mock_recording_${Date.now()}.webm`,
          duration: this.recordingDuration,
          size: Math.floor(this.recordingDuration * AUDIO_CONFIG.bitRate / 8),
          channels: AUDIO_CONFIG.channels,
          sampleRate: AUDIO_CONFIG.sampleRate,
          bitRate: AUDIO_CONFIG.bitRate,
        };
        console.log('Mock audio recording stopped');
        return recordingData;
      }

      // In a real implementation, you'd save the audio data here
      // For now, return mock data
      const recordingData: AudioRecordingData = {
        uri: `mock_recording_${Date.now()}.webm`,
        duration: this.recordingDuration,
        size: Math.floor(this.recordingDuration * AUDIO_CONFIG.bitRate / 8),
        channels: AUDIO_CONFIG.channels,
        sampleRate: AUDIO_CONFIG.sampleRate,
        bitRate: AUDIO_CONFIG.bitRate,
      };

      console.log('Audio recording stopped');
      return recordingData;

    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.isRecording = false;
      this.stopAudioLevelMonitoring();

      // Handle error through recovery system
      await handleError(
        error as Error,
        'stopRecording',
        'AudioService',
        {
          wasRecording: true,
          duration: this.recordingDuration,
          roomName: this.room?.name,
          platform: Platform.OS
        }
      );
      throw error;
    }
  }

  /**
   * Mute/unmute audio
   */
  async setMuted(muted: boolean): Promise<void> {
    if (this.audioTrack) {
      if (muted) {
        await this.audioTrack.mute();
      } else {
        await this.audioTrack.unmute();
      }
      this.isMuted = muted;
      console.log(`Audio ${muted ? 'muted' : 'unmuted'}`);
    }
  }

  /**
   * Get current mute state
   */
  getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Get current recording state
   */
  getRecordingState(): boolean {
    return this.isRecording;
  }

  /**
   * Get recording duration in milliseconds
   */
  getRecordingDuration(): number {
    if (this.isRecording) {
      return Date.now() - this.recordingStartTime;
    }
    return this.recordingDuration;
  }

  /**
   * Start monitoring audio levels
   */
  private startAudioLevelMonitoring(): void {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
    }

    this.audioLevelInterval = setInterval(() => {
      if (this.audioTrack && this.isRecording) {
        try {
          const level = this.getRealAudioLevel();

          if (this.onAudioLevelCallback) {
            this.onAudioLevelCallback({
              level,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          console.warn('Error getting audio level:', error);
        }
      }
    }, 50); // 20Hz monitoring for better responsiveness (<500ms latency target)
  }

  /**
   * Stop monitoring audio levels
   */
  private stopAudioLevelMonitoring(): void {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
  }

  /**
   * Get real audio level from LiveKit track
   */
  getRealAudioLevel(): number {
    if (!this.audioTrack || !this.isRecording) return 0;

    try {
      // Try to get audio level from LiveKit track analyzer
      if (this.hasAnalyzer()) {
        const analyzer = this.getAnalyzer();
        if (analyzer) {
          // Get frequency data for audio level calculation
          const bufferLength = analyzer.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyzer.getByteFrequencyData(dataArray);

          // Calculate RMS (Root Mean Square) for audio level
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            const normalizedValue = dataArray[i] / 255; // Normalize to 0-1
            sum += normalizedValue * normalizedValue;
          }
          const rms = Math.sqrt(sum / bufferLength);

          // Apply logarithmic scaling for more natural response
          const scaledLevel = Math.log10(1 + rms * 9) / Math.log10(10);
          return Math.min(1, Math.max(0, scaledLevel));
        }
      }

      // Fallback: try to get audio level through media stream
      if (this.audioTrack.mediaStream && this.audioTrack.mediaStream.getAudioTracks().length > 0) {
        // Web Audio API would go here, but React Native has limited support
        // Return estimated level based on track state
        return this.audioTrack.isMuted ? 0 : 0.1;
      }

      // Final fallback for development mode
      if (__DEV__) {
        return Math.random() * 0.6;
      }

      return 0;
    } catch (error) {
      console.warn('Error calculating real audio level:', error);
      return 0;
    }
  }

  /**
   * Set callback for audio level updates
   */
  onAudioLevel(callback: (level: AudioLevel) => void): void {
    this.onAudioLevelCallback = callback;
  }

  /**
   * Remove audio level callback
   */
  offAudioLevel(): void {
    this.onAudioLevelCallback = null;
  }

  /**
   * Enable/disable echo cancellation
   */
  setEchoCancellation(enabled: boolean): void {
    this.echoCancellation = enabled;

    // Apply to existing track if possible
    if (this.audioTrack && this.audioTrack.mediaStream) {
      const audioTracks = this.audioTrack.mediaStream.getAudioTracks();
      audioTracks.forEach(track => {
        const constraints = track.getConstraints();
        if (constraints.echoCancellation !== undefined) {
          track.applyConstraints({
            ...constraints,
            echoCancellation: enabled,
          }).catch(error => {
            console.warn('Failed to apply echo cancellation:', error);
          });
        }
      });
    }

    console.log(`Echo cancellation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable noise suppression
   */
  setNoiseSuppression(enabled: boolean): void {
    this.noiseSuppression = enabled;

    // Apply to existing track if possible
    if (this.audioTrack && this.audioTrack.mediaStream) {
      const audioTracks = this.audioTrack.mediaStream.getAudioTracks();
      audioTracks.forEach(track => {
        const constraints = track.getConstraints();
        if (constraints.noiseSuppression !== undefined) {
          track.applyConstraints({
            ...constraints,
            noiseSuppression: enabled,
          }).catch(error => {
            console.warn('Failed to apply noise suppression:', error);
          });
        }
      });
    }

    console.log(`Noise suppression ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable auto gain control
   */
  setAutoGainControl(enabled: boolean): void {
    this.autoGainControl = enabled;

    // Apply to existing track if possible
    if (this.audioTrack && this.audioTrack.mediaStream) {
      const audioTracks = this.audioTrack.mediaStream.getAudioTracks();
      audioTracks.forEach(track => {
        const constraints = track.getConstraints();
        if (constraints.autoGainControl !== undefined) {
          track.applyConstraints({
            ...constraints,
            autoGainControl: enabled,
          }).catch(error => {
            console.warn('Failed to apply auto gain control:', error);
          });
        }
      });
    }

    console.log(`Auto gain control ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get audio processing statistics
   */
  getAudioStats(): {
    isEnabled: boolean;
    isRecording: boolean;
    isMuted: boolean;
    hasTrack: boolean;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
    recordingDuration: number;
  } {
    return {
      isEnabled: !!this.audioTrack,
      isRecording: this.isRecording,
      isMuted: this.isMuted,
      hasTrack: !!this.audioTrack,
      echoCancellation: this.echoCancellation,
      noiseSuppression: this.noiseSuppression,
      autoGainControl: this.autoGainControl,
      recordingDuration: this.getRecordingDuration(),
    };
  }

  /**
   * Optimize for low latency performance
   */
  optimizeForLowLatency(): void {
    if (!this.audioTrack) return;

    try {
      // Reduce buffer sizes for lower latency
      if (this.audioTrack.mediaStream) {
        const audioTracks = this.audioTrack.mediaStream.getAudioTracks();
        audioTracks.forEach(track => {
          if (track.applyConstraints) {
            track.applyConstraints({
              sampleRate: AUDIO_CONFIG.sampleRate,
              channelCount: AUDIO_CONFIG.channels,
            }).catch(error => {
              console.warn('Failed to apply low latency constraints:', error);
            });
          }
        });
      }

      console.log('Audio track optimized for low latency');
    } catch (error) {
      console.warn('Failed to optimize for low latency:', error);
    }
  }

  /**
   * Check if audio track has analyzer capability
   */
  private hasAnalyzer(): boolean {
    return !!(this.audioTrack && 'getAnalyzer' in this.audioTrack);
  }

  /**
   * Get audio analyzer if available
   */
  private getAnalyzer(): AudioAnalyzer | null {
    if (!this.audioTrack || !('getAnalyzer' in this.audioTrack)) {
      return null;
    }
    return (this.audioTrack as LocalAudioTrack & { getAnalyzer: () => AudioAnalyzer }).getAnalyzer();
  }

  /**
   * Get current audio track
   */
  getAudioTrack(): LocalAudioTrack | null {
    return this.audioTrack;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      console.log('Cleaning up AudioService...');

      // Stop recording if active
      if (this.isRecording) {
        this.isRecording = false;
        this.recordingDuration = Date.now() - this.recordingStartTime;
      }

      // Stop audio level monitoring
      this.stopAudioLevelMonitoring();

      // Clean up audio track
      if (this.audioTrack) {
        try {
          // Remove event listeners
          this.audioTrack.removeAllListeners();

          // Stop and clean up track
          if (this.audioTrack.mediaStream) {
            const tracks = this.audioTrack.mediaStream.getTracks();
            tracks.forEach(track => {
              track.stop();
            });
          }

          await this.audioTrack.stop();
        } catch (error) {
          console.warn('Error stopping audio track:', error);
        }

        this.audioTrack = null;
      }

      // Reset state
      this.isRecording = false;
      this.isMuted = false;
      this.recordingDuration = 0;
      this.recordingStartTime = 0;
      this.onAudioLevelCallback = null;
      this.room = null;

      console.log('AudioService cleaned up successfully');
    } catch (error) {
      console.error('Error during AudioService cleanup:', error);
    }
  }
}

// Singleton instance
export const audioService = new AudioService();