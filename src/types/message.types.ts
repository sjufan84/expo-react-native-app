export interface Message {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'failed';
  type: 'text' | 'image' | 'voice';
  imageUri?: string;
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

export interface UseLiveKitReturn {
  room: Room | null;
  connectionState: ConnectionState;
  error: Error | null;
  connect: (token: string) => Promise<void>;
  disconnect: () => Promise<void>;
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

// Room and Participant types for LiveKit (simplified)
export interface Room {
  name: string;
  participants: Map<string, Participant>;
  localParticipant: LocalParticipant;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  disconnect: () => Promise<void>;
}

export interface Participant {
  sid: string;
  identity: string;
  tracks: Map<string, Track>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
}

export interface LocalParticipant extends Participant {
  publishAudioTrack: (track: LocalAudioTrack) => Promise<void>;
  publishData: (data: Uint8Array, kind: DataPacket_Kind) => Promise<void>;
}

export interface Track {
  sid: string;
  kind: 'audio' | 'video' | 'data';
  mediaStreamTrack?: any; // MediaStreamTrack is not available in React Native
}

export interface LocalAudioTrack extends Track {
  kind: 'audio';
}

export enum DataPacket_Kind {
  RELIABLE = 'reliable',
  LOSSY = 'lossy'
}