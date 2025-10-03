import { Room, RoomEvent, Track, RemoteParticipant, LocalParticipant, ConnectionState } from '@livekit/react-native';
import { ConnectionState as AppConnectionState } from '../types/message.types';
import { LIVEKIT_CONFIG, ERROR_MESSAGES } from '../utils/constants';

export class LiveKitService {
  private room: Room | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = LIVEKIT_CONFIG.reconnectAttempts;
  private reconnectDelay = LIVEKIT_CONFIG.reconnectDelay;
  private connectionTimeout = LIVEKIT_CONFIG.connectionTimeout;

  constructor() {
    // Initialize any required setup
  }

  /**
   * Connect to a LiveKit room
   */
  async connect(url: string, token: string): Promise<Room> {
    try {
      this.updateConnectionState('CONNECTING');

      // Create new room instance
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        autoSubscribe: true,
      });

      // Set up event listeners
      this.setupEventListeners();

      // Connect with timeout
      const connectPromise = this.room.connect(url, token, {
        autoSubscribe: true,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(ERROR_MESSAGES.timeout)), this.connectionTimeout);
      });

      await Promise.race([connectPromise, timeoutPromise]);

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;
      this.updateConnectionState('CONNECTED');

      console.log('Connected to LiveKit room:', this.room.name);
      return this.room;

    } catch (error) {
      console.error('Failed to connect to LiveKit room:', error);
      this.updateConnectionState('FAILED');

      // Attempt reconnection if not exceeded max attempts
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.attemptReconnection(url, token);
      } else {
        throw new Error(ERROR_MESSAGES.connection);
      }

      throw error;
    }
  }

  /**
   * Disconnect from the current room
   */
  async disconnect(): Promise<void> {
    try {
      if (this.room) {
        await this.room.disconnect();
        this.room = null;
      }
      this.updateConnectionState('DISCONNECTED');
      this.reconnectAttempts = 0;
      console.log('Disconnected from LiveKit room');
    } catch (error) {
      console.error('Error disconnecting from LiveKit room:', error);
      throw error;
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): AppConnectionState {
    if (!this.room) return 'DISCONNECTED';

    switch (this.room.state) {
      case ConnectionState.Connected:
        return 'CONNECTED';
      case ConnectionState.Connecting:
        return 'CONNECTING';
      case ConnectionState.Reconnecting:
        return 'RECONNECTING';
      case ConnectionState.Disconnected:
        return 'DISCONNECTED';
      default:
        return 'FAILED';
    }
  }

  /**
   * Publish audio track to the room
   */
  async publishAudioTrack(track: Track): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to a room');
    }

    try {
      await this.room.localParticipant.publishTrack(track);
      console.log('Audio track published successfully');
    } catch (error) {
      console.error('Failed to publish audio track:', error);
      throw error;
    }
  }

  /**
   * Subscribe to a participant's tracks
   */
  subscribeToParticipant(participantSid: string): void {
    if (!this.room) {
      console.warn('Not connected to a room');
      return;
    }

    const participant = this.room.participants.get(participantSid);
    if (participant && participant instanceof RemoteParticipant) {
      // Subscribe to all tracks
      participant.tracks.forEach((publication) => {
        if (!publication.isSubscribed && publication.track) {
          participant.subscribeToTrack(publication.track);
        }
      });
      console.log('Subscribed to participant:', participantSid);
    }
  }

  /**
   * Send data message through the room
   */
  async sendData(data: Uint8Array, kind: 'reliable' | 'lossy' = 'reliable'): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to a room');
    }

    try {
      await this.room.localParticipant.publishData(data, kind);
      console.log('Data sent successfully');
    } catch (error) {
      console.error('Failed to send data:', error);
      throw error;
    }
  }

  /**
   * Get the current room instance
   */
  getRoom(): Room | null {
    return this.room;
  }

  /**
   * Get local participant
   */
  getLocalParticipant(): LocalParticipant | null {
    return this.room?.localParticipant || null;
  }

  /**
   * Get all participants in the room
   */
  getParticipants(): Map<string, RemoteParticipant> {
    if (!this.room) return new Map();
    return this.room.participants;
  }

  /**
   * Check if connected to a room
   */
  isConnected(): boolean {
    return this.room?.state === ConnectionState.Connected;
  }

  /**
   * Private method to set up event listeners
   */
  private setupEventListeners(): void {
    if (!this.room) return;

    this.room.on(RoomEvent.Connected, () => {
      console.log('Room connected');
      this.updateConnectionState('CONNECTED');
      this.reconnectAttempts = 0;
    });

    this.room.on(RoomEvent.Disconnected, () => {
      console.log('Room disconnected');
      this.updateConnectionState('DISCONNECTED');
    });

    this.room.on(RoomEvent.Reconnecting, () => {
      console.log('Room reconnecting...');
      this.updateConnectionState('RECONNECTING');
    });

    this.room.on(RoomEvent.Reconnected, () => {
      console.log('Room reconnected');
      this.updateConnectionState('CONNECTED');
      this.reconnectAttempts = 0;
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('Participant connected:', participant.identity);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('Participant disconnected:', participant.identity);
    });

    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('Track subscribed:', track.kind, 'from', participant.identity);
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log('Track unsubscribed:', track.kind, 'from', participant.identity);
    });

    this.room.on(RoomEvent.DataReceived, (payload, participant) => {
      console.log('Data received from', participant.identity);
    });
  }

  /**
   * Private method to attempt reconnection
   */
  private async attemptReconnection(url: string, token: string): Promise<void> {
    this.reconnectAttempts++;
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    // Exponential backoff
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.connect(url, token);
    } catch (error) {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.attemptReconnection(url, token);
      } else {
        this.updateConnectionState('FAILED');
        throw error;
      }
    }
  }

  /**
   * Private method to update connection state
   */
  private updateConnectionState(state: AppConnectionState): void {
    // In a real implementation, this would emit events or update state
    console.log('Connection state updated:', state);
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    this.disconnect().catch(console.error);
  }
}

// Singleton instance
export const liveKitService = new LiveKitService();