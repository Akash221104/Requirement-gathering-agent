export interface Project {
  id: string;
  name: string;
  clientName: string;
  clientContact?: string;
  clientEmail?: string;
  description?: string;
  status: 'DISCOVERY' | 'IN_REVIEW' | 'BASELINE_APPROVED' | 'COMPLETED';
  currentVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Decision {
  id: string;
  projectId: string;
  title: string;
  decision: string;
  reason: string;
  status: 'proposed' | 'accepted' | 'superseded' | 'deprecated';
  impact?: string;
  sourceMeetingId?: string;
  createdAt: string;
}

export interface Issue {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  type: 'ambiguity' | 'conflict' | 'missing_info' | 'drift';
  sourceMeetingId?: string;
  targetRequirementId?: string;
  createdAt: string;
}

export interface ActionItem {
  id: string;
  projectId: string;
  title: string;
  assignee?: string;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: string;
  sourceMeetingId?: string;
}
