export interface RequirementDecisionItem {
  id: string;
  topic: string;
  decision: string;
  confirmedBy: string;
  meetingId: string;
  timestamp: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
}

export type ChangeType = 'NEW' | 'MODIFIED' | 'REMOVED' | 'CONFLICT';

export interface RequirementChangeItem {
  id: string;
  requirementId?: string;
  oldText?: string;
  newText: string;
  changeType: ChangeType;
  impactSummary: string;
  severity: 'low' | 'medium' | 'high';
  sourceMeetingId: string;
  speaker: string;
  timestamp: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface MeetingDocumentBundle {
  meetingId: string;
  projectId: string;
  meetingTitle: string;
  generatedAt: string;
  summary: string;
  srs: string;
  requirements: string;
  decisions: string;
  changes: string;
  traceability: string;
  openQuestions: string[];
  actionItems: string[];
  impactAnalysis: string;
}

export interface RequirementBaselineVersion {
  versionNumber: number;
  versionLabel: string; // e.g. "v1.1"
  projectId: string;
  approvedBy: string;
  timestamp: string;
  changeSummary: string;
  requirements: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    status: string;
    priority: string;
    version: number;
    updatedAt: string;
  }>;
}
