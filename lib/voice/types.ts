export type VoiceEventType = 'speech_start' | 'speech_end' | 'barge_in' | 'error';

export interface VoiceSessionConfig {
  meetingId: string;
  mode: 'assisted' | 'autonomous';
  speakingMode?: 'SILENT' | 'SUGGEST' | 'SPEAK';
}

export interface VoiceEvent {
  type: VoiceEventType;
  timestamp: string;
  payload?: unknown;
}

export interface IVoiceProvider {
  startSession(config: VoiceSessionConfig): Promise<void>;
  stopSession(): Promise<void>;
  onEvent(callback: (event: VoiceEvent) => void): void;
}
