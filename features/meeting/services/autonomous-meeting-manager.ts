import fs from 'fs/promises';
import path from 'path';
import type { ILLMProvider } from '@/lib/llm/types';
import { defaultLLMProvider } from '@/lib/llm';
import {
  AutonomousActionSchema,
  type AutonomousActionDecision,
  type AutonomousMeetingContext,
  type AutonomousState,
} from '@/types/autonomous';
import type { CandidateRequirement, RequirementQualityIssue } from '@/types/requirement';
import type { RequirementDecisionItem, RequirementChangeItem } from '@/types/documentation';
import { requirementVersionService } from '@/features/requirements/services/requirement-version-service';
import { postMeetingDocumentationEngine } from '@/features/requirements/services/post-meeting-documentation-engine';
import { getProjectsDir } from '@/lib/storage/data-dir';

export const MAX_AUTONOMOUS_TURNS = 30;
export const MAX_CLARIFICATIONS_PER_TOPIC = 3;

function getContextPath(projectId: string, meetingId: string): string {
  return path.join(getProjectsDir(), projectId, 'meetings', `meeting-${meetingId}-autonomous.json`);
}

export class AutonomousMeetingManager {
  private llm: ILLMProvider;
  private contexts = new Map<string, AutonomousMeetingContext>();

  constructor(llm?: ILLMProvider) {
    this.llm = llm ?? defaultLLMProvider;
  }

  /**
   * Initialize or retrieve context for an autonomous meeting.
   */
  public async getOrCreateContext(
    meetingId: string,
    projectId: string = 'project-001',
    initialTopics?: string[]
  ): Promise<AutonomousMeetingContext> {
    if (this.contexts.has(meetingId)) {
      return this.contexts.get(meetingId)!;
    }

    // Try reading from filesystem
    const diskPath = getContextPath(projectId, meetingId);
    try {
      const data = await fs.readFile(diskPath, 'utf-8');
      const loaded: AutonomousMeetingContext = JSON.parse(data);
      this.contexts.set(meetingId, loaded);
      return loaded;
    } catch {
      // If initial topics were not explicitly provided, consult project knowledge base
      let derivedTopics = initialTopics;
      if (!derivedTopics || derivedTopics.length === 0) {
        try {
          const { projectKnowledgeService } = await import('@/features/requirements/services/project-knowledge-service');
          const kb = await projectKnowledgeService.getProjectKnowledgeBase(projectId, meetingId);
          const pastMeetings = kb.meetingsChronology.filter((m) => m.meetingId !== meetingId);
          
          if (pastMeetings.length > 0) {
            // Check for tagged follow-up items
            const tagged = kb.allCandidateRequirements
              .filter((r) => r.status === 'TAGGED_FOR_NEXT_MEETING' || r.taggedForNextMeeting)
              .map((r) => r.requirementText.slice(0, 40));

            if (tagged.length > 0) {
              derivedTopics = tagged.slice(0, 3);
            } else {
              derivedTopics = ['Catalog & Inventory Management', 'Shopping Cart & Checkout', 'Payment & Fulfillment'];
            }
          } else {
            derivedTopics = ['Business Model & Target Audience', 'Product Catalog & Browsing', 'User Authentication & Checkout'];
          }
        } catch {
          derivedTopics = ['Core Business Objectives', 'User Workflows & Catalog', 'Checkout & Security'];
        }
      }

      const topics = derivedTopics && derivedTopics.length > 0 ? derivedTopics : ['Core Requirements', 'Workflow & Edge Cases'];
      const ctx: AutonomousMeetingContext = {
        meetingId,
        projectId,
        state: 'PREPARING',
        topics,
        currentTopicIndex: 0,
        currentTopic: topics[0] || 'Requirements',
        questionsAsked: [],
        exchanges: [],
        unresolvedQuestions: [],
        confirmedDecisions: [],
        detectedChanges: [],
        candidateRequirements: [],
        issues: [],
        turnCount: 0,
        topicClarificationCount: {},
        isMeetingFinished: false,
        closingMessageSent: false,
        lastUpdated: new Date().toISOString(),
      };

      this.contexts.set(meetingId, ctx);
      await this.persistContext(ctx);
      return ctx;
    }
  }

