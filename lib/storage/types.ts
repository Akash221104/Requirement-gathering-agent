import type {
  Project,
  Decision,
  Meeting,
  Requirement,
  RequirementVersion,
  ChangeProposal,
  ProjectMemoryItem,
} from '@/types';

export interface IProjectStore {
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
}

export interface IRequirementStore {
  getRequirements(projectId: string): Promise<Requirement[]>;
  getRequirement(id: string): Promise<Requirement | null>;
  saveRequirement(requirement: Requirement): Promise<void>;
  getVersions(requirementId: string): Promise<RequirementVersion[]>;
  saveVersion(version: RequirementVersion): Promise<void>;
  getChangeProposals(projectId: string): Promise<ChangeProposal[]>;
  saveChangeProposal(proposal: ChangeProposal): Promise<void>;
}

export interface IMeetingStore {
  getMeetings(projectId: string): Promise<Meeting[]>;
  getMeeting(id: string): Promise<Meeting | null>;
  saveMeeting(meeting: Meeting): Promise<void>;
  deleteMeeting(id: string, projectId?: string): Promise<boolean>;
}

export interface IMemoryStore {
  getMemoryItems(projectId: string): Promise<ProjectMemoryItem[]>;
  saveMemoryItem(item: ProjectMemoryItem): Promise<void>;
}

export interface IDecisionStore {
  getDecisions(projectId: string): Promise<Decision[]>;
  saveDecision(decision: Decision): Promise<void>;
}

export interface ITranscriptStore {
  getTranscript(meetingId: string, projectId?: string): Promise<import('@/types/meeting').MeetingTranscriptData | null>;
  saveTranscript(data: import('@/types/meeting').MeetingTranscriptData): Promise<void>;
  appendSegment(meetingId: string, segment: import('@/types/meeting').TranscriptSegment, projectId?: string): Promise<void>;
}

export interface IIntelligenceStore {
  getIntelligence(meetingId: string, projectId?: string): Promise<import('@/types/requirement').MeetingIntelligenceState | null>;
  saveIntelligence(data: import('@/types/requirement').MeetingIntelligenceState): Promise<void>;
  appendCandidate(meetingId: string, candidate: import('@/types/requirement').CandidateRequirement, projectId?: string): Promise<void>;
  appendIssue(meetingId: string, issue: import('@/types/requirement').RequirementQualityIssue, projectId?: string): Promise<void>;
  appendQuestion(meetingId: string, question: import('@/types/requirement').ClarificationQuestion, projectId?: string): Promise<void>;
}

