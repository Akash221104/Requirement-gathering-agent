import { z } from 'zod';
import { defaultLLMProvider } from '@/lib/llm';
import type { ILLMProvider } from '@/lib/llm';
import { intelligenceStore } from '@/lib/storage/intelligence-store';
import { requirementStore } from '@/lib/storage/requirement-store';
import type { TranscriptSegment } from '@/types/meeting';
import type {
  CandidateRequirement,
  ClarificationQuestion,
  MeetingIntelligenceState,
  Requirement,
  RequirementQualityIssue,
} from '@/types/requirement';

export const RequirementAnalysisSchema = z.object({
  candidates: z.array(
    z.object({
      requirementText: z.string(),
      type: z.enum([
        'FUNCTIONAL',
        'NON_FUNCTIONAL',
        'BUSINESS',
        'TECHNICAL',
        'SECURITY',
        'PERFORMANCE',
        'UI_UX',
      ]),
      sourceSpeakerName: z.string().default('Customer'),
      sourceSpeakerRole: z.string().default('CUSTOMER'),
      sourceTurnRef: z.string().default(''),
      confidence: z.number().min(0).max(1).default(0.9),
      status: z
        .enum([
          'PROPOSED',
          'NEEDS_CLARIFICATION',
          'CONFLICT',
          'APPROVED',
          'REJECTED',
          'TAGGED_FOR_NEXT_MEETING',
        ])
        .default('PROPOSED'),
    })
  ).default([]),
  issues: z.array(
    z.object({
      requirementRefText: z.string().default(''),
      issueType: z.enum([
        'AMBIGUITY',
        'INCOMPLETENESS',
        'MISSING_CONSTRAINT',
        'VAGUE_LANGUAGE',
        'NOT_MEASURABLE',
        'CONFLICT',
        'DUPLICATE',
      ]),
      description: z.string(),
      explanation: z.string(),
      severity: z.enum(['low', 'medium', 'high']).default('medium'),
    })
  ).default([]),
  clarificationQuestions: z.array(
    z.object({
      requirementRefText: z.string().default(''),
      question: z.string(),
      rationale: z.string(),
    })
  ).default([]),
});

export type RequirementAnalysisResult = z.infer<typeof RequirementAnalysisSchema>;

export class RequirementIntelligenceEngine {
  private llm: ILLMProvider;
  private activeStates = new Map<string, MeetingIntelligenceState>();
  private listeners = new Map<string, Set<(state: MeetingIntelligenceState) => void>>();

  constructor(llm?: ILLMProvider) {
    this.llm = llm ?? defaultLLMProvider;
  }

