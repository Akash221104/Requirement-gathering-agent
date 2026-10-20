export type MeetingMode = 'assisted' | 'autonomous';

export type SpeakingMode = 'SILENT' | 'SUGGEST' | 'SPEAK';

export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type ParticipantRole = 'customer' | 'engineer' | 'agent' | 'CUSTOMER' | 'REQUIREMENT_ENGINEER' | 'SPEC_PILOT';

export interface MeetingParticipant {
  id: string;
  name: string;
  role: ParticipantRole;
  joinedAt?: string;
}

export interface AgendaItem {
  id: string;
  topic: string;
  durationMinutes?: number;
  completed: boolean;
  targetRequirementIds?: string[];
}

export interface Meeting {
  id: string;
  projectId: string;
  title: string;
  mode: MeetingMode;
  meetingMode?: MeetingMode;
  speakingMode?: SpeakingMode;
  status: MeetingStatus;
  participants: MeetingParticipant[];
  startTime?: string;
  endTime?: string;
  startedAt?: string;
  endedAt?: string;
  agenda: AgendaItem[];
  summary?: string;
  baselineApproved?: boolean;
  baselineVersion?: string;
  baselineApprovedAt?: string;
  baselineApprovedBy?: string;
  createdAt: string;
}

export interface MeetingTokenResponse {
  token: string;
  serverUrl: string;
}

// Phase 2: Realtime Live Transcript Types
export interface TranscriptSegment {
  id: string;
  meetingId: string;
  speakerId: string;
  speakerRole: 'CUSTOMER' | 'REQUIREMENT_ENGINEER' | 'SPEC_PILOT' | 'UNKNOWN';
  speakerName: string;
  text: string;
  isFinal: boolean;
  timestamp: string;
}

export interface MeetingTranscriptData {
  meetingId: string;
  projectId: string;
  segments: TranscriptSegment[];
  lastUpdated: string;
}

export type SpecPilotStatus = 'connecting' | 'listening' | 'transcribing' | 'speaking' | 'disconnected' | 'error';

// Phase 4: Voice Intervention
export interface VoiceSuggestionMessage {
  meetingId: string;
  text: string;
  rationale: string;
  timestamp: string;
}

export interface SpecPilotSpeakingState {
  meetingId: string;
  isSpeaking: boolean;
  text: string;
  timestamp: string;
}

export interface VoiceInterventionState {
  meetingId: string;
  voiceInterventionEnabled: boolean;
}
