/**
 * InterventionDecisionEngine — Phase 4
 *
 * Evaluates whether SpecPilot should speak, suggest, or stay silent based on
 * the latest RequirementIntelligenceState, meeting context, and configurable
 * voice intervention settings.
 *
 * Design constraints (ADR-028):
 * - The LLM Requirement Intelligence Engine (Phase 3) does NOT decide to speak.
 * - This engine is the SOLE authority over the SILENT / SUGGEST / SPEAK decision.
 * - Priority alone NEVER automatically triggers SPEAK.
 * - Multiple factors MUST align: severity, confidence, meeting context, human
 *   handling state, interruption cost, and the voice intervention toggle (ON/OFF).
 * - If voice intervention is OFF: result is always SILENT (no audio ever generated).
 * - All decisions are server-side. No secrets leave the server.
 */

import { z } from 'zod';
import { defaultLLMProvider } from '@/lib/llm';
import type { ILLMProvider } from '@/lib/llm';
import type { MeetingIntelligenceState, CandidateRequirement, RequirementQualityIssue, ClarificationQuestion } from '@/types/requirement';

// ─── Output Schema ────────────────────────────────────────────────────────────

export const InterventionDecisionSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      const rawAction = obj.decision ?? obj.action ?? obj.choice ?? 'SILENT';
      const norm = String(rawAction).toUpperCase().trim();
      const decision = ['SILENT', 'SUGGEST', 'SPEAK'].includes(norm) ? norm : 'SILENT';

      const responseText =
        typeof obj.responseText === 'string'
          ? obj.responseText
          : typeof obj.text === 'string'
          ? obj.text
          : typeof obj.response === 'string'
          ? obj.response
          : typeof obj.speech === 'string'
          ? obj.speech
          : undefined;

      const rationale =
        typeof obj.rationale === 'string' && obj.rationale.trim()
          ? obj.rationale
          : typeof obj.reason === 'string' && obj.reason.trim()
          ? obj.reason
          : 'Conversational requirement discovery intervention';

      const confidence =
        typeof obj.confidence === 'number' && !isNaN(obj.confidence)
          ? Math.max(0, Math.min(1, obj.confidence))
          : 0.95;

      return {
        decision,
        confidence,
        rationale,
        responseText,
        triggeringIssueId: typeof obj.triggeringIssueId === 'string' ? obj.triggeringIssueId : undefined,
        triggeringCandidateId: typeof obj.triggeringCandidateId === 'string' ? obj.triggeringCandidateId : undefined,
      };
    }
    return val;
  },
  z.object({
    decision: z.enum(['SILENT', 'SUGGEST', 'SPEAK']),
    confidence: z.number().min(0).max(1),
    rationale: z.string(),
    responseText: z.string().optional(),
    triggeringIssueId: z.string().optional(),
    triggeringCandidateId: z.string().optional(),
  })
);

export type InterventionDecision = z.infer<typeof InterventionDecisionSchema>;

// ─── Input Context ────────────────────────────────────────────────────────────

export interface InterventionTranscriptTurn {
  speakerName: string;
  role: string;
  text: string;
  timestamp: string;
}

export interface InterventionContext {
  /**
   * Latest intelligence state from the Requirement Intelligence Engine (Phase 3).
   * Contains candidates, quality issues, and clarification questions.
   */
  intelligenceState: MeetingIntelligenceState;

  /**
   * Recent finalized transcript turns from the conversation.
   * Enables the decision engine to understand what participants just said.
   */
  recentTranscript?: InterventionTranscriptTurn[];

  /**
   * Whether voice intervention is globally enabled (RE has toggled it ON, or autonomous mode).
   * If false, the engine MUST return SILENT unconditionally.
   */
  voiceInterventionEnabled: boolean;

  /**
   * Whether SpecPilot is currently speaking (guard against overlapping speech).
   */
  isCurrentlySpeaking: boolean;

  /**
   * Whether a human participant is currently speaking (barge-in guard).
   */
  humanSpeaking: boolean;

  /**
   * Number of seconds since the last SpecPilot voice intervention.
   * Used to enforce cooldown and avoid spamming.
   */
  secondsSinceLastSpeech: number;

