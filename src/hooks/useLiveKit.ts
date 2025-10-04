
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { Room, RemoteParticipant } from 'livekit-client';
import {
  ConnectionState,
  DataChannelMessage,
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
  subscribeToParticipant: (participantSid: string) => void;
  getParticipants: () => Map<string, RemoteParticipant>;
  isConnected: () => boolean;
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

  // Monitor connection state changes
  useEffect(() => {
    const interval = setInterval(() => {
      const currentState = liveKitService.getConnectionState();
      if (validateConnectionState(currentState) && currentState !== connectionState) {
        setConnectionState(currentState);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [connectionState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected()) {
        disconnect().catch(console.error);
      }
    };
  }, [disconnect, isConnected]);

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
    subscribeToParticipant,
    getParticipants,
    isConnected,
  };
};