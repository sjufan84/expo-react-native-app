/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { createContext, useContext, useReducer, useCallback, useState, useEffect, ReactNode } from 'react';
import { useLiveKit } from '../hooks/useLiveKit';
import { Message, InputMode, DataChannelMessage, ConnectionState, ProcessedImageResult, ImageMessageData, SessionConfig, SessionType, RetryQueueStats, SessionSyncEvent, TypingState } from '../types/message.types';
import { ERROR_MESSAGES, CHAT_CONFIG } from '../utils/constants';
import { generateMessageId, validateMessage } from '../utils/formatters';
import { retryQueue } from '../utils/retryQueue';
import {
  errorRecoverySystem,
  handleError,
  addErrorListener,
  removeErrorListener,
  getErrorStats,
  getActiveErrors,
  type ErrorListener,
  type AppError,
  type RecoveryActionResult,
  type CircuitBreakerState
} from '../utils/errorRecovery';
import { createErrorContext } from '../types/error.types';
// import { LIVEKIT_CONFIG } from '../utils/constants';

// Agent state interface
interface AgentState {
  messages: Message[];
  isConnected: boolean;
  isTyping: boolean;
  currentInputMode: InputMode;
  error: string | null;
  agentStatus: 'idle' | 'listening' | 'processing' | 'speaking';
  session: SessionConfig;
  retryQueueStats: RetryQueueStats;
  typingState: TypingState;
  activeErrors: AppError[];
  errorStats: any;
  circuitBreakerState: CircuitBreakerState | null;
}

// Action types
type AgentAction =
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<Message> } }
  | { type: 'SET_CONNECTION_STATUS'; payload: boolean }
  | { type: 'SET_TYPING'; payload: boolean }
  | { type: 'SET_INPUT_MODE'; payload: InputMode }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_AGENT_STATUS'; payload: AgentState['agentStatus'] }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'START_SESSION'; payload: { type: SessionType; voiceMode?: 'push-to-talk' | 'continuous' } }
  | { type: 'END_SESSION' }
  | { type: 'UPDATE_SESSION'; payload: Partial<SessionConfig> }
  | { type: 'UPDATE_RETRY_QUEUE_STATS'; payload: RetryQueueStats }
  | { type: 'UPDATE_TYPING_STATE'; payload: TypingState }
  | { type: 'SET_ACTIVE_ERRORS'; payload: AppError[] }
  | { type: 'ADD_ACTIVE_ERROR'; payload: AppError }
  | { type: 'REMOVE_ACTIVE_ERROR'; payload: string }
  | { type: 'UPDATE_ERROR_STATS'; payload: any }
  | { type: 'SET_CIRCUIT_BREAKER_STATE'; payload: CircuitBreakerState | null };

// Initial state
const initialState: AgentState = {
  messages: [],
  isConnected: false,
  isTyping: false,
  currentInputMode: { type: 'text', isActive: true },
  error: null,
  agentStatus: 'idle',
  session: {
    type: null,
    state: 'idle',
    startedAt: null,
  },
  retryQueueStats: {
    totalItems: 0,
    pendingItems: 0,
    failedItems: 0,
    completedItems: 0,
    averageRetryCount: 0,
  },
  typingState: {
    userTyping: false,
    agentTyping: false,
  },
  activeErrors: [],
  errorStats: null,
  circuitBreakerState: null,
};

