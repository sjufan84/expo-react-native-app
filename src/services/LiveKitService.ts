
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Participant
} from 'livekit-client';
import {
  ConnectionState as AppConnectionState,
  DataChannelMessage,
  RetryTrigger,
  SessionConfig,
  SessionSyncEvent,
  LiveKitRoomConfig,
  SessionValidationResult,
  TypingControlPayload,
  TypingState,
  SessionType
} from '../types/message.types';
import { LIVEKIT_CONFIG, ERROR_MESSAGES } from '../utils/constants';
import { retryQueue } from '../utils/retryQueue';
import {
  errorRecoverySystem,
  handleError,
  addErrorListener,
  removeErrorListener,
  type ErrorListener,
  type AppError,
  type RecoveryActionResult,
  type CircuitBreakerState
} from '../utils/errorRecovery';
import { createErrorContext } from '../types/error.types';

export class LiveKitService {
  private room: Room | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = LIVEKIT_CONFIG.reconnectAttempts;
  private reconnectDelay = LIVEKIT_CONFIG.reconnectDelay;
  private connectionTimeout = LIVEKIT_CONFIG.connectionTimeout;
  private onConnectionStateChange?: (state: AppConnectionState) => void;
  private onDataChannelError?: (error: Error, message?: DataChannelMessage) => void;
  private onSessionSyncEvent?: (event: SessionSyncEvent) => void;
  private onTypingEventReceived?: (typingState: TypingState) => void;
  private onRecoveryEvent?: (event: { type: string; error?: AppError; result?: RecoveryActionResult }) => void;
  private lastConnectionState: AppConnectionState = 'DISCONNECTED';
  private errorListener: ErrorListener;
  private activeErrorIds: Set<string> = new Set();
  private currentConnectionUrl?: string;
  private currentConnectionToken?: string;

  // Typing indicator state
  private typingState: TypingState = {
    userTyping: false,
    agentTyping: false,
  };
  private typingTimeouts: { [key: string]: NodeJS.Timeout } = {};

  // Session management
  private currentSession: SessionConfig | null = null;
  private sessionValidationInterval?: NodeJS.Timeout;
  private sessionSyncEnabled = true;

  constructor() {
    // Initialize retry queue integration
    this.initializeRetryIntegration();

    // Initialize error recovery
    this.initializeErrorRecovery();
  }

  /**
   * Connect to a LiveKit room
   */
  async connect(url: string, token: string): Promise<Room> {
    // Store connection parameters for recovery
    this.currentConnectionUrl = url;
    this.currentConnectionToken = token;

    try {
      this.updateConnectionState('CONNECTING');

      // Create new room instance
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
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

      // Handle error through recovery system
      const errorContext = createErrorContext(
        'connect',
        'LiveKitService',
        { url, hasToken: !!token, reconnectAttempts: this.reconnectAttempts }
      );

      const appError = await handleError(error, errorContext);
      this.activeErrorIds.add(appError.id);

      // Check if we should attempt recovery
      if (appError.type.canAutoRecover && !appError.isPermanentFailure) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          await this.attemptReconnection(url, token);
        }
      } else {
        throw error;
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

    // Use string comparison instead of enum to avoid runtime errors
    const state = String(this.room.state).toLowerCase();
    
    if (state.includes('connect') && !state.includes('disconnect') && !state.includes('reconnect')) {
      return 'CONNECTED';
    } else if (state.includes('connecting')) {
      return 'CONNECTING';
    } else if (state.includes('reconnect')) {
      return 'RECONNECTING';
    } else if (state.includes('disconnect')) {
      return 'DISCONNECTED';
    } else {
      return 'FAILED';
    }
  }

