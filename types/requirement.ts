export type RequirementCategory =
  | 'functional'
  | 'non_functional'
  | 'business'
  | 'technical'
  | 'security'
  | 'performance'
  | 'ui_ux';

export type RequirementStatus = 'candidate' | 'proposed' | 'approved' | 'deprecated';

export type RequirementPriority = 'low' | 'medium' | 'high' | 'critical';

export type ChangeProposalStatus = 'pending' | 'approved' | 'rejected' | 'edited';

export interface RequirementVersion {
  versionNumber: number;
  requirementId: string;
  content: string;
  rationale?: string;
  author: string;
  approvedBy?: string;
  timestamp: string;
  changeProposalId?: string;
}

export interface ChangeProposal {
  id: string;
  requirementId: string;
  previousVersion: number;
  proposedVersion: number;
  reason: string;
  impactSummary?: string;
  sourceMeetingId?: string;
  status: ChangeProposalStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface Requirement {
  id: string;
  projectId: string;
  title: string;
  description: string;
  category: RequirementCategory;
  status: RequirementStatus;
  priority: RequirementPriority;
  currentVersion: number;
  sourceMeetingId?: string;
  createdAt: string;
  updatedAt: string;
}

// Phase 3: Realtime Requirement Engineering Intelligence Types
export type CandidateRequirementStatus =
  | 'PROPOSED'
  | 'NEEDS_CLARIFICATION'
  | 'CONFLICT'
  | 'APPROVED'
  | 'REJECTED'
  | 'TAGGED_FOR_NEXT_MEETING';

export type CandidateRequirementType =
  | 'FUNCTIONAL'
  | 'NON_FUNCTIONAL'
  | 'BUSINESS'
  | 'TECHNICAL'
  | 'SECURITY'
  | 'PERFORMANCE'
  | 'UI_UX';

export interface CandidateRequirement {
  id: string;
  meetingId: string;
  requirementText: string;
  type: CandidateRequirementType;
  sourceSpeakerName: string;
  sourceSpeakerRole: string;
  sourceTurnRef: string;
  confidence: number;
  status: CandidateRequirementStatus;
  timestamp: string;
  priority?: RequirementPriority;
  notes?: string;
  taggedForNextMeeting?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
}

export type RequirementQualityIssueType =
  | 'AMBIGUITY'
  | 'INCOMPLETENESS'
  | 'MISSING_CONSTRAINT'
  | 'VAGUE_LANGUAGE'
  | 'NOT_MEASURABLE'
  | 'CONFLICT'
  | 'DUPLICATE';

export interface RequirementQualityIssue {
  id: string;
  requirementId?: string;
  issueType: RequirementQualityIssueType;
  description: string;
  explanation: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
}

export interface ClarificationQuestion {
  id: string;
  requirementId?: string;
  issueId?: string;
  question: string;
  rationale: string;
  suggestedTo: 'REQUIREMENT_ENGINEER';
  timestamp: string;
}

export interface MeetingIntelligenceState {
  meetingId: string;
  projectId: string;
  candidateRequirements: CandidateRequirement[];
  issues: RequirementQualityIssue[];
  clarificationQuestions: ClarificationQuestion[];
  lastUpdated: string;
}

export interface IntelligenceEvent {
  type: 'INTELLIGENCE_UPDATE' | 'REQUIREMENT_CANDIDATE' | 'REQUIREMENT_ISSUE' | 'CLARIFICATION_SUGGESTION';
  meetingId: string;
  data: MeetingIntelligenceState | CandidateRequirement | RequirementQualityIssue | ClarificationQuestion;
}