// Reducer function
const agentReducer = (state: AgentState, action: AgentAction): AgentState => {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id
            ? { ...msg, ...action.payload.updates }
            : msg
        ),
      };

    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        isConnected: action.payload,
      };

    case 'SET_TYPING':
      return {
        ...state,
        isTyping: action.payload,
      };

    case 'SET_INPUT_MODE':
      return {
        ...state,
        currentInputMode: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'SET_AGENT_STATUS':
      return {
        ...state,
        agentStatus: action.payload,
      };

    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: [],
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'START_SESSION':
      return {
        ...state,
        session: {
          type: action.payload.type,
          state: 'active',
          startedAt: new Date(),
          voiceMode: action.payload.voiceMode,
          isMuted: false,
          turnDetection: action.payload.type === 'voice-ptt' ? 'client' : action.payload.type === 'voice-vad' ? 'server' : 'none',
        },
      };

    case 'END_SESSION':
      return {
        ...state,
        session: {
          type: null,
          state: 'idle',
          startedAt: null,
        },
        agentStatus: 'idle',
      };

    case 'UPDATE_SESSION':
      return {
        ...state,
        session: {
          ...state.session,
          ...action.payload,
        },
      };

    case 'UPDATE_RETRY_QUEUE_STATS':
      return {
        ...state,
        retryQueueStats: action.payload,
      };

    case 'UPDATE_TYPING_STATE':
      return {
        ...state,
        typingState: action.payload,
      };

    case 'SET_ACTIVE_ERRORS':
      return {
        ...state,
        activeErrors: action.payload,
      };

    case 'ADD_ACTIVE_ERROR':
      return {
        ...state,
        activeErrors: [...state.activeErrors, action.payload],
      };

    case 'REMOVE_ACTIVE_ERROR':
      return {
        ...state,
        activeErrors: state.activeErrors.filter(error => error.id !== action.payload),
      };

    case 'UPDATE_ERROR_STATS':
      return {
        ...state,
        errorStats: action.payload,
      };

    case 'SET_CIRCUIT_BREAKER_STATE':
      return {
        ...state,
        circuitBreakerState: action.payload,
      };

    default:
      return state;
  }
};

// Context interface
interface AgentContextType extends AgentState {
  // LiveKit methods
  connect: (token: string) => Promise<void>;
  disconnect: () => Promise<void>;

  // Session methods
  startSession: (type: SessionType, voiceMode?: 'push-to-talk' | 'continuous') => Promise<void>;
  endSession: () => Promise<void>;
  updateSession: (updates: Partial<SessionConfig>) => void;

  // Session synchronization methods
  syncSessionWithRoom: () => void;
  validateAndCorrectSession: () => void;

  // Message methods
  sendMessage: (content: string, type: Message['type']) => Promise<void>;
  sendImage: (imageUri: string, metadata?: any) => Promise<void>;
  sendProcessedImage: (image: ProcessedImageResult, caption?: string) => Promise<void>;

  // Retry methods
  retryMessage: (messageId: string) => Promise<boolean>;
  clearRetryQueue: () => Promise<void>;

  // UI methods
  setInputMode: (mode: InputMode) => void;
  clearMessages: () => void;
  clearError: () => void;

  // Voice methods (placeholder for now)
  startVoiceRecording: () => Promise<void>;
  stopVoiceRecording: () => Promise<void>;

  // Typing indicator methods
  sendUserTypingIndicator: (isTyping: boolean) => Promise<void>;
  sendAgentTypingIndicator: (isTyping: boolean) => Promise<void>;
  clearTypingIndicators: () => void;

  // Error recovery methods
  recoverError: (errorId: string) => Promise<RecoveryActionResult>;
  retryError: (errorId: string) => Promise<boolean>;
  clearActiveErrors: () => void;
  getErrorStats: () => any;
  resetCircuitBreaker: (category?: string) => void;

  // Direct state manipulation
  addMessage: (message: Message) => void;
  updateMessageStatus: (messageId: string, status: Message['status']) => void;

  // Connection Status
  connectionState: ConnectionState;
}

// Create context
const AgentContext = createContext<AgentContextType | undefined>(undefined);