  /**
   * Start the autonomous session: Generates the introductory greeting and first agenda question.
   */
  public async startSession(
    meetingId: string,
    projectId: string = 'project-001'
  ): Promise<string> {
    const ctx = await this.getOrCreateContext(meetingId, projectId);

    if (ctx.state !== 'PREPARING' && ctx.state !== 'OPENING') {
      return ctx.lastSpokenText || "I'm listening. Please continue.";
    }

    ctx.state = 'OPENING';
    const firstTopic = ctx.topics[0] || 'Core Requirements';

    // Build context-aware greeting using project knowledge
    let greeting = '';
    try {
      const { projectKnowledgeService } = await import('@/features/requirements/services/project-knowledge-service');
      const kb = await projectKnowledgeService.getProjectKnowledgeBase(projectId, meetingId);
      const pastMeetings = kb.meetingsChronology.filter((m) => m.meetingId !== meetingId);

      if (pastMeetings.length > 0) {
        const lastM = pastMeetings[pastMeetings.length - 1];
        const lastTopicSnippet =
          lastM.requirements.length > 0
            ? lastM.requirements.slice(0, 2).map((r) => r.requirementText).join(' and ')
            : lastM.title || 'the initial system overview';

        greeting =
          `Hi, I'm SpecPilot. Welcome back! In our previous session we discussed ${lastTopicSnippet}. ` +
          `Today, let's dive into ${firstTopic}. To start, could you describe how you'd like this to work?`;
      } else {
        greeting =
          `Hi, I'm SpecPilot. I'll help us discover and define today's requirements for ${firstTopic}. ` +
          `To start off, could you tell me about the primary purpose of your project and who will be using it?`;
      }
    } catch {
      greeting =
        `Hi, I'm SpecPilot. I'll help us capture and clarify today's requirements for ${firstTopic}. ` +
        `To start, can you describe how you expect users to interact with this feature?`;
    }

    ctx.state = 'ASKING';
    ctx.questionsAsked.push(greeting);
    ctx.lastSpokenText = greeting;
    ctx.turnCount += 1;
    ctx.lastUpdated = new Date().toISOString();

    await this.persistContext(ctx);
    return greeting;
  }

  /**
   * Process a customer speech turn and decide the next autonomous step.
   */
  public async handleCustomerTurn(
    meetingId: string,
    customerSpeech: string,
    projectId: string = 'project-001'
  ): Promise<AutonomousActionDecision> {
    const ctx = await this.getOrCreateContext(meetingId, projectId);

    if (ctx.isMeetingFinished) {
      return {
        action: 'FINISH',
        spokenText: "The meeting has already concluded. The Requirement Engineer will review all captured items.",
        reason: 'Meeting is finished',
        confidence: 1,
      };
    }

    ctx.turnCount += 1;
    ctx.state = 'ANALYZING';

    const lastQuestion = ctx.questionsAsked[ctx.questionsAsked.length - 1] || 'Describe the requirements';
    ctx.exchanges.push({
      question: lastQuestion,
      answer: customerSpeech,
      timestamp: new Date().toISOString(),
      topic: ctx.currentTopic,
    });

    // Check budget / limits
    if (ctx.turnCount >= MAX_AUTONOMOUS_TURNS) {
      return this.concludeMeeting(
        ctx,
        "We've reached our time limit for today. I have captured the current requirements and the remaining points will be marked for engineer review."
      );
    }

    // Load existing approved baseline to detect changes
    const baseline = await requirementVersionService.getBaseline(projectId);

    // Call LLM for structured decision
    const decision = await this.evaluateTurnWithLLM(ctx, customerSpeech, baseline);

    // Apply decision to state machine
    await this.applyDecision(ctx, decision, customerSpeech);
    await this.persistContext(ctx);

    return decision;
  }