  /**
   * Meeting mode — 'assisted' means human RE is present; 'autonomous' means
   * SpecPilot leads the meeting and directly interviews the customer.
   */
  meetingMode: 'assisted' | 'autonomous';
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class InterventionDecisionEngine {
  private llm: ILLMProvider;

  constructor(llm?: ILLMProvider) {
    this.llm = llm ?? defaultLLMProvider;
  }

  /**
   * Evaluate whether SpecPilot should intervene.
   *
   * Returns SILENT if:
   * - Voice intervention is disabled (unconditional)
   * - A human is currently speaking (barge-in protection)
   * - SpecPilot is already speaking
   * - Cooldown has not elapsed since the last spoken intervention
   * - In assisted mode: no noteworthy defects, conflicts, or questions
   */
  public async evaluate(ctx: InterventionContext): Promise<InterventionDecision> {
    // Hard guards — never involve LLM if these fail
    if (!ctx.voiceInterventionEnabled) {
      return this.silent('Voice intervention is disabled.');
    }
    if (ctx.isCurrentlySpeaking) {
      return this.silent('SpecPilot is already speaking.');
    }
    if (ctx.humanSpeaking) {
      return this.silent('A human participant is currently speaking — avoiding interruption.');
    }

    const state = ctx.intelligenceState;
    const highSeverityIssues = state.issues.filter((i) => i.severity === 'high');
    const criticalCandidates = state.candidateRequirements.filter(
      (c) => c.status === 'CONFLICT' || (c.confidence >= 0.85 && c.status === 'NEEDS_CLARIFICATION')
    );
    const hasQuestions = state.clarificationQuestions.length > 0;
    const hasRecentSpeech = !!(ctx.recentTranscript && ctx.recentTranscript.length > 0);

    // Detect if recent speech contains a question, tech inquiry, or direct address to SpecPilot
    const recentSpeechText = (ctx.recentTranscript || [])
      .map((t) => t.text)
      .join(' ')
      .toLowerCase();

    const isDirectInquiry =
      recentSpeechText.includes('?') ||
      /\b(can you|could you|tell me|what|which|how|why|who|recommend|suggest|specpilot|spentfiber|spitpilot|pilot|stack|technology|framework|database|architecture|opinion|think|hello|hi|are you there)\b/i.test(
        recentSpeechText
      );

    // Cooldown:
    // - Autonomous mode: 4s
    // - Direct questions / inquiries: 3s
    // - General background interventions in assisted mode: 15s
    const cooldownThreshold =
      ctx.meetingMode === 'autonomous'
        ? 4
        : isDirectInquiry
        ? 3
        : 15;

    if (ctx.secondsSinceLastSpeech < cooldownThreshold) {
      return this.silent(
        `Cooldown active. ${Math.round(cooldownThreshold - ctx.secondsSinceLastSpeech)}s remaining.`
      );
    }

    // In assisted mode:
    // Trigger if:
    // 1. High-severity defects, critical conflicts, or clarification questions exist, OR
    // 2. The engineer or customer asked a direct question / inquiry (e.g. tech stack, recommendations, greeting)
    if (ctx.meetingMode === 'assisted') {
      if (
        highSeverityIssues.length === 0 &&
        criticalCandidates.length === 0 &&
        !hasQuestions &&
        !(isDirectInquiry && hasRecentSpeech)
      ) {
        return this.silent('No direct questions, high-severity issues, or critical conflicts detected in assisted mode.');
      }
    } else {
      // In autonomous mode: SpecPilot leads the discovery interview.
      if (!hasRecentSpeech && highSeverityIssues.length === 0 && criticalCandidates.length === 0 && !hasQuestions) {
        return this.silent('Waiting for customer input in autonomous mode.');
      }
    }

    // Use LLM for nuanced conversational decision
    return this.evaluateWithLLM(ctx, highSeverityIssues, criticalCandidates, state.clarificationQuestions, isDirectInquiry);
  }

  private async evaluateWithLLM(
    ctx: InterventionContext,
    highIssues: RequirementQualityIssue[],
    criticalCandidates: CandidateRequirement[],
    questions: ClarificationQuestion[],
    isDirectInquiry: boolean = false
  ): Promise<InterventionDecision> {
    const transcriptSummary = (ctx.recentTranscript || [])
      .slice(-4)
      .map((t) => `${t.speakerName} (${t.role}): "${t.text}"`)
      .join('\n');

    const issuesSummary = highIssues
      .slice(0, 3)
      .map((i) => `[${i.severity.toUpperCase()} ${i.issueType}] ${i.description} — ${i.explanation}`)
      .join('\n');

    const candidatesSummary = criticalCandidates
      .slice(0, 3)
      .map((c) => `[${c.status} | confidence:${c.confidence}] ${c.requirementText}`)
      .join('\n');

    const questionsSummary = questions
      .slice(0, 2)
      .map((q) => q.question)
      .join('\n');

    const systemPrompt = `You are SpecPilot, an attentive, friendly, and expert requirement engineering partner in a live video call.

Your tone MUST BE:
- Warm, empathetic, conversational, and human—just like a skilled colleague in a 1-on-1 call.
- NEVER sound like a robot or IVR system: DO NOT say "I am your AI Requirement Engineer co-pilot", "In order to better understand your request", or "As an AI".
- Use natural conversational openers and acknowledgments: "Hey there!", "Got it!", "Oh nice!", "Makes total sense.", "For that,".
- Use natural English contractions: "I'm", "let's", "that's", "we'd", "you're".
- Keep spoken text punchy and brief: 1 to 2 conversational sentences maximum.
- MEMORY ACCESS: You have complete knowledge of previous meeting discussions and baseline requirements for this project.
- NEVER say "I don't have access to previous meeting notes" or "I don't remember". If asked about past meetings or previous agreements, warmly and concisely recall them (e.g. e-commerce clothing website, seasonal teen/young adult wear, Google SSO).
- REQUIREMENT EVOLUTION: If the user changes or updates a previous point (e.g. "Instead of Google SSO, we want mobile OTP login" or "We only want teen clothes"), acknowledge and confirm the update warmly: "Understood! I'll update the specification from Google SSO to Mobile OTP login."

Decision rules:
1. In 'autonomous' mode (you are leading the interview directly with the customer):
   - When the customer greets, says "hello", "can you hear me", or starts the session: Say something warm and natural like: "Hey! Yes, I can hear you loud and clear. What kind of project or app are you looking to build?"
   - When the customer shares an idea, goal, or feature: Acknowledge it naturally and ask ONE clear, friendly follow-up: "Got it! Who's the primary user for this?" or "Makes sense! How do you want payments to be processed?"
   - Choose SPEAK whenever the customer completes a turn and expects a response.
   - Only choose SILENT if the customer is still mid-sentence or nothing new was said.

2. In 'assisted' mode (a human Requirement Engineer leads the meeting):
   - If the Requirement Engineer or Customer asks a question, requests technical advice, architecture suggestions, tech stack recommendations, or asks "can you tell me...", "what should we use...", "SpecPilot, ...":
     YOU MUST CHOOSE SPEAK!
     Provide a direct, friendly, and concise answer (1-3 sentences) answering their question accurately!
     Example for Android tech stack: "For Android, Kotlin with Jetpack Compose is the modern industry standard, or you could use Flutter or React Native if you want cross-platform support."
   - If a high-severity defect or critical conflict was detected:
     Choose SPEAK to voice the critical risk, or SUGGEST for the engineer's copilot panel.
   - If participants are conversing with each other and did not ask for your input or address you:
     Choose SUGGEST to offer a helpful tip in the engineer workspace, or SILENT to let them converse uninterrupted.

If SPEAK: Provide warm, natural spoken English in 'responseText' (1-2 sentences).
If SUGGEST: Provide the engineer suggestion in 'responseText'.
If SILENT: Leave 'responseText' empty.

Respond in pure JSON matching the schema.`;

    const userPrompt = `Recent conversation:
${transcriptSummary || '(none)'}

Current requirement intelligence:
HIGH SEVERITY ISSUES:
${issuesSummary || '(none)'}

CRITICAL CANDIDATE REQUIREMENTS:
${candidatesSummary || '(none)'}

SUGGESTED CLARIFICATION QUESTIONS:
${questionsSummary || '(none)'}

Meeting mode: ${ctx.meetingMode}
Seconds since last SpecPilot speech: ${ctx.secondsSinceLastSpeech}

Decide: SILENT, SUGGEST, or SPEAK?`;

    try {
      const decision = await this.llm.generateStructured(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        InterventionDecisionSchema,
        { temperature: 0.1, maxTokens: 512, timeoutMs: 10000 }
      );

      // In assisted mode: downgrade SPEAK with low confidence ONLY if not a direct question
      if (
        decision.decision === 'SPEAK' &&
        decision.confidence < 0.7 &&
        ctx.meetingMode === 'assisted' &&
        !isDirectInquiry
      ) {
        return {
          ...decision,
          decision: 'SUGGEST',
          rationale: `[Downgraded SPEAK→SUGGEST: confidence ${decision.confidence} below threshold] ${decision.rationale}`,
        };
      }

      return decision;
    } catch (err) {
      // Fail safe: if LLM call fails, stay silent
      const msg = err instanceof Error ? err.message : 'unknown error';
      console.warn('[InterventionDecisionEngine] LLM evaluation failed, defaulting to SILENT:', msg);
      return this.silent(`LLM evaluation failed: ${msg}`);
    }
  }

  private silent(rationale: string): InterventionDecision {
    return {
      decision: 'SILENT',
      confidence: 1,
      rationale,
      responseText: undefined,
    };
  }
}

// Global singleton (server-side only)
const globalForDecision = globalThis as unknown as {
  interventionDecisionEngine?: InterventionDecisionEngine;
};

export const interventionDecisionEngine: InterventionDecisionEngine =
  globalForDecision.interventionDecisionEngine ?? new InterventionDecisionEngine();

if (process.env.NODE_ENV !== 'production') {
  globalForDecision.interventionDecisionEngine = interventionDecisionEngine;
}
