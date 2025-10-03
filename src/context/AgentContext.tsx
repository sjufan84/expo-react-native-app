import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { useLiveKit } from '../hooks/useLiveKit';
import { Message, InputMode, DataChannelMessage } from '../types/message.types';
import { ERROR_MESSAGES, CHAT_CONFIG } from '../utils/constants';
import { generateMessageId, validateMessage } from '../utils/formatters';
import { LIVEKIT_CONFIG } from '../utils/constants';

// Agent state interface
interface AgentState {
  messages: Message[];
  isConnected: boolean;
  isTyping: boolean;
  currentInputMode: InputMode;
  error: string | null;
  agentStatus: 'idle' | 'listening' | 'processing' | 'speaking';
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
  | { type: 'CLEAR_ERROR' };

// Initial state
const initialState: AgentState = {
  messages: [],
  isConnected: false,
  isTyping: false,
  currentInputMode: { type: 'text', isActive: true },
  error: null,
  agentStatus: 'idle',
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

    default:
      return state;
  }
};

// Context interface
interface AgentContextType extends AgentState {
  // LiveKit methods
  connect: (token: string) => Promise<void>;
  disconnect: () => Promise<void>;

  // Message methods
  sendMessage: (content: string, type: Message['type']) => Promise<void>;
  sendImage: (imageUri: string, metadata?: any) => Promise<void>;

  // UI methods
  setInputMode: (mode: InputMode) => void;
  clearMessages: () => void;
  clearError: () => void;

  // Voice methods (placeholder for now)
  startVoiceRecording: () => Promise<void>;
  stopVoiceRecording: () => Promise<void>;
}

// Create context
const AgentContext = createContext<AgentContextType | undefined>(undefined);

// Provider component
export const AgentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(agentReducer, initialState);
  const liveKit = useLiveKit();

  // Connect to agent
  const connect = useCallback(async (token: string) => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null });
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
      await liveKit.disconnect();
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: false });
      dispatch({ type: 'SET_AGENT_STATUS', payload: 'idle' });
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }, [liveKit]);

  // Send text message
  const sendMessage = useCallback(async (content: string, type: Message['type'] = 'text') => {
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
  }, [liveKit, state.currentInputMode.type]);

  // Send image
  const sendImage = useCallback(async (imageUri: string, metadata?: any) => {
    const imageMessage: Message = {
      id: generateMessageId(),
      sender: 'user',
      content: 'Image shared',
      timestamp: new Date(),
      status: 'sending',
      type: 'image',
      imageUri,
      mode: 'image',
    };

    // Add message to state
    dispatch({ type: 'ADD_MESSAGE', payload: imageMessage });

    try {
      // Send via LiveKit
      const dataMessage: DataChannelMessage = {
        type: 'image',
        payload: { imageUri, metadata },
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
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: liveKit.isConnected() });
  }, [liveKit.isConnected()]);

  // Handle LiveKit errors
  React.useEffect(() => {
    if (liveKit.error) {
      const errorMessage = liveKit.error.message || ERROR_MESSAGES.generic;
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [liveKit.error]);

  const contextValue: AgentContextType = {
    ...state,
    connect,
    disconnect,
    sendMessage,
    sendImage,
    setInputMode,
    clearMessages,
    clearError,
    startVoiceRecording,
    stopVoiceRecording,
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