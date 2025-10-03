export interface LiveKitConfig {
  url: string;
  token: string;
}

export interface ConnectionEvent {
  type: 'connected' | 'disconnected' | 'reconnecting' | 'failed';
  error?: Error;
}

export interface AudioLevelEvent {
  participantId: string;
  audioLevel: number; // 0-1
}

export interface DataReceivedEvent {
  payload: Uint8Array;
  participant: any; // Using any for now since Participant type is complex
}

export interface ParticipantEvent {
  participant: any; // Using any for now since Participant type is complex
  type: 'connected' | 'disconnected';
}

export interface TrackEvent {
  track: any; // Using any for now since Track type is complex
  participant: any; // Using any for now since Participant type is complex
  type: 'subscribed' | 'unsubscribed';
}

export interface RoomOptions {
  autoSubscribe: boolean;
  adaptiveStream: boolean;
  dynacast: boolean;
}