  /**
   * Publish audio track to the room
   */
  async publishAudioTrack(): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to a room');
    }

    try {
      await this.room.localParticipant.setMicrophoneEnabled(true);
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

    const participant = this.room.remoteParticipants.get(participantSid);
    if (participant && participant instanceof RemoteParticipant) {
      // Subscribe to all tracks
      participant.trackPublications.forEach((publication) => {
        if (!publication.isSubscribed && publication.track) {
          // Auto-subscription is handled by LiveKit
          console.log('Track available:', publication.trackSid);
        }
      });
      console.log('Subscribed to participant:', participantSid);
    }
  }

  /**
   * Send data message through the room
   */
  async sendData(data: Uint8Array, reliable: boolean = true): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to a room');
    }

    try {
      await this.room.localParticipant.publishData(data, { reliable });
      console.log('Data sent successfully');
    } catch (error) {
      console.error('Failed to send data:', error);

      // Handle error through recovery system
      const errorContext = createErrorContext(
        'sendData',
        'LiveKitService',
        { reliable, dataSize: data.length, roomName: this.room.name }
      );

      const appError = await handleError(error, errorContext);
      this.activeErrorIds.add(appError.id);

      throw error;
    }
  }

  /**
   * Send data message with retry support
   */
  async sendDataWithRetry(message: DataChannelMessage, reliable: boolean = true): Promise<void> {
    try {
      const data = JSON.stringify(message);
      const dataArray = new TextEncoder().encode(data);

      await this.sendData(dataArray, reliable);
    } catch (error) {
      console.error('Failed to send data with retry:', error);

      // Handle error through recovery system
      const errorContext = createErrorContext(
        'sendDataWithRetry',
        'LiveKitService',
        {
          messageId: message.messageId,
          messageType: message.type,
          reliable,
          roomName: this.room?.name
        }
      );

      const appError = await handleError(error, errorContext);
      this.activeErrorIds.add(appError.id);

      // Notify about data channel error for retry handling
      if (this.onDataChannelError) {
        this.onDataChannelError(error as Error, message);
      }

      throw error;
    }
  }

  /**
   * Set connection state change callback
   */
  setConnectionStateChangeCallback(callback: (state: AppConnectionState) => void): void {
    this.onConnectionStateChange = callback;
  }

  /**
   * Set data channel error callback
   */
  setDataChannelErrorCallback(callback: (error: Error, message?: DataChannelMessage) => void): void {
    this.onDataChannelError = callback;
  }

  /**
   * Set session sync event callback
   */
  setSessionSyncEventCallback(callback: (event: SessionSyncEvent) => void): void {
    this.onSessionSyncEvent = callback;
  }

  /**
   * Set typing event callback
   */
  setTypingEventCallback(callback: (typingState: TypingState) => void): void {
    this.onTypingEventReceived = callback;
  }

  /**
   * Check if retry should be attempted based on error type
   */
  private shouldRetryError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();

    // Don't retry for permanent errors
    const permanentErrors = [
      'unauthorized',
      'forbidden',
      'invalid token',
      'room not found',
      'invalid message format',
      'message too large'
    ];

    return !permanentErrors.some(permError => errorMessage.includes(permError));
  }

  /**
   * Initialize retry queue integration
   */
  private initializeRetryIntegration(): void {
    // Set up retry callback
    retryQueue.setRetryCallback(async (retryItem) => {
      try {
        await this.sendDataWithRetry(retryItem.originalDataChannelMessage);
        console.log(`✅ Retry successful for message ${retryItem.message.id}`);

        // Remove from queue on success
        await retryQueue.removeFromQueue(retryItem.message.id);
      } catch (error) {
        console.error(`❌ Retry failed for message ${retryItem.message.id}:`, error);
        throw error; // Let the retry queue handle the failure
      }
    });

    // Set up update callback for monitoring
    retryQueue.setUpdateCallback((stats) => {
      console.log('🔄 Retry queue stats updated:', stats);
    });
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
    return this.room.remoteParticipants;
  }

  /**
   * Check if connected to a room
   */
  isConnected(): boolean {
    if (!this.room) return false;
    const state = String(this.room.state).toLowerCase();
    return state.includes('connect') && !state.includes('disconnect') && !state.includes('reconnect');
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

      // Sync session state on connection
      if (this.currentSession && this.sessionSyncEnabled) {
        this.syncSessionState('room_connected');
      }
    });

    this.room.on(RoomEvent.Disconnected, () => {
      console.log('Room disconnected');
      this.updateConnectionState('DISCONNECTED');

      // Clear typing state on disconnection
      this.clearTypingState();

      // Handle session state on disconnection
      if (this.currentSession && this.sessionSyncEnabled) {
        this.handleSessionDisconnection();
      }
    });

    this.room.on(RoomEvent.Reconnecting, () => {
      console.log('Room reconnecting...');
      this.updateConnectionState('RECONNECTING');

      // Mark session as syncing during reconnection
      if (this.currentSession && this.sessionSyncEnabled) {
        this.currentSession.state = 'syncing';
        this.emitSessionSyncEvent('connection_interruption', 'room_reconnecting');
      }
    });

    this.room.on(RoomEvent.Reconnected, () => {
      console.log('Room reconnected');
      this.updateConnectionState('CONNECTED');
      this.reconnectAttempts = 0;

      // Sync session state after reconnection
      if (this.currentSession && this.sessionSyncEnabled) {
        this.syncSessionState('room_reconnected');
      }
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('Participant connected:', participant.identity);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log('Participant disconnected:', participant.identity);
    });

    this.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log('Track subscribed:', track.kind, 'from', participant.identity);
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log('Track unsubscribed:', track.kind, 'from', participant.identity);
    });

    this.room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant: Participant | undefined) => {
      console.log('Data received from', participant?.identity);

      try {
        // Parse the received data
        const dataString = new TextDecoder().decode(payload);
        const message: DataChannelMessage = JSON.parse(dataString);

        // Handle typing control messages
        if (message.type === 'control' && message.payload &&
            (message.payload.action === 'typing_start' || message.payload.action === 'typing_stop')) {
          this.handleTypingEvent(message.payload as TypingControlPayload);
        }
      } catch (error) {
        console.error('Error processing received data:', error);
      }
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
    const previousState = this.lastConnectionState;
    this.lastConnectionState = state;

    console.log('Connection state updated:', state, '(previous:', previousState, ')');

    // Notify callback
    if (this.onConnectionStateChange) {
      this.onConnectionStateChange(state);
    }

    // Trigger retry actions on connection restoration
    if (previousState !== 'CONNECTED' && state === 'CONNECTED') {
      console.log('🔗 Connection restored, triggering retry queue');
      this.triggerRetryOnConnectionRestored();
    }
  }

  /**
   * Trigger retry when connection is restored
   */
  private async triggerRetryOnConnectionRestored(): Promise<void> {
    try {
      await retryQueue.triggerRetryForAll('connection_restored');
    } catch (error) {
      console.error('Failed to trigger retry on connection restored:', error);
    }
  }

  /**
   * Handle session state during disconnection
   */
  private handleSessionDisconnection(): void {
    if (!this.currentSession) return;

    console.log('Handling session disconnection for session type:', this.currentSession.type);

    // Stop validation during disconnection
    this.stopSessionValidation();

    // Mark session as affected by disconnection
    this.currentSession.state = 'error';
    this.currentSession.inconsistencyDetected = true;

    // Emit session sync event
    this.emitSessionSyncEvent('connection_interruption', 'room_disconnected');
  }

  /**
   * Emit session sync event
   */
  private emitSessionSyncEvent(
    eventType: SessionSyncEvent['type'],
    trigger: string
  ): void {
    if (!this.onSessionSyncEvent || !this.currentSession) return;

    const syncEvent: SessionSyncEvent = {
      type: eventType,
      payload: {
        sessionId: this.currentSession.type || 'unknown',
        frontendState: { ...this.currentSession },
        roomState: this.getRoomState(),
        timestamp: Date.now(),
        trigger,
      },
    };

    this.onSessionSyncEvent(syncEvent);
  }

  /**
   * Set current session configuration
   */
  setSessionConfig(session: SessionConfig): void {
    this.currentSession = { ...session };
    console.log('Session config updated:', session);

    // Configure room based on session type
    if (this.room && this.sessionSyncEnabled) {
      this.configureRoomForSession(session);
    }

    // Start session validation if session is active
    if (session.state === 'active' && !this.sessionValidationInterval) {
      this.startSessionValidation();
    }
  }

  /**
   * Get current session configuration
   */
  getSessionConfig(): SessionConfig | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Validate session state consistency
   */
  validateSessionState(): SessionValidationResult {
    if (!this.currentSession || !this.room) {
      return {
        isValid: false,
        inconsistencies: ['No active session or room'],
        corrections: {},
        needsResync: false,
      };
    }

    const inconsistencies: string[] = [];
    const corrections: Partial<SessionConfig> = {};

    // Check connection state vs session state
    const roomState = this.getConnectionState();
    if (roomState === 'DISCONNECTED' && this.currentSession.state === 'active') {
      inconsistencies.push('Session active but room disconnected');
      corrections.state = 'error';
    }

    // Check room ID consistency
    if (this.currentSession.roomId && this.currentSession.roomId !== this.room.name) {
      inconsistencies.push('Session room ID mismatch');
      corrections.roomId = this.room.name;
    }

    // Check voice session configuration
    if (this.currentSession.type === 'voice-ptt' || this.currentSession.type === 'voice-vad') {
      const hasAudio = this.room.localParticipant.isMicrophoneEnabled;
      if (!hasAudio && this.currentSession.state === 'active') {
        inconsistencies.push('Voice session active but microphone disabled');
        corrections.voiceActivityEnabled = false;
      }
    }

    // Check turn detection configuration
    const expectedTurnDetection = this.getExpectedTurnDetection(this.currentSession.type);
    if (this.currentSession.turnDetection !== expectedTurnDetection) {
      inconsistencies.push(`Turn detection mismatch: expected ${expectedTurnDetection}, got ${this.currentSession.turnDetection}`);
      corrections.turnDetection = expectedTurnDetection;
    }

    const isValid = inconsistencies.length === 0;

    if (!isValid) {
      console.warn('Session validation failed:', inconsistencies);
    }

    return {
      isValid,
      inconsistencies,
      corrections,
      needsResync: inconsistencies.length > 0,
    };
  }

  /**
   * Sync session state with room state
   */
  syncSessionState(trigger: string = 'manual'): void {
    if (!this.currentSession || !this.room || !this.sessionSyncEnabled) {
      return;
    }

    const validation = this.validateSessionState();

    if (validation.needsResync) {
      console.log('Syncing session state due to:', validation.inconsistencies);

      // Apply corrections
      const updatedSession = {
        ...this.currentSession,
        ...validation.corrections,
        lastSyncAt: new Date(),
        syncAttempts: (this.currentSession.syncAttempts || 0) + 1,
        inconsistencyDetected: true,
      };

      this.currentSession = updatedSession;

      // Emit sync event
      if (this.onSessionSyncEvent) {
        const syncEvent: SessionSyncEvent = {
          type: 'session_state_sync',
          payload: {
            sessionId: this.currentSession.type || 'unknown',
            frontendState: updatedSession,
            roomState: this.getRoomState(),
            timestamp: Date.now(),
            trigger,
          },
        };

        this.onSessionSyncEvent(syncEvent);
      }
    }
  }

  /**
   * Configure room settings based on session type
   */
  private configureRoomForSession(session: SessionConfig): void {
    if (!this.room) return;

    const roomConfig = this.getRoomConfigForSession(session);
    console.log('Configuring room for session:', roomConfig);

    // Enable/disable microphone based on session type
    const shouldEnableMic = session.type === 'voice-ptt' || session.type === 'voice-vad';
    if (shouldEnableMic !== this.room.localParticipant.isMicrophoneEnabled) {
      this.room.localParticipant.setMicrophoneEnabled(shouldEnableMic).catch(console.error);
    }

    // Store room configuration
    this.currentSession = {
      ...session,
      roomId: this.room.name,
      lastSyncAt: new Date(),
      voiceActivityEnabled: roomConfig.voiceActivityEnabled,
    };
  }

  /**
   * Get room configuration for session type
   */
  private getRoomConfigForSession(session: SessionConfig): LiveKitRoomConfig {
    const baseConfig: LiveKitRoomConfig = {
      sessionId: session.type || 'unknown',
      sessionType: session.type,
      turnDetection: session.turnDetection || 'none',
      voiceActivityEnabled: false,
      adaptiveStream: true,
      dynacast: true,
      audioSettings: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };

    switch (session.type) {
      case 'voice-ptt':
        return {
          ...baseConfig,
          turnDetection: 'client',
          voiceActivityEnabled: true,
        };
      case 'voice-vad':
        return {
          ...baseConfig,
          turnDetection: 'server',
          voiceActivityEnabled: true,
        };
      case 'text':
        return {
          ...baseConfig,
          turnDetection: 'none',
          voiceActivityEnabled: false,
        };
      default:
        return baseConfig;
    }
  }

  /**
   * Get expected turn detection for session type
   */
  private getExpectedTurnDetection(sessionType: SessionType): 'server' | 'client' | 'none' {
    switch (sessionType) {
      case 'voice-ptt':
        return 'client';
      case 'voice-vad':
        return 'server';
      case 'text':
      default:
        return 'none';
    }
  }

  /**
   * Get current room state
   */
  private getRoomState(): Partial<SessionConfig> {
    if (!this.room) return {};

    return {
      roomId: this.room.name,
      isMuted: !this.room.localParticipant.isMicrophoneEnabled,
      voiceActivityEnabled: this.room.localParticipant.isMicrophoneEnabled,
    };
  }

  /**
   * Start session validation monitoring
   */
  private startSessionValidation(): void {
    if (this.sessionValidationInterval) {
      clearInterval(this.sessionValidationInterval);
    }

    this.sessionValidationInterval = setInterval(() => {
      if (this.sessionSyncEnabled && this.currentSession?.state === 'active') {
        this.syncSessionState('periodic_validation');
      }
    }, 5000); // Validate every 5 seconds
  }

  /**
   * Stop session validation monitoring
   */
  private stopSessionValidation(): void {
    if (this.sessionValidationInterval) {
      clearInterval(this.sessionValidationInterval);
      this.sessionValidationInterval = undefined;
    }
  }

  /**
   * Enable/disable session synchronization
   */
  setSessionSyncEnabled(enabled: boolean): void {
    this.sessionSyncEnabled = enabled;
    console.log(`Session sync ${enabled ? 'enabled' : 'disabled'}`);

    if (!enabled) {
      this.stopSessionValidation();
    } else if (this.currentSession?.state === 'active') {
      this.startSessionValidation();
    }
  }

  /**
   * Send typing indicator event
   */
  async sendTypingIndicator(isTyping: boolean, userType: 'user' | 'agent'): Promise<void> {
    if (!this.room) {
      console.warn('Cannot send typing indicator: not connected to a room');
      return;
    }

    try {
      const typingPayload: TypingControlPayload = {
        action: isTyping ? 'typing_start' : 'typing_stop',
        user_type: userType,
        timestamp: Date.now(),
      };

      const typingMessage: DataChannelMessage = {
        type: 'control',
        payload: typingPayload,
        timestamp: Date.now(),
        messageId: `typing-${Date.now()}`,
      };

      const data = JSON.stringify(typingMessage);
      const dataArray = new TextEncoder().encode(data);

      await this.sendData(dataArray, false); // Use unreliable delivery for typing indicators

      console.log(`Typing indicator sent: ${userType} ${isTyping ? 'started' : 'stopped'} typing`);
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
      // Don't throw errors for typing indicators as they're not critical
    }
  }

  /**
   * Get current typing state
   */
  getTypingState(): TypingState {
    return { ...this.typingState };
  }

  /**
   * Handle received typing event
   */
  private handleTypingEvent(payload: TypingControlPayload): void {
    const { action, user_type, timestamp } = payload;
    const isTyping = action === 'typing_start';

    // Update local typing state
    if (user_type === 'user') {
      this.typingState.userTyping = isTyping;
      this.typingState.lastUserActivity = timestamp;
    } else {
      this.typingState.agentTyping = isTyping;
      this.typingState.lastAgentActivity = timestamp;
    }

    // Clear existing timeout for this user type
    const timeoutKey = `${user_type}_typing`;
    if (this.typingTimeouts[timeoutKey]) {
      clearTimeout(this.typingTimeouts[timeoutKey]);
    }

    // Set timeout to automatically stop typing after inactivity
    if (isTyping) {
      const timeout = user_type === 'agent' ? 3000 : 500; // 3s for agent, 500ms for user
      this.typingTimeouts[timeoutKey] = setTimeout(() => {
        if (user_type === 'user') {
          this.typingState.userTyping = false;
        } else {
          this.typingState.agentTyping = false;
        }
        this.notifyTypingStateChange();
      }, timeout);
    }

    this.notifyTypingStateChange();
  }

  /**
   * Notify about typing state changes
   */
  private notifyTypingStateChange(): void {
    if (this.onTypingEventReceived) {
      this.onTypingEventReceived({ ...this.typingState });
    }
  }

  /**
   * Clear typing state
   */
  clearTypingState(): void {
    // Clear all timeouts
    Object.values(this.typingTimeouts).forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts = {};

    // Reset typing state
    this.typingState = {
      userTyping: false,
      agentTyping: false,
    };

    this.notifyTypingStateChange();
  }

  /**
   * Initialize error recovery system integration
   */
  private initializeErrorRecovery(): void {
    this.errorListener = {
      onErrorOccurred: (error: AppError) => {
        console.log(`[LiveKitService] Error occurred: ${error.type.id}`, error);
        this.notifyRecoveryEvent({ type: 'error_occurred', error });
      },
      onErrorRecovered: (error: AppError, result: RecoveryActionResult) => {
        console.log(`[LiveKitService] Error recovered: ${error.type.id}`, result);
        this.activeErrorIds.delete(error.id);
        this.notifyRecoveryEvent({ type: 'error_recovered', error, result });
      },
      onErrorPermanent: (error: AppError) => {
        console.log(`[LiveKitService] Error marked as permanent: ${error.type.id}`, error);
        this.activeErrorIds.delete(error.id);
        this.notifyRecoveryEvent({ type: 'error_permanent', error });
      },
      onCircuitBreakerStateChange: (state: CircuitBreakerState) => {
        console.log(`[LiveKitService] Circuit breaker state changed:`, state);
        this.notifyRecoveryEvent({ type: 'circuit_breaker_change', result: undefined as any });
      },
    };

    addErrorListener(this.errorListener);
  }

  /**
   * Set recovery event callback
   */
  setRecoveryEventCallback(callback: (event: { type: string; error?: AppError; result?: RecoveryActionResult }) => void): void {
    this.onRecoveryEvent = callback;
  }

  /**
   * Notify about recovery events
   */
  private notifyRecoveryEvent(event: { type: string; error?: AppError; result?: RecoveryActionResult }): void {
    if (this.onRecoveryEvent) {
      this.onRecoveryEvent(event);
    }
  }

  /**
   * Get active errors
   */
  getActiveErrors(): AppError[] {
    return errorRecoverySystem.getActiveErrors().filter(error =>
      this.activeErrorIds.has(error.id)
    );
  }

  /**
   * Get service error statistics
   */
  getErrorStats() {
    return errorRecoverySystem.getStats();
  }

  /**
   * Manual error recovery
   */
  async recoverError(errorId: string): Promise<RecoveryActionResult> {
    return errorRecoverySystem.recoverError(errorId);
  }

  /**
   * Retry a specific error
   */
  async retryError(errorId: string): Promise<boolean> {
    return errorRecoverySystem.retryError(errorId);
  }

  /**
   * Clear all active errors
   */
  clearActiveErrors(): void {
    this.activeErrorIds.clear();
  }

  /**
   * Check if service has active errors
   */
  hasActiveErrors(): boolean {
    return this.activeErrorIds.size > 0;
  }

  /**
   * Attempt automatic reconnection with error recovery
   */
  private async attemptReconnectionWithRecovery(): Promise<void> {
    if (!this.currentConnectionUrl || !this.currentConnectionToken) {
      console.warn('[LiveKitService] Cannot reconnect: missing connection parameters');
      return;
    }

    try {
      // Check if network circuit breaker is open
      const networkBreaker = errorRecoverySystem.getCircuitBreakerState('network');
      if (networkBreaker.isOpen) {
        console.log('[LiveKitService] Network circuit breaker is open, skipping reconnection');
        return;
      }

      console.log(`[LiveKitService] Attempting reconnection (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      await this.connect(this.currentConnectionUrl, this.currentConnectionToken);
    } catch (error) {
      console.error('[LiveKitService] Reconnection failed:', error);

      // Handle reconnection error through recovery system
      const errorContext = createErrorContext(
        'attemptReconnection',
        'LiveKitService',
        {
          reconnectAttempts: this.reconnectAttempts,
          url: this.currentConnectionUrl,
          hasToken: !!this.currentConnectionToken
        }
      );

      await handleError(error, errorContext);
    }
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    // Remove error recovery listener
    removeErrorListener(this.errorListener);

    // Clear active errors
    this.activeErrorIds.clear();

    this.stopSessionValidation();
    this.currentSession = null;
    this.clearTypingState();
    this.disconnect().catch(console.error);
  }
}

// Singleton instance
export const liveKitService = new LiveKitService();