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
  participant: Participant;
}

export interface ParticipantEvent {
  participant: Participant;
  type: 'connected' | 'disconnected';
}

export interface TrackEvent {
  track: Track;
  participant: Participant;
  type: 'subscribed' | 'unsubscribed';
}

export interface RoomOptions {
  autoSubscribe: boolean;
  adaptiveStream: boolean;
  dynacast: boolean;
}