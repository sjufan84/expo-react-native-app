
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { Room, RemoteParticipant } from 'livekit-client';
import {
  ConnectionState,
  DataChannelMessage,
  SessionConfig,
  SessionValidationResult,
} from '../types/message.types';
import { liveKitService } from '../services/LiveKitService';
import PermissionService from '../services/PermissionService';
import { LIVEKIT_CONFIG, ERROR_MESSAGES } from '../utils/constants';
import { validateConnectionState } from '../utils/validators';

export interface UseLiveKitReturn {
  room: Room | null;
  connectionState: ConnectionState;
  error: Error | null;
  connect: (token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  sendData: (message: DataChannelMessage) => Promise<void>;
  sendDataWithRetry: (message: DataChannelMessage) => Promise<void>;
  subscribeToParticipant: (participantSid: string) => void;
  getParticipants: () => Map<string, RemoteParticipant>;
  isConnected: () => boolean;

  // Session synchronization methods
  setSessionConfig: (session: SessionConfig) => void;
  getSessionConfig: () => SessionConfig | null;
  syncSessionState: (trigger?: string) => void;
  validateSessionState: () => SessionValidationResult;
  setSessionSyncEnabled: (enabled: boolean) => void;

  // Typing indicator methods
  sendTypingIndicator: (isTyping: boolean, userType: 'user' | 'agent') => Promise<void>;
  getTypingState: () => import('../types/message.types').TypingState;
  setTypingEventCallback: (callback: (typingState: import('../types/message.types').TypingState) => void) => void;
  clearTypingState: () => void;

  // Callback methods
  setConnectionStateChangeCallback: (callback: (state: ConnectionState) => void) => void;
  setDataChannelErrorCallback: (callback: (error: Error, message?: DataChannelMessage) => void) => void;
  setSessionSyncEventCallback: (callback: (event: import('../types/message.types').SessionSyncEvent) => void) => void;
}

export const useLiveKit = (): UseLiveKitReturn => {
  const [room, setRoom] = useState<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const [error, setError] = useState<Error | null>(null);
  const isConnectingRef = useRef(false);

  // Handle permission denied
  const handlePermissionDenied = useCallback((permission: 'microphone' | 'camera') => {
    PermissionService.showPermissionDeniedAlert(permission);
  }, []);

  // Connect to LiveKit room
  const connect = useCallback(async (token: string): Promise<void> => {
    if (isConnectingRef.current) {
      console.warn('Connection already in progress');
      return;
    }

    if (!token) {
      const error = new Error('Token is required for connection');
      setError(error);
      return;
    }

    isConnectingRef.current = true;
    setError(null);

    try {
      // Request microphone permission
      const hasMicPermission = await PermissionService.ensurePermission('microphone');
      if (!hasMicPermission) {
        throw new Error(ERROR_MESSAGES.microphone);
      }

      // Request camera permission (for future image features)
      const hasCameraPermission = await PermissionService.ensurePermission('camera');
      if (!hasCameraPermission) {
        throw new Error(ERROR_MESSAGES.camera);
      }

      // Connect to LiveKit room
      const connectedRoom = await liveKitService.connect(LIVEKIT_CONFIG.url, token);
      setRoom(connectedRoom);
      setConnectionState('CONNECTED');

      console.log('Successfully connected to LiveKit room');

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Connection failed');
      console.error('LiveKit connection error:', error);
      setError(error);
      setConnectionState('FAILED');

      // Show user-friendly error message
      Alert.alert('Connection Error', error.message);
    } finally {
      isConnectingRef.current = false;
    }
  }, [handlePermissionDenied]);

  // Disconnect from LiveKit room
  const disconnect = useCallback(async (): Promise<void> => {
    try {
      await liveKitService.disconnect();
      setRoom(null);
      setConnectionState('DISCONNECTED');
      setError(null);
      console.log('Successfully disconnected from LiveKit room');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Disconnection failed');
      console.error('LiveKit disconnection error:', error);
      setError(error);
    }
  }, []);

  // Send data message
  const sendData = useCallback(async (message: DataChannelMessage): Promise<void> => {
    if (!room || connectionState !== 'CONNECTED') {
      throw new Error('Not connected to a room');
    }

    try {
      const data = JSON.stringify(message);
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(data);

      await liveKitService.sendData(uint8Array, true);
      console.log('Data message sent:', message.type);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to send data');
      console.error('Send data error:', error);
      throw error;
    }
  }, [room, connectionState]);

  // Subscribe to participant
  const subscribeToParticipant = useCallback((participantSid: string): void => {
    if (connectionState !== 'CONNECTED') {
      console.warn('Cannot subscribe: not connected');
      return;
    }

    liveKitService.subscribeToParticipant(participantSid);
  }, [connectionState]);

  // Get participants
  const getParticipants = useCallback((): Map<string, RemoteParticipant> => {
    return liveKitService.getParticipants();
  }, []);

  // Check if connected
  const isConnected = useCallback((): boolean => {
    return liveKitService.isConnected();
  }, []);

  // Send data with retry support
  const sendDataWithRetry = useCallback(async (message: DataChannelMessage): Promise<void> => {
    await liveKitService.sendDataWithRetry(message);
  }, []);

  // Session synchronization methods
  const setSessionConfig = useCallback((session: SessionConfig): void => {
    liveKitService.setSessionConfig(session);
  }, []);

  const getSessionConfig = useCallback((): SessionConfig | null => {
    return liveKitService.getSessionConfig();
  }, []);

  const syncSessionState = useCallback((trigger: string = 'manual'): void => {
    liveKitService.syncSessionState(trigger);
  }, []);

  const validateSessionState = useCallback((): SessionValidationResult => {
    return liveKitService.validateSessionState();
  }, []);

  const setSessionSyncEnabled = useCallback((enabled: boolean): void => {
    liveKitService.setSessionSyncEnabled(enabled);
  }, []);

  // Monitor connection state changes
  useEffect(() => {
    const interval = setInterval(() => {
      const currentState = liveKitService.getConnectionState();
      if (validateConnectionState(currentState) && currentState !== connectionState) {
        setConnectionState(currentState);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []); // Remove connectionState from dependencies to prevent infinite loop

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected()) {
        disconnect().catch(console.error);
      }
    };
  }, []); // Remove function dependencies to prevent infinite loop

  // Log state changes for debugging
  useEffect(() => {
    console.log('LiveKit connection state changed:', connectionState);
  }, [connectionState]);

  return {
    room,
    connectionState,
    error,
    connect,
    disconnect,
    sendData,
    sendDataWithRetry,
    subscribeToParticipant,
    getParticipants,
    isConnected,
    setSessionConfig,
    getSessionConfig,
    syncSessionState,
    validateSessionState,
    setSessionSyncEnabled,
    sendTypingIndicator: liveKitService.sendTypingIndicator.bind(liveKitService),
    getTypingState: liveKitService.getTypingState.bind(liveKitService),
    setTypingEventCallback: liveKitService.setTypingEventCallback.bind(liveKitService),
    clearTypingState: liveKitService.clearTypingState.bind(liveKitService),
    setConnectionStateChangeCallback: liveKitService.setConnectionStateChangeCallback.bind(liveKitService),
    setDataChannelErrorCallback: liveKitService.setDataChannelErrorCallback.bind(liveKitService),
    setSessionSyncEventCallback: liveKitService.setSessionSyncEventCallback.bind(liveKitService),
  };
};