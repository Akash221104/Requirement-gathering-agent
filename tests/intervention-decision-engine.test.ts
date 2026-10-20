import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InterventionDecisionEngine } from '../lib/voice/intervention-decision-engine';
import type { InterventionContext } from '../lib/voice/intervention-decision-engine';
import type { ILLMProvider, LLMMessage, LLMProviderType } from '../lib/llm/types';
import type { MeetingIntelligenceState } from '../types/requirement';

// Mock LLM provider matching ILLMProvider interface
class MockLLMProvider implements ILLMProvider {
  readonly providerType: LLMProviderType = 'fallback';

  public responseJson: Record<string, unknown> = {
    decision: 'SPEAK',
    confidence: 0.95,
    rationale: 'Severe security conflict detected with no human RE resolution.',
    responseText: 'Excuse me, I noticed an architectural conflict regarding database replication.',
  };

  async generateStructured<T>(_messages: LLMMessage[], _schema: unknown): Promise<T> {
    return this.responseJson as T;
  }

  async generateText(_messages: LLMMessage[]): Promise<string> {
    return JSON.stringify(this.responseJson);
  }
}

const baseState: MeetingIntelligenceState = {
  meetingId: 'm-123',
  projectId: 'p-1',
  candidateRequirements: [],
  issues: [],
  clarificationQuestions: [],
  lastUpdated: new Date().toISOString(),
};

describe('InterventionDecisionEngine (Phase 4)', () => {
  it('returns SILENT when voice intervention is disabled (hard guard)', async () => {
    const mockLLM = new MockLLMProvider();
    const engine = new InterventionDecisionEngine(mockLLM);

    const ctx: InterventionContext = {
      intelligenceState: baseState,
      voiceInterventionEnabled: false,
      isCurrentlySpeaking: false,
      humanSpeaking: false,
      secondsSinceLastSpeech: 100,
      meetingMode: 'assisted',
    };

    const result = await engine.evaluate(ctx);
    assert.equal(result.decision, 'SILENT');
    assert.ok(result.rationale.includes('disabled'));
  });

  it('returns SILENT when a human is currently speaking (barge-in guard)', async () => {
    const mockLLM = new MockLLMProvider();
    const engine = new InterventionDecisionEngine(mockLLM);

    const ctx: InterventionContext = {
      intelligenceState: {
        ...baseState,
        issues: [
          {
            id: 'issue-1',
            requirementId: 'req-1',
            issueType: 'AMBIGUITY',
            severity: 'high',
            description: 'Unclear SLA requirement',
            explanation: 'Vague response time limit',
            timestamp: new Date().toISOString(),
          },
        ],
      },
      voiceInterventionEnabled: true,
      isCurrentlySpeaking: false,
      humanSpeaking: true, // Human is talking
      secondsSinceLastSpeech: 100,
      meetingMode: 'assisted',
    };

    const result = await engine.evaluate(ctx);
    assert.equal(result.decision, 'SILENT');
    assert.ok(result.rationale.includes('human participant is currently speaking'));
  });

  it('returns SILENT when cooldown has not elapsed', async () => {
    const mockLLM = new MockLLMProvider();
    const engine = new InterventionDecisionEngine(mockLLM);

    const ctx: InterventionContext = {
      intelligenceState: {
        ...baseState,
        issues: [
          {
            id: 'issue-1',
            requirementId: 'req-1',
            issueType: 'AMBIGUITY',
            severity: 'high',
            description: 'Critical issue',
            explanation: 'No fallback defined',
            timestamp: new Date().toISOString(),
          },
        ],
      },
      voiceInterventionEnabled: true,
      isCurrentlySpeaking: false,
      humanSpeaking: false,
      secondsSinceLastSpeech: 5, // Less than 15s cooldown
      meetingMode: 'assisted',
    };

    const result = await engine.evaluate(ctx);
    assert.equal(result.decision, 'SILENT');
    assert.ok(result.rationale.includes('Cooldown active'));
  });

  it('evaluates and can return SPEAK when all guards pass and high-severity issue exists', async () => {
    const mockLLM = new MockLLMProvider();
    const engine = new InterventionDecisionEngine(mockLLM);

    const ctx: InterventionContext = {
      intelligenceState: {
        ...baseState,
        issues: [
          {
            id: 'issue-1',
            requirementId: 'req-1',
            issueType: 'CONFLICT',
            severity: 'high',
            description: 'Conflict in storage architecture',
            explanation: 'Engineers disagree on active-active replication',
            timestamp: new Date().toISOString(),
          },
        ],
      },
      voiceInterventionEnabled: true,
      isCurrentlySpeaking: false,
      humanSpeaking: false,
      secondsSinceLastSpeech: 60,
      meetingMode: 'assisted',
    };

    const result = await engine.evaluate(ctx);
    assert.equal(result.decision, 'SPEAK');
    assert.ok(result.responseText);
    assert.equal(result.confidence, 0.95);
  });

  it('evaluates and speaks in autonomous mode when customer speaks, even with 0 high-severity issues', async () => {
    const mockLLM = new MockLLMProvider();
    mockLLM.responseJson = {
      decision: 'SPEAK',
      confidence: 0.95,
      rationale: 'Customer asked if anybody is there and requested a payment app in autonomous mode.',
      responseText: 'Hello! Yes, I am here. I am SpecPilot, your AI Requirement Engineer. What features do you need in your payment app?',
    };
    const engine = new InterventionDecisionEngine(mockLLM);

    const ctx: InterventionContext = {
      intelligenceState: baseState, // 0 issues, 0 critical candidates
      recentTranscript: [
        {
          speakerName: 'Customer Stakeholder',
          role: 'customer',
          text: 'Hello? Is anybody there? I want an app on payment.',
          timestamp: new Date().toISOString(),
        },
      ],
      voiceInterventionEnabled: true,
      isCurrentlySpeaking: false,
      humanSpeaking: false,
      secondsSinceLastSpeech: 10,
      meetingMode: 'autonomous',
    };

    const result = await engine.evaluate(ctx);
    assert.equal(result.decision, 'SPEAK');
    assert.ok(result.responseText?.includes('SpecPilot'));
  });

  it('evaluates and speaks in assisted mode when Requirement Engineer asks a direct question, even with 0 issues', async () => {
    const mockLLM = new MockLLMProvider();
    mockLLM.responseJson = {
      decision: 'SPEAK',
      confidence: 0.95,
      rationale: 'Requirement Engineer asked a direct question about Android tech stack.',
      responseText: 'For Android, Kotlin with Jetpack Compose is the modern industry standard, or you could use Flutter or React Native for cross-platform.',
    };
    const engine = new InterventionDecisionEngine(mockLLM);

    const ctx: InterventionContext = {
      intelligenceState: baseState, // 0 issues, 0 critical candidates, 0 questions
      recentTranscript: [
        {
          speakerName: 'Requirement Engineer',
          role: 'REQUIREMENT_ENGINEER',
          text: 'Can you tell me what tech stack we can use to make an Android application?',
          timestamp: new Date().toISOString(),
        },
      ],
      voiceInterventionEnabled: true,
      isCurrentlySpeaking: false,
      humanSpeaking: false,
      secondsSinceLastSpeech: 10,
      meetingMode: 'assisted',
    };

    const result = await engine.evaluate(ctx);
    assert.equal(result.decision, 'SPEAK');
    assert.ok(result.responseText?.includes('Kotlin'));
  });
});

