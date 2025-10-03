import { Platform } from 'react-native';
import { Room, LocalParticipant, Track, LocalAudioTrack } from '@livekit/react-native';
import { AUDIO_CONFIG, ERROR_MESSAGES } from '../utils/constants';

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

export class AudioService {
  private audioTrack: LocalAudioTrack | null = null;
  private isRecording = false;
  private isMuted = false;
  private onAudioLevelCallback: ((level: AudioLevel) => void) | null = null;
  private audioLevelInterval: NodeJS.Timeout | null = null;
  private recordingStartTime: number = 0;
  private recordingDuration: number = 0;

  constructor() {
    // Initialize any required audio setup
  }

  /**
   * Create and configure local audio track
   */
  async createLocalAudioTrack(): Promise<LocalAudioTrack> {
    try {
      if (this.audioTrack) {
        console.warn('Audio track already exists');
        return this.audioTrack;
      }

      // Create audio track with specified configuration
      const audioTrack = await LocalAudioTrack.create({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: AUDIO_CONFIG.sampleRate,
        channelCount: AUDIO_CONFIG.channels,
      });

      this.audioTrack = audioTrack;
      console.log('Local audio track created successfully');
      return audioTrack;

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
      if (!this.audioTrack) {
        await this.createLocalAudioTrack();
      }

      if (!this.audioTrack) {
        throw new Error('No audio track available');
      }

      await room.localParticipant.publishTrack(this.audioTrack);
      console.log('Audio track published successfully');

    } catch (error) {
      console.error('Failed to publish audio track:', error);
      throw error;
    }
  }

  /**
   * Unpublish audio track from room
   */
  async unpublishAudioTrack(room: Room): Promise<void> {
    try {
      if (this.audioTrack && room.localParticipant) {
        await room.localParticipant.unpublishTrack(this.audioTrack);
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
      if (!this.audioTrack) {
        await this.createLocalAudioTrack();
      }

      this.isRecording = true;
      this.recordingStartTime = Date.now();

      // Start monitoring audio levels
      this.startAudioLevelMonitoring();

      console.log('Audio recording started');

    } catch (error) {
      console.error('Failed to start recording:', error);
      this.isRecording = false;
      throw error;
    }
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
      throw error;
    }
  }

  /**
   * Mute/unmute audio
   */
  setMuted(muted: boolean): void {
    if (this.audioTrack) {
      this.audioTrack.setMuted(muted);
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
        // Get audio level from track (mock implementation)
        const level = this.getAudioLevel();

        if (this.onAudioLevelCallback) {
          this.onAudioLevelCallback({
            level,
            timestamp: Date.now(),
          });
        }
      }
    }, 100); // Monitor every 100ms
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
   * Get current audio level (mock implementation)
   */
  private getAudioLevel(): number {
    // In a real implementation, you'd get this from the audio track
    // For now, generate a mock level
    if (!this.isRecording) return 0;

    // Simulate audio level with random values
    return Math.random() * 0.8; // 0-0.8 range
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
    // Implementation would depend on the audio processing library
    console.log(`Echo cancellation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable noise suppression
   */
  setNoiseSuppression(enabled: boolean): void {
    // Implementation would depend on the audio processing library
    console.log(`Noise suppression ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable auto gain control
   */
  setAutoGainControl(enabled: boolean): void {
    // Implementation would depend on the audio processing library
    console.log(`Auto gain control ${enabled ? 'enabled' : 'disabled'}`);
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
      this.stopAudioLevelMonitoring();

      if (this.audioTrack) {
        await this.audioTrack.stop();
        this.audioTrack = null;
      }

      this.isRecording = false;
      this.isMuted = false;
      this.onAudioLevelCallback = null;

      console.log('Audio service cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// Singleton instance
export const audioService = new AudioService();