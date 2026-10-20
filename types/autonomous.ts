import { z } from 'zod';
import type { CandidateRequirement, RequirementQualityIssue } from './requirement';
import type { RequirementDecisionItem, RequirementChangeItem } from './documentation';

export type AutonomousState =
  | 'PREPARING'
  | 'OPENING'
  | 'ASKING'
  | 'LISTENING'
  | 'ANALYZING'
  | 'CLARIFYING'
  | 'CONFIRMING'
  | 'NEXT_TOPIC'
  | 'FINISHING'
  | 'COMPLETED';

export const AutonomousActionSchema = z.object({
  action: z.enum([
    'ASK_QUESTION',
    'CLARIFY',
    'CONFIRM',
    'ACKNOWLEDGE',
    'MOVE_NEXT',
    'FINISH',
  ]),
  spokenText: z.string().min(1, 'Spoken text is required'),
  question: z.string().optional(),
  reason: z.string().default(''),
  topic: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.85),
  detectedRequirement: z
    .object({
      text: z.string(),
      type: z.enum([
        'FUNCTIONAL',
        'NON_FUNCTIONAL',
        'BUSINESS',
        'TECHNICAL',
        'SECURITY',
        'PERFORMANCE',
        'UI_UX',
      ]),
    })
    .optional(),
  detectedChange: z
    .object({
      oldRequirement: z.string().optional(),
      newRequirement: z.string(),
      impact: z.string(),
      changeType: z.enum(['NEW', 'MODIFIED', 'REMOVED', 'CONFLICT']),
    })
    .optional(),
  confirmedDecision: z
    .object({
      topic: z.string(),
      decisionText: z.string(),
    })
    .optional(),
});

export type AutonomousActionDecision = z.infer<typeof AutonomousActionSchema>;

export interface QuestionAnswerExchange {
  question: string;
  answer: string;
  timestamp: string;
  topic: string;
}

export interface AutonomousMeetingContext {
  meetingId: string;
  projectId: string;
  state: AutonomousState;
  topics: string[];
  currentTopicIndex: number;
  currentTopic: string;
  questionsAsked: string[];
  exchanges: QuestionAnswerExchange[];
  unresolvedQuestions: string[];
  confirmedDecisions: RequirementDecisionItem[];
  detectedChanges: RequirementChangeItem[];
  candidateRequirements: CandidateRequirement[];
  issues: RequirementQualityIssue[];
  turnCount: number;
  topicClarificationCount: Record<string, number>;
  lastSpokenText?: string;
  isMeetingFinished: boolean;
  closingMessageSent: boolean;
  lastUpdated: string;
}
