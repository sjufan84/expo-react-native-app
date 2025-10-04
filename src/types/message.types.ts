/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Message {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'failed' | 'retrying';
  type: 'text' | 'image' | 'voice';
  imageUri?: string;
  imageData?: ImageMessageData;
  mode?: 'voice' | 'text' | 'image';
  retryMetadata?: RetryMetadata;
}

export interface InputMode {
  type: 'voice' | 'text' | 'image';
  isActive: boolean;
}

export interface VoiceControlsProps {
  mode: 'push-to-talk' | 'continuous';
  isRecording: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onToggleRecording: () => void;
  onModeChange: (mode: 'push-to-talk' | 'continuous') => void;
}

export interface MultimodalInputProps {
  currentMode: InputMode;
  onModeChange: (mode: InputMode) => void;
  onSendText: (text: string) => void;
  onSendVoice: (audio: AudioData) => void;
  onSendImage: (image: ImageData) => void;
}

export interface MessageBubbleProps {
  message: Message;
  isUser: boolean;
  showAvatar: boolean;
  showTimestamp: boolean;
}

export interface VoiceWaveformProps {
  audioLevel?: number; // 0-100
  isActive?: boolean;
  color?: string;
  className?: string;
}

export interface ConnectionStatusProps {
  status: ConnectionState;
  onRetry: () => void;
}

export interface DataChannelMessage {
  type: 'text' | 'image' | 'control';
  payload: any;
  timestamp: number;
  messageId: string;
}

export type ConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'FAILED';

export type SessionType = 'text' | 'voice-ptt' | 'voice-vad' | null;

export type SessionState = 'idle' | 'active' | 'ending' | 'syncing' | 'error';

export interface SessionConfig {
  type: SessionType;
  state: SessionState;
  startedAt: Date | null;
  voiceMode?: 'push-to-talk' | 'continuous';
  isMuted?: boolean;
  turnDetection?: 'server' | 'client' | 'none';
  // New fields for synchronization
  roomId?: string;
  lastSyncAt?: Date;
  syncAttempts?: number;
  inconsistencyDetected?: boolean;
  voiceActivityEnabled?: boolean;
}

// Session synchronization events
export interface SessionSyncEvent {
  type: 'session_state_sync' | 'room_state_change' | 'connection_interruption' | 'session_inconsistency';
  payload: {
    sessionId: string;
    frontendState: SessionConfig;
    roomState?: Partial<SessionConfig>;
    timestamp: number;
    trigger: string;
  };
}

// LiveKit room configuration for different session types
export interface LiveKitRoomConfig {
  sessionId: string;
  sessionType: SessionType;
  turnDetection: 'server' | 'client' | 'none';
  voiceActivityEnabled: boolean;
  adaptiveStream: boolean;
  dynacast: boolean;
  audioSettings: {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
  };
}

// Session validation result
export interface SessionValidationResult {
  isValid: boolean;
  inconsistencies: string[];
  corrections: Partial<SessionConfig>;
  needsResync: boolean;
=======
  isAgentTyping?: boolean;
>>>>>>> 945da23834d50220991d0f9469e1e334868cbf0d
}

export interface AudioData {
  uri: string;
  duration: number;
  size: number;
}

export interface ImageData {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
  type: string;
}

export interface ImageResult {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
  type: string;
}

export interface ImageMessageData {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
  type: string;
  base64?: string;
  compressionRatio?: number;
  caption?: string;
}

export interface ProcessedImageResult {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
  type: string;
  base64?: string;
  compressionRatio?: number;
}

// Retry-related types
export interface RetryMetadata {
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt: Date;
  nextRetryAt?: Date;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  isPermanentFailure: boolean;
  failureReason?: string;
}

export interface RetryQueueItem {
  id: string;
  message: Message;
  originalDataChannelMessage: DataChannelMessage;
  createdAt: Date;
  nextRetryAt: Date;
  attemptCount: number;
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  isPermanentFailure: boolean;
  failureReason?: string;
}

export interface RetryConfig {
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  maxAttempts: number;
  jitterFactor: number;
}

export interface RetryQueueStats {
  totalItems: number;
  pendingItems: number;
  failedItems: number;
  completedItems: number;
  averageRetryCount: number;
}

export type RetryTrigger = 'connection_restored' | 'manual_retry' | 'scheduled_retry' | 'app_restart';

// Typing indicator types
export interface TypingIndicator {
  userType: 'user' | 'agent';
  isTyping: boolean;
  timestamp: number;
  lastActivity?: number;
}

export interface TypingControlPayload {
  action: 'typing_start' | 'typing_stop';
  user_type: 'user' | 'agent';
  timestamp: number;
}

export interface TypingState {
  userTyping: boolean;
  agentTyping: boolean;
  lastUserActivity?: number;
  lastAgentActivity?: number;
=======
export interface ProcessingOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'jpeg' | 'png';
  includeBase64?: boolean;
>>>>>>> 945da23834d50220991d0f9469e1e334868cbf0d
}