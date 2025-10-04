/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Message {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'failed';
  type: 'text' | 'image' | 'voice';
  imageUri?: string;
  imageData?: ImageMessageData;
  mode?: 'voice' | 'text' | 'image';
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
  audioLevel: number; // 0-100
  isActive: boolean;
  color: string;
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

export type SessionState = 'idle' | 'active' | 'ending';

export interface SessionConfig {
  type: SessionType;
  state: SessionState;
  startedAt: Date | null;
  voiceMode?: 'push-to-talk' | 'continuous';
  isMuted?: boolean;
  turnDetection?: 'server' | 'client' | 'none';
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