  private async evaluateTurnWithLLM(
    ctx: AutonomousMeetingContext,
    customerSpeech: string,
    baseline: import('@/types/requirement').Requirement[]
  ): Promise<AutonomousActionDecision> {
    const clarificationsSoFar = ctx.topicClarificationCount[ctx.currentTopic] || 0;
    const isBudgetExhausted = clarificationsSoFar >= MAX_CLARIFICATIONS_PER_TOPIC;
    const isLastTopic = ctx.currentTopicIndex >= ctx.topics.length - 1;

    const systemPrompt = `You are SpecPilot, an autonomous AI requirement engineering interviewer conducting a live elicitation meeting with a customer.
You follow strict professional requirements engineering standards.

CURRENT TOPIC: "${ctx.currentTopic}" (Topic ${ctx.currentTopicIndex + 1} of ${ctx.topics.length})
CLARIFICATIONS ASKED ON THIS TOPIC: ${clarificationsSoFar} (Max allowed: ${MAX_CLARIFICATIONS_PER_TOPIC})
TOTAL TURNS: ${ctx.turnCount}/${MAX_AUTONOMOUS_TURNS}

APPROVED BASELINE REQUIREMENTS:
${baseline.length > 0 ? baseline.map((b) => `- [${b.id}] ${b.title}: "${b.description}"`).join('\n') : '(None yet)'}

RULES:
1. CONTINUOUS MEMORY & PAST MEETINGS:
   - YOU HAVE FULL ACCESS to all previous meeting discussions and notes.
   - NEVER EVER say: "I don't have access to previous meeting notes" or "I cannot recall".
   - If the customer asks "Do you remember the last meeting?" or references past topics (e.g. online clothing store, summer/winter collections, Google SSO):
     Choose action: "ACKNOWLEDGE", warmly confirm what was agreed previously, and ask how today's topic relates.
2. If the customer's answer is ambiguous, vague, or incomplete (e.g. "it should be fast", "we want OTP"), and clarification budget is NOT exhausted:
   Choose action: "CLARIFY".
   Provide a targeted question to get specific criteria (e.g., "What should the OTP validity duration be?").
3. If customer confirms an earlier confirmation question (e.g. "yes", "correct", "that works"):
   Choose action: "ACKNOWLEDGE" or "CONFIRM", extract the confirmed requirement/decision, and prepare to move to next topic.
4. If the customer provided enough detail on the current topic:
   Ask a confirmation question: action: "CONFIRM" (e.g. "To confirm, administrators can disable user accounts and disabled users cannot log in. Is that correct?").
5. If the topic is confirmed and complete:
   If more topics remain: action: "MOVE_NEXT" and ask about the next topic.
   If this was the last topic: action: "FINISH".
6. REQUIREMENT CHANGES:
   If the customer contradicts or alters an approved baseline requirement (e.g., changing Google SSO to phone OTP), populate 'detectedChange' with oldRequirement, newRequirement, impact, and changeType ('MODIFIED' | 'CONFLICT' | 'NEW').
7. NEVER invent information. Keep spokenText warm, concise (1-2 sentences), and natural for voice synthesis.

Respond in pure JSON matching the schema.`;

    const userPrompt = `Last question asked by SpecPilot:
"${ctx.questionsAsked[ctx.questionsAsked.length - 1] || 'Initial question'}"

Customer's response:
"${customerSpeech}"

Decide the next action:`;

    try {
      const result = await this.llm.generateStructured(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        AutonomousActionSchema,
        { temperature: 0.1, maxTokens: 512, timeoutMs: 12000 }
      );

      // Programmatic safety guard: force MOVE_NEXT or FINISH if clarifications exceeded
      if (result.action === 'CLARIFY' && isBudgetExhausted) {
        if (!isLastTopic) {
          const nextTopic = ctx.topics[ctx.currentTopicIndex + 1];
          return {
            action: 'MOVE_NEXT',
            spokenText: `Understood. Let's move to our next agenda item: ${nextTopic}. Can you tell me your main goals for this?`,
            topic: nextTopic,
            reason: 'Clarification limit reached for previous topic',
            confidence: 0.9,
          };
        } else {
          return {
            action: 'FINISH',
            spokenText: "Thanks. I've captured the key requirements for our topics today. The Requirement Engineer will review everything and follow up on any open questions.",
            reason: 'All topics addressed',
            confidence: 0.9,
          };
        }
      }

      return result;
    } catch (err) {
      console.warn('[AutonomousMeetingManager] Structured decision failed, using deterministic fallback:', err);
      return this.fallbackDecision(ctx, customerSpeech);
    }
  }