  public registerListener(meetingId: string, listener: (state: MeetingIntelligenceState) => void): () => void {
    let set = this.listeners.get(meetingId);
    if (!set) {
      set = new Set();
      this.listeners.set(meetingId, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }

  private notifyListeners(meetingId: string, state: MeetingIntelligenceState): void {
    const set = this.listeners.get(meetingId);
    if (set) {
      for (const listener of set) {
        try {
          listener(state);
        } catch (e) {
          console.error('[RequirementIntelligence] Listener notification error:', e);
        }
      }
    }
  }

  /**
   * Invalidates the in-memory cache for a specific meeting.
   * Call this after external operations (e.g. force re-analysis) that write new intelligence to disk.
   * @param meetingId  The meeting whose cache to clear
   * @param freshState Optional replacement state to set immediately (avoids redundant disk read)
   */
  public invalidateCache(meetingId: string, freshState?: MeetingIntelligenceState): void {
    if (freshState) {
      this.activeStates.set(meetingId, freshState);
    } else {
      this.activeStates.delete(meetingId);
    }
  }

  public async getIntelligenceState(
    meetingId: string,
    projectId: string = 'project-001'
  ): Promise<MeetingIntelligenceState> {
    const persisted = await intelligenceStore.getIntelligence(meetingId, projectId);
    let state = this.activeStates.get(meetingId);

    if (!state) {
      state = persisted || {
        meetingId,
        projectId,
        candidateRequirements: [],
        issues: [],
        clarificationQuestions: [],
        lastUpdated: new Date().toISOString(),
      };
      this.activeStates.set(meetingId, state);
    } else if (persisted) {
      const persistedTime = new Date(persisted.lastUpdated || 0).getTime();
      const memTime = new Date(state.lastUpdated || 0).getTime();
      const hasMoreReqs = (persisted.candidateRequirements?.length || 0) > (state.candidateRequirements?.length || 0);

      if (persistedTime >= memTime || hasMoreReqs) {
        state.candidateRequirements = persisted.candidateRequirements || [];
        state.issues = persisted.issues || [];
        state.clarificationQuestions = persisted.clarificationQuestions || [];
        state.lastUpdated = persisted.lastUpdated || new Date().toISOString();
      }
    }
    return state;
  }

  /**
   * Analyze conversation chunk with LLM Brain
   */
  public async analyzeChunk(
    meetingId: string,
    projectId: string,
    chunk: TranscriptSegment[],
    contextHistory: TranscriptSegment[] = []
  ): Promise<MeetingIntelligenceState | null> {
    if (chunk.length === 0) return null;

    try {
      const currentState = await this.getIntelligenceState(meetingId, projectId);

      // Fetch baseline project requirements if available
      const baselineRequirements: Requirement[] = await requirementStore
        .getRequirements(projectId)
        .catch(() => []);

      const systemPrompt = `You are the SpecPilot Requirement Engineering Intelligence Brain.
Your role is to assist the human Requirement Engineer during live software requirement meetings.

Analyze the given conversation turn(s) between Customer and Requirement Engineer.
Extract clear candidate requirements, detect quality defects (ambiguity, incompleteness, missing constraints, lack of testability, conflict with baseline), and formulate concise clarification questions for the Requirement Engineer.

CORE PRINCIPLES:
1. Human authority: All candidate requirements are proposals ('PROPOSED', 'NEEDS_CLARIFICATION', or 'CONFLICT'). Never approve them.
2. Vague language detection: Words like "fast", "user-friendly", "many", "seamless", "soon", "scalable", "flexible" must trigger an AMBIGUITY or VAGUE_LANGUAGE or NOT_MEASURABLE issue.
3. Missing constraints detection: Missing timeout durations, OTP expiration, rate limits, actor permissions must trigger MISSING_CONSTRAINT or INCOMPLETENESS.
4. Actionable clarification questions: Suggest concise, precise questions for the Requirement Engineer to ask.
5. If no requirements are expressed in the chunk (e.g. casual greeting, conversational filler), return empty arrays: {"candidates":[], "issues":[], "clarificationQuestions":[]}.

EXISTING PROJECT BASELINE REQUIREMENTS:
${
  baselineRequirements.length > 0
    ? baselineRequirements
        .map((r) => `- [${r.id}] ${r.title}: ${r.description} (${r.category})`)
        .join('\n')
    : '(No approved baseline requirements yet)'
}

CONVERSATION CONTEXT (PREVIOUS TURNS):
${
  contextHistory.length > 0
    ? contextHistory
        .map((s) => `[${s.speakerRole}] ${s.speakerName}: "${s.text}"`)
        .join('\n')
    : '(None)'
}

NEW CONVERSATION CHUNK TO ANALYZE:
${chunk.map((s) => `[Turn ID: ${s.id}] [${s.speakerRole}] ${s.speakerName}: "${s.text}"`).join('\n')}

Output valid JSON strictly conforming to this schema. Every key and string value (including enum values) must be in double quotes. Do not include comments in the JSON.

Allowed enum values:
- type: "FUNCTIONAL", "NON_FUNCTIONAL", "BUSINESS", "TECHNICAL", "SECURITY", "PERFORMANCE", "UI_UX"
- status: "PROPOSED", "NEEDS_CLARIFICATION", "CONFLICT"
- issueType: "AMBIGUITY", "INCOMPLETENESS", "MISSING_CONSTRAINT", "VAGUE_LANGUAGE", "NOT_MEASURABLE", "CONFLICT", "DUPLICATE"
- severity: "low", "medium", "high"
- sourceSpeakerRole: "CUSTOMER", "REQUIREMENT_ENGINEER"

Schema template:
{
  "candidates": [
    {
      "requirementText": "Standardized requirement description",
      "type": "FUNCTIONAL",
      "sourceSpeakerName": "Speaker name",
      "sourceSpeakerRole": "CUSTOMER",
      "sourceTurnRef": "Turn ID or quote",
      "confidence": 0.9,
      "status": "PROPOSED"
    }
  ],
  "issues": [
    {
      "requirementRefText": "Quote or statement referenced",
      "issueType": "MISSING_CONSTRAINT",
      "description": "Short issue title",
      "explanation": "Why this matters to software specification",
      "severity": "medium"
    }
  ],
  "clarificationQuestions": [
    {
      "requirementRefText": "Quote or requirement referenced",
      "question": "Concise clarification question for Requirement Engineer",
      "rationale": "Why this question is critical"
    }
  ]
}`;

      const rawAnalysis = await this.llm.generateStructured<RequirementAnalysisResult>(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: 'Please analyze this conversation chunk and extract requirement intelligence now.',
          },
        ],
        RequirementAnalysisSchema,
        { temperature: 0.1, timeoutMs: 65000 }
      );

      // Map generated intelligence into state entities with unique IDs and timestamps
      const now = new Date().toISOString();

      const newCandidates: CandidateRequirement[] = (rawAnalysis.candidates || []).map((c, i) => ({
        id: `cand-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}-${i}`,
        meetingId,
        requirementText: c.requirementText.trim(),
        type: c.type,
        sourceSpeakerName: c.sourceSpeakerName || 'Customer',
        sourceSpeakerRole: c.sourceSpeakerRole || 'CUSTOMER',
        sourceTurnRef: c.sourceTurnRef || chunk[0]?.id || '',
        confidence: typeof c.confidence === 'number' ? c.confidence : 0.9,
        status: c.status || 'PROPOSED',
        timestamp: now,
      }));

      const newIssues: RequirementQualityIssue[] = (rawAnalysis.issues || []).map((issue, i) => {
        // Find matching candidate if applicable
        const matchingCand = newCandidates.find((c) =>
          c.requirementText.toLowerCase().includes(issue.requirementRefText.toLowerCase().slice(0, 20))
        );
        return {
          id: `issue-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}-${i}`,
          requirementId: matchingCand?.id,
          issueType: issue.issueType,
          description: issue.description.trim(),
          explanation: issue.explanation.trim(),
          severity: issue.severity || 'medium',
          timestamp: now,
        };
      });

      const newQuestions: ClarificationQuestion[] = (rawAnalysis.clarificationQuestions || []).map(
        (q, i) => {
          const matchingCand = newCandidates.find((c) =>
            c.requirementText.toLowerCase().includes(q.requirementRefText.toLowerCase().slice(0, 20))
          );
          const matchingIssue = newIssues.find((iss) => iss.requirementId === matchingCand?.id);
          return {
            id: `q-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}-${i}`,
            requirementId: matchingCand?.id,
            issueId: matchingIssue?.id,
            question: q.question.trim(),
            rationale: q.rationale.trim(),
            suggestedTo: 'REQUIREMENT_ENGINEER',
            timestamp: now,
          };
        }
      );

      // Merge into state (avoid duplicate requirementText if identical statement already captured)
      for (const cand of newCandidates) {
        const existing = currentState.candidateRequirements.find(
          (c) => c.requirementText.toLowerCase() === cand.requirementText.toLowerCase()
        );
        if (!existing) {
          currentState.candidateRequirements.push(cand);
        }
      }

      for (const issue of newIssues) {
        const existing = currentState.issues.find(
          (iss) =>
            iss.description.toLowerCase() === issue.description.toLowerCase() &&
            iss.issueType === issue.issueType
        );
        if (!existing) {
          currentState.issues.push(issue);
        }
      }

      for (const q of newQuestions) {
        const existing = currentState.clarificationQuestions.find(
          (cq) => cq.question.toLowerCase() === q.question.toLowerCase()
        );
        if (!existing) {
          currentState.clarificationQuestions.push(q);
        }
      }

      currentState.lastUpdated = now;

      // Asynchronously persist to filesystem
      intelligenceStore.saveIntelligence(currentState).catch((err) => {
        console.error(`[RequirementIntelligence] Persistence error for meeting ${meetingId}:`, err);
      });

      // Notify listeners (UI & LiveKit broadcaster)
      this.notifyListeners(meetingId, currentState);

      return currentState;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[RequirementIntelligence] Analysis failed gracefully for meeting ${meetingId}: ${msg}`);
      // Return null or current state so meeting is NEVER crashed
      return this.activeStates.get(meetingId) || null;
    }
  }

  public clearMeeting(meetingId: string): void {
    this.activeStates.delete(meetingId);
    this.listeners.delete(meetingId);
  }
}

// Global Singleton
const globalForIntelligence = globalThis as unknown as {
  requirementIntelligenceEngine?: RequirementIntelligenceEngine;
};

export const requirementIntelligenceEngine =
  globalForIntelligence.requirementIntelligenceEngine ?? new RequirementIntelligenceEngine();

if (process.env.NODE_ENV !== 'production') {
  globalForIntelligence.requirementIntelligenceEngine = requirementIntelligenceEngine;
}