// Provider component
export const AgentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(agentReducer, initialState);
  const liveKit = useLiveKit();

  // Development mode: simulate connection for testing
  const [mockConnected, setMockConnected] = useState(false);

  // Initialize session synchronization and retry queue on mount
  useEffect(() => {
    // Set up LiveKit service callbacks for retry handling
    liveKit.setConnectionStateChangeCallback((connectionState) => {
      console.log('LiveKit connection state changed:', connectionState);
    });

    liveKit.setDataChannelErrorCallback(async (error, dataChannelMessage) => {
      console.log('LiveKit data channel error:', error);

      if (dataChannelMessage) {
        // Find the corresponding message and add to retry queue
        const message = state.messages.find(msg => msg.id === dataChannelMessage.messageId);
        if (message && message.sender === 'user') {
          await retryQueue.addToQueue(message, dataChannelMessage, error.message);
        }
      }
    });

    // Set up session sync event handling
    liveKit.setSessionSyncEventCallback((syncEvent: SessionSyncEvent) => {
      console.log('Session sync event received:', syncEvent);
      handleSessionSyncEvent(syncEvent);
    });

    // Set up typing event handling
    liveKit.setTypingEventCallback((typingState: TypingState) => {
      console.log('Typing state updated:', typingState);
      dispatch({ type: 'UPDATE_TYPING_STATE', payload: typingState });
    });

    // Set up retry queue stats update callback
    retryQueue.setUpdateCallback((stats) => {
      dispatch({ type: 'UPDATE_RETRY_QUEUE_STATS', payload: stats });
    });

    // Initial stats update
    dispatch({ type: 'UPDATE_RETRY_QUEUE_STATS', payload: retryQueue.getStats() });

    // Initialize error recovery system
    initializeErrorRecovery();

    // Cleanup on unmount
    return () => {
      retryQueue.clearQueue();
      cleanupErrorRecovery();
    };
  }, [liveKit, state.messages]);

  // Handle session sync events
  const handleSessionSyncEvent = useCallback((syncEvent: SessionSyncEvent) => {
    const { type, payload } = syncEvent;

    switch (type) {
      case 'session_state_sync':
        console.log('Session state synchronized:', payload.trigger);
        // Update local session state with synced data
        dispatch({
          type: 'UPDATE_SESSION',
          payload: payload.frontendState
        });
        break;

      case 'connection_interruption':
        console.warn('Connection interruption detected:', payload.trigger);
        // Handle connection interruption
        if (payload.frontendState.state === 'error') {
          dispatch({
            type: 'UPDATE_SESSION',
            payload: { state: 'error', inconsistencyDetected: true }
          });
        }
        break;

      case 'session_inconsistency':
        console.warn('Session inconsistency detected:', payload.frontendState);
        // Handle session inconsistency - auto-correct if needed
        if (payload.frontendState.state === 'syncing') {
          dispatch({
            type: 'UPDATE_SESSION',
            payload: { state: 'syncing' }
          });
        }
        break;

      default:
        console.log('Unhandled session sync event:', type);
    }
  }, []);

  // Sync session with LiveKit room state
  const syncSessionWithRoom = useCallback(() => {
    if (state.session.state === 'active') {
      liveKit.syncSessionState('context_sync');
    }
  }, [state.session.state, liveKit]);

  // Validate and auto-correct session state
  const validateAndCorrectSession = useCallback(() => {
    if (state.session.state !== 'active') return;

    const validation = liveKit.validateSessionState();

    if (!validation.isValid) {
      console.warn('Session validation failed:', validation.inconsistencies);

      // Apply corrections automatically
      dispatch({
        type: 'UPDATE_SESSION',
        payload: validation.corrections
      });

      // Set error state if critical issues
      if (validation.inconsistencies.length > 2) {
        dispatch({
          type: 'SET_ERROR',
          payload: 'Session synchronization issues detected. Attempting to recover...'
        });
      }
    }
  }, [state.session.state, liveKit]);

  // Connect to agent
  const connect = useCallback(async (token: string) => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null });

      // Development mode: simulate connection
      if (__DEV__ && !token) {
        console.log('🔧 Development Mode: Simulating LiveKit connection');
        // Simulate connection delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        setMockConnected(true);
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: true });
        dispatch({ type: 'SET_AGENT_STATUS', payload: 'idle' });
        return;
      }

      // Production mode: real LiveKit connection
      await liveKit.connect(token);
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: true });
      dispatch({ type: 'SET_AGENT_STATUS', payload: 'idle' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.connection;
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  }, [liveKit]);

  // Disconnect from agent
  const disconnect = useCallback(async () => {
    try {
      // End any active session
      if (state.session.state === 'active') {
        dispatch({ type: 'END_SESSION' });
      }

      // Handle mock disconnection in development mode
      if (__DEV__ && mockConnected) {
        console.log('🔧 Development Mode: Simulating disconnection');
        setMockConnected(false);
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: false });
        dispatch({ type: 'SET_AGENT_STATUS', payload: 'idle' });
        return;
      }

      // Production mode: real disconnection
      await liveKit.disconnect();
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: false });
      dispatch({ type: 'SET_AGENT_STATUS', payload: 'idle' });
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }, [liveKit, mockConnected, state.session.state]);

  // Start a new session
  const startSession = useCallback(async (type: SessionType, voiceMode?: 'push-to-talk' | 'continuous') => {
    try {
      if (!state.isConnected) {
        console.warn('Cannot start session: not connected');
        return;
      }

      if (state.session.state === 'active') {
        console.warn('Session already active');
        return;
      }

      console.log(`Starting ${type} session${voiceMode ? ` with ${voiceMode} mode` : ''}`);

      // Determine turn detection mode
      const turnDetection = type === 'voice-ptt' ? 'client' : type === 'voice-vad' ? 'server' : 'none';

      // Create session configuration
      const sessionConfig: SessionConfig = {
        type,
        state: 'active',
        startedAt: new Date(),
        voiceMode,
        turnDetection,
        isMuted: false,
        voiceActivityEnabled: type === 'voice-ptt' || type === 'voice-vad',
        roomId: liveKit.room?.name,
        lastSyncAt: new Date(),
        syncAttempts: 0,
        inconsistencyDetected: false,
      };

      // Set session configuration in LiveKit service
      liveKit.setSessionConfig(sessionConfig);

      // Dispatch session start locally
      dispatch({
        type: 'START_SESSION',
        payload: { type, voiceMode }
      });

      // Send session start message to agent
      const sessionMessage: DataChannelMessage = {
        type: 'control',
        payload: {
          action: 'start_session',
          session_type: type,
          voice_mode: voiceMode,
          user_id: 'user-' + Date.now(), // Generate unique user ID
          turn_detection: turnDetection,
          room_id: liveKit.room?.name,
        },
        timestamp: Date.now(),
        messageId: generateMessageId(),
      };

      await liveKit.sendData(sessionMessage);

      // Configure LiveKit room based on session type
      if (type === 'voice-ptt' || type === 'voice-vad') {
        // Enable audio tracks for voice sessions
        console.log('🎙️ Enabling audio for voice session');

        // Auto-initialize audio for voice sessions
        if (liveKit.room) {
          // Note: Audio initialization will be handled by useVoice hook
          // when components mount. This ensures proper integration.
          console.log('LiveKit room available for voice session');
        } else {
          console.warn('No LiveKit room available for voice session');
        }
      }

      // Perform initial session synchronization
      setTimeout(() => {
        syncSessionWithRoom();
      }, 1000);

      console.log(`✅ ${type} session started successfully`);
    } catch (error) {
      console.error('Failed to start session:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to start session' });

      // Reset session state on failure
      dispatch({ type: 'END_SESSION' });
    }
  }, [state.isConnected, state.session.state, liveKit, syncSessionWithRoom]);

  // End the current session
  const endSession = useCallback(async () => {
    try {
      if (state.session.state !== 'active' && state.session.state !== 'error') {
        console.warn('No active session to end');
        return;
      }

      console.log(`Ending ${state.session.type} session`);

      // Set session state to ending
      dispatch({ type: 'UPDATE_SESSION', payload: { state: 'ending' } });

      // Clear session configuration in LiveKit service
      liveKit.setSessionConfig({
        type: null,
        state: 'idle',
        startedAt: null,
      });

      // Send session end message to agent
      const sessionMessage: DataChannelMessage = {
        type: 'control',
        payload: {
          action: 'end_session',
        },
        timestamp: Date.now(),
        messageId: generateMessageId(),
      };

      try {
        await liveKit.sendData(sessionMessage);
      } catch (error) {
        console.warn('Failed to send session end message:', error);
      }

      // Cleanup based on session type
      if (state.session.type === 'voice-ptt' || state.session.type === 'voice-vad') {
        // Cleanup audio resources
        console.log('🎙️ Cleaning up audio resources');

        // Note: Audio cleanup will be handled by useVoice hook
        // when components unmount or cleanup is called.
        // This ensures proper resource management.
        console.log('Audio cleanup delegated to useVoice hook');
      }

      // End the session locally
      dispatch({ type: 'END_SESSION' });

      console.log('✅ Session ended successfully');
    } catch (error) {
      console.error('Failed to end session:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to end session' });

      // Force end session on error
      dispatch({ type: 'END_SESSION' });
    }
  }, [state.session.state, state.session.type, liveKit]);

  // Update session configuration
  const updateSession = useCallback((updates: Partial<SessionConfig>) => {
    if (state.session.state !== 'active') {
      console.warn('Cannot update session: no active session');
      return;
    }

    console.log('Updating session:', updates);
    dispatch({ type: 'UPDATE_SESSION', payload: updates });
  }, [state.session.state]);

  // Send text message
  const sendMessage = useCallback(async (content: string, type: Message['type'] = 'text') => {
    // Auto-start text session if not active
    if (state.session.state === 'idle' && type === 'text') {
      await startSession('text');
    }
    // Validate message
    const validationError = validateMessage(content, CHAT_CONFIG.maxMessageLength);
    if (validationError) {
      dispatch({ type: 'SET_ERROR', payload: validationError });
      return;
    }

    // Create user message
    const userMessage: Message = {
      id: generateMessageId(),
      sender: 'user',
      content,
      timestamp: new Date(),
      status: 'sending',
      type,
      mode: state.currentInputMode.type,
    };

    // Add message to state
    dispatch({ type: 'ADD_MESSAGE', payload: userMessage });

    try {
      // Send via LiveKit with retry support
      const dataMessage: DataChannelMessage = {
        type: 'text',
        payload: { content, type },
        timestamp: Date.now(),
        messageId: userMessage.id,
      };

      await liveKit.sendDataWithRetry(dataMessage);

      // Update message status to sent
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { id: userMessage.id, updates: { status: 'sent' } }
      });

      // Remove from retry queue if it was there
      await retryQueue.removeFromQueue(userMessage.id);

      // Set agent to processing state
      dispatch({ type: 'SET_AGENT_STATUS', payload: 'processing' });
      dispatch({ type: 'SET_TYPING', payload: true });

    } catch (error) {
      console.error('Send message failed:', error);

      // Add to retry queue
      const dataMessage: DataChannelMessage = {
        type: 'text',
        payload: { content, type },
        timestamp: Date.now(),
        messageId: userMessage.id,
      };

      await retryQueue.addToQueue(userMessage, dataMessage, (error as Error).message);

      // Update message status to retrying
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { id: userMessage.id, updates: { status: 'retrying' } }
      });

      const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.generic;
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [liveKit, state.currentInputMode.type, state.session.state, startSession]);

  // Send image (legacy method for backward compatibility)
  const sendImage = useCallback(async (imageUri: string, metadata?: any) => {
    const imageData: ImageMessageData = {
      uri: imageUri,
      width: 0, // Unknown dimensions
      height: 0, // Unknown dimensions
      fileSize: 0, // Unknown file size
      type: 'image/jpeg', // Default type
      caption: metadata?.caption,
    };

    const imageMessage: Message = {
      id: generateMessageId(),
      sender: 'user',
      content: metadata?.caption || 'Image shared',
      timestamp: new Date(),
      status: 'sending',
      type: 'image',
      imageUri,
      imageData,
      mode: 'image',
    };

    // Add message to state
    dispatch({ type: 'ADD_MESSAGE', payload: imageMessage });

    try {
      // Send via LiveKit with retry support
      const dataMessage: DataChannelMessage = {
        type: 'image',
        payload: { imageData, metadata },
        timestamp: Date.now(),
        messageId: imageMessage.id,
      };

      await liveKit.sendDataWithRetry(dataMessage);

      // Update message status to sent
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { id: imageMessage.id, updates: { status: 'sent' } }
      });

      // Remove from retry queue if it was there
      await retryQueue.removeFromQueue(imageMessage.id);

      // Set agent to processing state
      dispatch({ type: 'SET_AGENT_STATUS', payload: 'processing' });
      dispatch({ type: 'SET_TYPING', payload: true });

    } catch (error) {
      console.error('Send image failed:', error);

      // Add to retry queue
      const dataMessage: DataChannelMessage = {
        type: 'image',
        payload: { imageData, metadata },
        timestamp: Date.now(),
        messageId: imageMessage.id,
      };

      await retryQueue.addToQueue(imageMessage, dataMessage, (error as Error).message);

      // Update message status to retrying
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { id: imageMessage.id, updates: { status: 'retrying' } }
      });

      const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.generic;
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [liveKit]);

  // Send processed image (new enhanced method)
  const sendProcessedImage = useCallback(async (image: ProcessedImageResult, caption?: string) => {
    const imageData: ImageMessageData = {
      uri: image.uri,
      width: image.width,
      height: image.height,
      fileSize: image.fileSize,
      type: image.type,
      base64: image.base64,
      compressionRatio: image.compressionRatio,
      caption,
    };

    const imageMessage: Message = {
      id: generateMessageId(),
      sender: 'user',
      content: caption || 'Image shared',
      timestamp: new Date(),
      status: 'sending',
      type: 'image',
      imageData,
      mode: 'image',
    };

    // Add message to state
    dispatch({ type: 'ADD_MESSAGE', payload: imageMessage });

    try {
      // Prepare data for LiveKit transmission
      let transmissionData: any = {
        imageData: {
          uri: image.uri,
          width: image.width,
          height: image.height,
          fileSize: image.fileSize,
          type: image.type,
          compressionRatio: image.compressionRatio,
          caption,
        },
      };

      // Include base64 if available and not too large
      if (image.base64 && image.fileSize < 5 * 1024 * 1024) { // 5MB limit
        transmissionData.imageData.base64 = image.base64;
      } else if (image.base64) {
        console.warn('Image base64 data too large for transmission, sending URI only');
      }

      // Send via LiveKit with retry support
      const dataMessage: DataChannelMessage = {
        type: 'image',
        payload: transmissionData,
        timestamp: Date.now(),
        messageId: imageMessage.id,
      };

      await liveKit.sendDataWithRetry(dataMessage);

      console.log('Image sent via LiveKit:', {
        messageId: imageMessage.id,
        size: image.fileSize,
        dimensions: `${image.width}x${image.height}`,
        hasBase64: !!image.base64,
      });

      // Update message status to sent
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { id: imageMessage.id, updates: { status: 'sent' } }
      });

      // Remove from retry queue if it was there
      await retryQueue.removeFromQueue(imageMessage.id);

      // Set agent to processing state
      dispatch({ type: 'SET_AGENT_STATUS', payload: 'processing' });
      dispatch({ type: 'SET_TYPING', payload: true });

    } catch (error) {
      console.error('Error sending image via LiveKit:', error);

      // Prepare data for retry queue
      let transmissionData: any = {
        imageData: {
          uri: image.uri,
          width: image.width,
          height: image.height,
          fileSize: image.fileSize,
          type: image.type,
          compressionRatio: image.compressionRatio,
          caption,
        },
      };

      if (image.base64 && image.fileSize < 5 * 1024 * 1024) {
        transmissionData.imageData.base64 = image.base64;
      }

      // Add to retry queue
      const dataMessage: DataChannelMessage = {
        type: 'image',
        payload: transmissionData,
        timestamp: Date.now(),
        messageId: imageMessage.id,
      };

      await retryQueue.addToQueue(imageMessage, dataMessage, (error as Error).message);

      // Update message status to retrying
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { id: imageMessage.id, updates: { status: 'retrying' } }
      });

      const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.generic;
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [liveKit]);

  const addMessage = useCallback((message: Message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  }, []);

  const updateMessageStatus = useCallback((messageId: string, status: Message['status']) => {
    dispatch({ type: 'UPDATE_MESSAGE', payload: { id: messageId, updates: { status } } });
  }, []);

  // Set input mode
  const setInputMode = useCallback((mode: InputMode) => {
    dispatch({ type: 'SET_INPUT_MODE', payload: mode });
  }, []);

  // Clear messages
  const clearMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Voice recording methods
  const startVoiceRecording = useCallback(async () => {
    try {
      // Import useVoice hook to get access to voice functionality
      const { useVoice } = await import('../hooks/useVoice');
      // Note: This is a simplified approach. In production, you might want to
      // pass voice functionality through props or context

      console.log('Starting voice recording...');
      dispatch({ type: 'SET_AGENT_STATUS', payload: 'listening' });

      // Voice recording will be handled by the useVoice hook in components
      // This method is for context-level coordination

    } catch (error) {
      console.error('Failed to start voice recording:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to start voice recording' });
    }
  }, []);

  const stopVoiceRecording = useCallback(async () => {
    try {
      console.log('Stopping voice recording...');
      dispatch({ type: 'SET_AGENT_STATUS', payload: 'processing' });

      // Voice recording will be handled by the useVoice hook in components
      // This method is for context-level coordination

    } catch (error) {
      console.error('Failed to stop voice recording:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to stop voice recording' });
    }
  }, []);

  // Retry a specific message
  const retryMessage = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      console.log(`Manually retrying message: ${messageId}`);
      return await retryQueue.retryMessage(messageId);
    } catch (error) {
      console.error('Failed to retry message:', error);
      return false;
    }
  }, []);

  // Clear the retry queue
  const clearRetryQueue = useCallback(async (): Promise<void> => {
    try {
      console.log('Clearing retry queue...');
      await retryQueue.clearQueue();
      dispatch({ type: 'UPDATE_RETRY_QUEUE_STATS', payload: retryQueue.getStats() });
    } catch (error) {
      console.error('Failed to clear retry queue:', error);
    }
  }, []);

  // Send user typing indicator
  const sendUserTypingIndicator = useCallback(async (isTyping: boolean): Promise<void> => {
    try {
      await liveKit.sendTypingIndicator(isTyping, 'user');
    } catch (error) {
      console.error('Failed to send user typing indicator:', error);
    }
  }, [liveKit]);

  // Send agent typing indicator
  const sendAgentTypingIndicator = useCallback(async (isTyping: boolean): Promise<void> => {
    try {
      await liveKit.sendTypingIndicator(isTyping, 'agent');
    } catch (error) {
      console.error('Failed to send agent typing indicator:', error);
    }
  }, [liveKit]);

  // Clear typing indicators
  const clearTypingIndicators = useCallback(() => {
    liveKit.clearTypingState();
  }, [liveKit]);

  // Monitor LiveKit connection state
  React.useEffect(() => {
    // In development mode with mock connection, don't update from liveKit
    if (__DEV__ && mockConnected) {
      return;
    }
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: liveKit.isConnected() });
  }, [liveKit.isConnected(), mockConnected]);

  // Handle LiveKit errors
  React.useEffect(() => {
    // In development mode with mock connection, don't show liveKit errors
    if (__DEV__ && mockConnected) {
      return;
    }
    if (liveKit.error) {
      const errorMessage = liveKit.error.message || ERROR_MESSAGES.generic;
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [liveKit.error, mockConnected]);

  // Auto-connect in development mode for testing
  React.useEffect(() => {
    if (__DEV__ && !mockConnected && !state.isConnected) {
      console.log('🔧 Development Mode: Auto-connecting for testing...');
      connect(''); // Empty token for mock connection
    }
  }, [mockConnected, state.isConnected]); // Remove connect dependency to prevent infinite loop

  // Session validation monitoring
  useEffect(() => {
    if (state.session.state === 'active') {
      const validationInterval = setInterval(() => {
        validateAndCorrectSession();
      }, 10000); // Validate every 10 seconds

      return () => clearInterval(validationInterval);
    }
  }, [state.session.state, validateAndCorrectSession]);

  // Auto-sync session on connection state changes
  useEffect(() => {
    if (state.session.state === 'active' && liveKit.connectionState === 'CONNECTED') {
      setTimeout(() => {
        syncSessionWithRoom();
      }, 2000); // Delay to allow room to fully initialize
    }
  }, [liveKit.connectionState, state.session.state, syncSessionWithRoom]);

  // Initialize error recovery system
  const initializeErrorRecovery = useCallback(() => {
    const errorListener: ErrorListener = {
      onErrorOccurred: (error: AppError) => {
        console.log('[AgentContext] Error occurred:', error.type.id);
        dispatch({ type: 'ADD_ACTIVE_ERROR', payload: error });
        updateErrorStats();
      },
      onErrorRecovered: (error: AppError, result: RecoveryActionResult) => {
        console.log('[AgentContext] Error recovered:', error.type.id);
        dispatch({ type: 'REMOVE_ACTIVE_ERROR', payload: error.id });
        updateErrorStats();

        // Set user-friendly message if recovery succeeded
        if (result.success && result.userMessage) {
          dispatch({ type: 'SET_ERROR', payload: result.userMessage });
          setTimeout(() => dispatch({ type: 'CLEAR_ERROR' }), 3000);
        }
      },
      onErrorPermanent: (error: AppError) => {
        console.log('[AgentContext] Error marked as permanent:', error.type.id);
        dispatch({ type: 'REMOVE_ACTIVE_ERROR', payload: error.id });

        // Set permanent error message
        dispatch({ type: 'SET_ERROR', payload: error.type.userMessage });
      },
      onCircuitBreakerStateChange: (state: CircuitBreakerState) => {
        console.log('[AgentContext] Circuit breaker state changed:', state);
        dispatch({ type: 'SET_CIRCUIT_BREAKER_STATE', payload: state });

        // Notify user if circuit breaker opens
        if (state.isOpen) {
          dispatch({
            type: 'SET_ERROR',
            payload: 'Service temporarily unavailable due to repeated failures. Please try again later.'
          });
        }
      },
    };

    addErrorListener(errorListener);
    updateErrorStats();
  }, []);

  // Cleanup error recovery
  const cleanupErrorRecovery = useCallback(() => {
    // Error recovery system cleanup is handled by the service itself
    console.log('[AgentContext] Error recovery cleanup completed');
  }, []);

  // Update error statistics
  const updateErrorStats = useCallback(() => {
    const stats = getErrorStats();
    const activeErrors = getActiveErrors();
    dispatch({ type: 'UPDATE_ERROR_STATS', payload: stats });
    dispatch({ type: 'SET_ACTIVE_ERRORS', payload: activeErrors });
  }, []);

  // Error recovery methods
  const recoverError = useCallback(async (errorId: string): Promise<RecoveryActionResult> => {
    try {
      const result = await errorRecoverySystem.recoverError(errorId);
      updateErrorStats();
      return result;
    } catch (error) {
      console.error('[AgentContext] Failed to recover error:', error);
      throw error;
    }
  }, [updateErrorStats]);

  const retryError = useCallback(async (errorId: string): Promise<boolean> => {
    try {
      const success = await errorRecoverySystem.retryError(errorId);
      updateErrorStats();
      return success;
    } catch (error) {
      console.error('[AgentContext] Failed to retry error:', error);
      return false;
    }
  }, [updateErrorStats]);

  const clearActiveErrors = useCallback(() => {
    errorRecoverySystem.clearErrorHistory();
    updateErrorStats();
    dispatch({ type: 'CLEAR_ERROR' });
  }, [updateErrorStats]);

  const getErrorStatsCallback = useCallback(() => {
    return getErrorStats();
  }, []);

  const resetCircuitBreaker = useCallback((category?: string) => {
    if (category) {
      errorRecoverySystem.resetCircuitBreaker(category as any);
    } else {
      errorRecoverySystem.resetCircuitBreaker();
    }
    updateErrorStats();
  }, [updateErrorStats]);

  // Determine connection state for context
  const getConnectionState = (): ConnectionState => {
    if (__DEV__ && mockConnected) {
      return 'CONNECTED';
    }
    return liveKit.connectionState;
  };

  const contextValue: AgentContextType = {
    ...state,
    connect,
    disconnect,
    startSession,
    endSession,
    updateSession,
    syncSessionWithRoom,
    validateAndCorrectSession,
    connectionState: getConnectionState(),
    sendMessage,
    sendImage,
    sendProcessedImage,
    retryMessage,
    clearRetryQueue,
    setInputMode,
    clearMessages,
    clearError,
    startVoiceRecording,
    stopVoiceRecording,
    sendUserTypingIndicator,
    sendAgentTypingIndicator,
    clearTypingIndicators,
    recoverError,
    retryError,
    clearActiveErrors,
    getErrorStats: getErrorStatsCallback,
    resetCircuitBreaker,
    addMessage,
    updateMessageStatus,
  };

  return (
    <AgentContext.Provider value={contextValue}>
      {children}
    </AgentContext.Provider>
  );
};

// Hook to use agent context
export const useAgent = (): AgentContextType => {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
};