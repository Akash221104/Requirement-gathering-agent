export interface STTEvent {
  text: string;
  isFinal: boolean;
  speakerId: string;
  speakerName: string;
  speakerRole: 'CUSTOMER' | 'REQUIREMENT_ENGINEER' | 'SPEC_PILOT' | 'UNKNOWN';
  timestamp: string;
}

export interface STTCallbacks {
  onTranscript: (event: STTEvent) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export interface ISTTProvider {
  readonly providerName: string;
  start(callbacks: STTCallbacks): Promise<void>;
  sendAudio(chunk: Buffer | Uint8Array | Int16Array): void;
  stop(): Promise<void>;
}