  private fallbackDecision(ctx: AutonomousMeetingContext, customerSpeech: string): AutonomousActionDecision {
    const isAffirmative = /\b(yes|yeah|correct|right|exactly|sure|sounds good|agree)\b/i.test(customerSpeech);
    const isLastTopic = ctx.currentTopicIndex >= ctx.topics.length - 1;

    if (isAffirmative) {
      if (isLastTopic) {
        return {
          action: 'FINISH',
          spokenText: "Thank you. I have captured our requirements and decisions. The Requirement Engineer will review them shortly.",
          reason: 'Customer affirmed final confirmation',
          confidence: 0.85,
        };
      } else {
        const nextTopic = ctx.topics[ctx.currentTopicIndex + 1];
        return {
          action: 'MOVE_NEXT',
          spokenText: `Great, that is noted. Let's move on to ${nextTopic}. How should that be handled?`,
          topic: nextTopic,
          reason: 'Advancing to next topic',
          confidence: 0.85,
        };
      }
    }

    return {
      action: 'CLARIFY',
      spokenText: `Could you specify a bit more detail on that requirement for ${ctx.currentTopic}?`,
      reason: 'General clarification fallback',
      confidence: 0.75,
    };
  }

  private async applyDecision(
    ctx: AutonomousMeetingContext,
    decision: AutonomousActionDecision,
    customerSpeech: string
  ): Promise<void> {
    ctx.lastSpokenText = decision.spokenText;

    // Track requirement extraction
    if (decision.detectedRequirement) {
      const candidateId = `FR-${(ctx.candidateRequirements.length + 1).toString().padStart(3, '0')}`;
      ctx.candidateRequirements.push({
        id: candidateId,
        meetingId: ctx.meetingId,
        requirementText: decision.detectedRequirement.text,
        type: decision.detectedRequirement.type,
        sourceSpeakerName: 'Customer',
        sourceSpeakerRole: 'CUSTOMER',
        sourceTurnRef: `turn-${ctx.turnCount}`,
        confidence: decision.confidence,
        status: 'PROPOSED',
        timestamp: new Date().toISOString(),
      });
    }

    // Track detected change
    if (decision.detectedChange) {
      const changeId = `CHG-${(ctx.detectedChanges.length + 1).toString().padStart(3, '0')}`;
      ctx.detectedChanges.push({
        id: changeId,
        newText: decision.detectedChange.newRequirement,
        oldText: decision.detectedChange.oldRequirement,
        changeType: decision.detectedChange.changeType,
        impactSummary: decision.detectedChange.impact,
        severity: decision.detectedChange.changeType === 'CONFLICT' ? 'high' : 'medium',
        sourceMeetingId: ctx.meetingId,
        speaker: 'Customer',
        timestamp: new Date().toISOString(),
        status: 'PENDING_APPROVAL',
      });
    }

    // Track confirmed decision
    if (decision.confirmedDecision || decision.action === 'CONFIRM') {
      const decId = `DEC-${(ctx.confirmedDecisions.length + 1).toString().padStart(3, '0')}`;
      ctx.confirmedDecisions.push({
        id: decId,
        topic: decision.confirmedDecision?.topic || ctx.currentTopic,
        decision: decision.confirmedDecision?.decisionText || decision.spokenText,
        confirmedBy: 'Customer',
        meetingId: ctx.meetingId,
        timestamp: new Date().toISOString(),
        status: 'PENDING_APPROVAL',
      });
    }

    // State machine transitions
    switch (decision.action) {
      case 'CLARIFY':
        ctx.state = 'CLARIFYING';
        ctx.topicClarificationCount[ctx.currentTopic] =
          (ctx.topicClarificationCount[ctx.currentTopic] || 0) + 1;
        ctx.questionsAsked.push(decision.spokenText);
        break;

      case 'CONFIRM':
        ctx.state = 'CONFIRMING';
        ctx.questionsAsked.push(decision.spokenText);
        break;

      case 'MOVE_NEXT':
        ctx.state = 'NEXT_TOPIC';
        ctx.currentTopicIndex += 1;
        ctx.currentTopic = ctx.topics[ctx.currentTopicIndex] || ctx.currentTopic;
        ctx.questionsAsked.push(decision.spokenText);
        break;

      case 'FINISH':
        await this.concludeMeeting(ctx, decision.spokenText);
        break;

      case 'ASK_QUESTION':
      case 'ACKNOWLEDGE':
      default:
        ctx.state = 'ASKING';
        ctx.questionsAsked.push(decision.spokenText);
        break;
    }

    ctx.lastUpdated = new Date().toISOString();
  }

