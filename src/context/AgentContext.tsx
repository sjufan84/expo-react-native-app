/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { createContext, useContext, useReducer, useCallback, useState, ReactNode } from 'react';
import { useLiveKit } from '../hooks/useLiveKit';
import { Message, InputMode, DataChannelMessage, ConnectionState, ProcessedImageResult, ImageMessageData, SessionConfig, SessionType } from '../types/message.types';
import { ERROR_MESSAGES, CHAT_CONFIG } from '../utils/constants';
import { generateMessageId, validateMessage } from '../utils/formatters';
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
  | { type: 'UPDATE_SESSION'; payload: Partial<SessionConfig> };

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

  // Message methods
  sendMessage: (content: string, type: Message['type']) => Promise<void>;
  sendImage: (imageUri: string, metadata?: any) => Promise<void>;
  sendProcessedImage: (image: ProcessedImageResult, caption?: string) => Promise<void>;

  // UI methods
  setInputMode: (mode: InputMode) => void;
  clearMessages: () => void;
  clearError: () => void;

  // Voice methods (placeholder for now)
  startVoiceRecording: () => Promise<void>;
  stopVoiceRecording: () => Promise<void>;

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
      
      // Dispatch session start
      dispatch({ 
        type: 'START_SESSION', 
        payload: { type, voiceMode } 
      });

      // Configure LiveKit room based on session type
      if (type === 'voice-ptt' || type === 'voice-vad') {
        // Enable audio tracks for voice sessions
        console.log('🎙️ Enabling audio for voice session');
        // TODO: Initialize audio with LiveKit room when available
      }

      console.log(`✅ ${type} session started successfully`);
    } catch (error) {
      console.error('Failed to start session:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to start session' });
    }
  }, [state.isConnected, state.session.state]);

  // End the current session
  const endSession = useCallback(async () => {
    try {
      if (state.session.state !== 'active') {
        console.warn('No active session to end');
        return;
      }

      console.log(`Ending ${state.session.type} session`);

      // Set session state to ending
      dispatch({ type: 'UPDATE_SESSION', payload: { state: 'ending' } });

      // Cleanup based on session type
      if (state.session.type === 'voice-ptt' || state.session.type === 'voice-vad') {
        // Cleanup audio resources
        console.log('🎙️ Cleaning up audio resources');
        // TODO: Cleanup audio when integrated with LiveKit
      }

      // End the session
      dispatch({ type: 'END_SESSION' });

      console.log('✅ Session ended successfully');
    } catch (error) {
      console.error('Failed to end session:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to end session' });
    }
  }, [state.session.state, state.session.type]);

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
      // Send via LiveKit
      const dataMessage: DataChannelMessage = {
        type: 'text',
        payload: { content, type },
        timestamp: Date.now(),
        messageId: userMessage.id,
      };

      await liveKit.sendData(dataMessage);

      // Update message status to sent
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { id: userMessage.id, updates: { status: 'sent' } }
      });

      // Set agent to processing state
      dispatch({ type: 'SET_AGENT_STATUS', payload: 'processing' });
      dispatch({ type: 'SET_TYPING', payload: true });

    } catch (error) {
      // Update message status to failed
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { id: userMessage.id, updates: { status: 'failed' } }
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
      // Send via LiveKit
      const dataMessage: DataChannelMessage = {
        type: 'image',
        payload: { imageData, metadata },
        timestamp: Date.now(),
        messageId: imageMessage.id,
      };

      await liveKit.sendData(dataMessage);

      // Update message status to sent
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { id: imageMessage.id, updates: { status: 'sent' } }
      });

      // Set agent to processing state
      dispatch({ type: 'SET_AGENT_STATUS', payload: 'processing' });
      dispatch({ type: 'SET_TYPING', payload: true });

    } catch (error) {
      // Update message status to failed
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { id: imageMessage.id, updates: { status: 'failed' } }
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

      // Send via LiveKit
      const dataMessage: DataChannelMessage = {
        type: 'image',
        payload: transmissionData,
        timestamp: Date.now(),
        messageId: imageMessage.id,
      };

      await liveKit.sendData(dataMessage);

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

      // Set agent to processing state
      dispatch({ type: 'SET_AGENT_STATUS', payload: 'processing' });
      dispatch({ type: 'SET_TYPING', payload: true });

    } catch (error) {
      console.error('Error sending image via LiveKit:', error);

      // Update message status to failed
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { id: imageMessage.id, updates: { status: 'failed' } }
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

  // Voice recording methods (placeholders)
  const startVoiceRecording = useCallback(async () => {
    // TODO: Implement voice recording
    console.log('Starting voice recording...');
    dispatch({ type: 'SET_AGENT_STATUS', payload: 'listening' });
  }, []);

  const stopVoiceRecording = useCallback(async () => {
    // TODO: Implement voice recording
    console.log('Stopping voice recording...');
    dispatch({ type: 'SET_AGENT_STATUS', payload: 'processing' });
  }, []);

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
    connectionState: getConnectionState(),
    sendMessage,
    sendImage,
    sendProcessedImage,
    setInputMode,
    clearMessages,
    clearError,
    startVoiceRecording,
    stopVoiceRecording,
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