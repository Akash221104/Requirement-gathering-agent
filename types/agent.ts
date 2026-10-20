export type AgentActionType =
  | 'ask_customer'
  | 'ask_engineer'
  | 'create_change_proposal'
  | 'update_requirement_draft'
  | 'create_follow_up_meeting'
  | 'generate_agenda'
  | 'send_reminder'
  | 'update_memory'
  | 'track_issue'
  | 'generate_report';

export type AgentActionStatus =
  | 'pending_permission'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'executed'
  | 'failed';

export interface AgentAction {
  id: string;
  projectId: string;
  type: AgentActionType;
  status: AgentActionStatus;
  targetModule: 'meeting' | 'requirements' | 'calendar' | 'memory' | 'workflow';
  payload: Record<string, unknown>;
  requiresApproval: boolean;
  approvedBy?: string;
  executionResult?: Record<string, unknown>;
  createdAt: string;
  executedAt?: string;
}