  /**
   * Conclude the autonomous meeting and automatically trigger documentation generation.
   */
  public async concludeMeeting(
    ctx: AutonomousMeetingContext,
    closingSpokenText: string
  ): Promise<AutonomousActionDecision> {
    ctx.state = 'FINISHING';
    ctx.isMeetingFinished = true;
    ctx.closingMessageSent = true;
    ctx.lastSpokenText = closingSpokenText;

    // Trigger post-meeting documentation asynchronously
    this.finalizeAndGenerateDocuments(ctx).catch((err) => {
      console.error('[AutonomousMeetingManager] Documentation generation error:', err);
    });

    ctx.state = 'COMPLETED';
    ctx.lastUpdated = new Date().toISOString();
    await this.persistContext(ctx);

    return {
      action: 'FINISH',
      spokenText: closingSpokenText,
      reason: 'Meeting successfully concluded',
      confidence: 1,
    };
  }

  private async finalizeAndGenerateDocuments(ctx: AutonomousMeetingContext): Promise<void> {
    const transcriptSegments = ctx.exchanges.flatMap((ex, i) => [
      {
        id: `turn-specpilot-${i}`,
        meetingId: ctx.meetingId,
        speakerId: 'specpilot-ai',
        speakerRole: 'SPEC_PILOT' as const,
        speakerName: 'SpecPilot AI',
        text: ex.question,
        isFinal: true,
        timestamp: ex.timestamp,
      },
      {
        id: `turn-customer-${i}`,
        meetingId: ctx.meetingId,
        speakerId: 'customer-user',
        speakerRole: 'CUSTOMER' as const,
        speakerName: 'Customer',
        text: ex.answer,
        isFinal: true,
        timestamp: ex.timestamp,
      },
    ]);

    await postMeetingDocumentationEngine.generateDocuments({
      meetingId: ctx.meetingId,
      projectId: ctx.projectId,
      meetingTitle: `Autonomous Requirement Elicitation (${ctx.topics.join(', ')})`,
      transcriptSegments,
      candidateRequirements: ctx.candidateRequirements,
      issues: ctx.issues,
      confirmedDecisions: ctx.confirmedDecisions,
      detectedChanges: ctx.detectedChanges,
      unresolvedQuestions: ctx.unresolvedQuestions,
    });
  }

  private async persistContext(ctx: AutonomousMeetingContext): Promise<void> {
    try {
      const diskPath = getContextPath(ctx.projectId, ctx.meetingId);
      await fs.mkdir(path.dirname(diskPath), { recursive: true });
      await fs.writeFile(diskPath, JSON.stringify(ctx, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[AutonomousMeetingManager] Failed to persist meeting context:', err);
    }
  }
}

// Global singleton
const globalForAutonomous = globalThis as unknown as {
  autonomousMeetingManager?: AutonomousMeetingManager;
};

export const autonomousMeetingManager: AutonomousMeetingManager =
  globalForAutonomous.autonomousMeetingManager ?? new AutonomousMeetingManager();

if (process.env.NODE_ENV !== 'production') {
  globalForAutonomous.autonomousMeetingManager = autonomousMeetingManager;
}
