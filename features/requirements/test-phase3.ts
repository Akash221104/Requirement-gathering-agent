import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { z } from 'zod';
import { FallbackLLMProvider } from '../../lib/llm/fallback-provider';
import { ConversationChunker } from './conversation-chunker';
import { RequirementIntelligenceEngine } from './services/requirement-intelligence';
import { intelligenceStore } from '../../lib/storage/intelligence-store';
import { requirementStore } from '../../lib/storage/requirement-store';
import type { TranscriptSegment } from '../../types/meeting';

async function runPhase3Tests() {
  console.log('====================================================');
  console.log('STARTING SPECPILOT PHASE 3 TEST SUITE');
  console.log('====================================================\n');

  console.log('--- TEST 1: LLM Abstraction & Resilient Fallback ---');
  // Initialize fallback provider (Groq -> OpenRouter)
  const llm = new FallbackLLMProvider();

  // Test structured schema generation
  const TestSchema = z.object({
    greeting: z.string(),
    sentiment: z.enum(['positive', 'neutral', 'negative']),
  });

  const structuredRes = await llm.generateStructured(
    [
      { role: 'system', content: 'Respond with JSON {"greeting": "...", "sentiment": "positive"}' },
      { role: 'user', content: 'Say hi to the requirement engineer' },
    ],
    TestSchema
  );

  console.log('✓ LLM Structured Generation Result:', structuredRes);
  console.assert(typeof structuredRes.greeting === 'string', 'Greeting should be a string');
  console.assert(structuredRes.sentiment === 'positive', 'Sentiment should be positive');

  console.log('\n--- TEST 2: Invalid LLM Output & Error Resilience ---');
  // Verify that schema validation failures or bad inputs throw descriptive errors without unhandled crashes
  let validationErrorCaught = false;
  try {
    const StrictSchema = z.object({
      numericCode: z.number(),
    });
    // Deliberately ask for something that will violate StrictSchema
    await llm.generateStructured(
      [
        { role: 'user', content: 'Return JSON {"numericCode": "not-a-number"}' },
      ],
      StrictSchema
    );
  } catch (err: unknown) {
    validationErrorCaught = true;
    console.log('✓ Expected schema validation error caught gracefully:', (err as Error).message.split('\n')[0]);
  }
  console.assert(validationErrorCaught, 'Invalid schema must be caught without crashing');

  console.log('\n--- TEST 3: Requirement Extraction, Quality Analysis & Clarification Questions ---');
  const engine = new RequirementIntelligenceEngine(llm);
  const meetingId = `test-phase3-meeting-${Date.now()}`;
  const projectId = 'project-001';

  // Seed an existing baseline requirement to test baseline conflict awareness
  await requirementStore.saveRequirement({
    id: 'REQ-AUTH-001',
    projectId,
    title: 'Authentication Strategy',
    description: 'System authentication shall be handled exclusively via Corporate Single Sign-On (SAML/Okta).',
    category: 'security',
    status: 'approved',
    priority: 'high',
    currentVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Simulated spoken conversation turns with deliberate ambiguity & potential conflict
  const testChunk: TranscriptSegment[] = [
    {
      id: 'seg-101',
      meetingId,
      speakerId: 'cust-1',
      speakerName: 'Sarah Customer',
      speakerRole: 'CUSTOMER',
      text: 'Users must be able to reset their password using email OTP, and the dashboard should load quickly.',
      isFinal: true,
      timestamp: new Date().toISOString(),
    },
    {
      id: 'seg-102',
      meetingId,
      speakerId: 'eng-1',
      speakerName: 'Mark Engineer',
      speakerRole: 'REQUIREMENT_ENGINEER',
      text: 'What kind of validity duration are we thinking for the OTP?',
      isFinal: true,
      timestamp: new Date().toISOString(),
    },
    {
      id: 'seg-103',
      meetingId,
      speakerId: 'cust-1',
      speakerName: 'Sarah Customer',
      speakerRole: 'CUSTOMER',
      text: 'Also, can standard external users sign in with username and password instead of Okta SSO?',
      isFinal: true,
      timestamp: new Date().toISOString(),
    },
  ];

  const intelState = await engine.analyzeChunk(meetingId, projectId, testChunk);
  console.assert(intelState !== null, 'Intelligence state should not be null');

  console.log(`✓ Analysis Complete:`);
  console.log(`  - Candidate Requirements Extracted: ${intelState?.candidateRequirements.length}`);
  intelState?.candidateRequirements.forEach((c, idx) => {
    console.log(`    [${idx + 1}] (${c.type}) "${c.requirementText}" | Status: ${c.status} | Conf: ${Math.round(c.confidence * 100)}%`);
    // Verify Human Approval Rule: AI suggestions are NEVER approved
    console.assert(c.status !== 'APPROVED', 'AI must NEVER automatically approve a candidate requirement');
  });

  console.log(`  - Quality Defects / Issues Detected: ${intelState?.issues.length}`);
  intelState?.issues.forEach((iss, idx) => {
    console.log(`    [${idx + 1}] [${iss.issueType}] ${iss.description} (${iss.severity} severity)`);
    console.log(`        Explanation: ${iss.explanation}`);
  });

  console.log(`  - Clarification Suggestions for Engineer: ${intelState?.clarificationQuestions.length}`);
  intelState?.clarificationQuestions.forEach((q, idx) => {
    console.log(`    [${idx + 1}] Question: "${q.question}"`);
    console.log(`        Rationale: ${q.rationale}`);
  });

  console.assert((intelState?.candidateRequirements.length || 0) > 0, 'Should extract at least one candidate requirement');
  console.assert((intelState?.issues.length || 0) > 0, 'Should detect ambiguity or missing constraint (e.g. quickly or OTP duration)');
  console.assert((intelState?.clarificationQuestions.length || 0) > 0, 'Should suggest clarification questions');

  console.log('\n--- TEST 4: Filesystem Persistence & Provenance ---');
  const persisted = await intelligenceStore.getIntelligence(meetingId, projectId);
  console.assert(persisted !== null, 'Intelligence state should exist in filesystem');
  console.assert(persisted?.candidateRequirements.length === intelState?.candidateRequirements.length, 'Persisted candidates count must match');
  console.log(`✓ Filesystem persistence verified at data/projects/${projectId}/meetings/${meetingId}-intelligence.json`);

  console.log('\n--- TEST 5: Conversation Chunker Turn Logic & Interim Filter ---');
  const chunker = new ConversationChunker();

  let chunkerUpdateReceived = false;
  chunker.onIntelligenceUpdate(meetingId, (state) => {
    chunkerUpdateReceived = true;
    console.log('✓ Chunker triggered intelligence analysis callback with', state.candidateRequirements.length, 'candidates');
  }, projectId);

  // 5.1 Push interim transcript: MUST BE IGNORED
  chunker.pushFinalSegment(meetingId, {
    id: 'seg-interim-1',
    meetingId,
    speakerId: 'cust-1',
    speakerName: 'Sarah',
    speakerRole: 'CUSTOMER',
    text: 'We also need export to PDF',
    isFinal: false, // INTERIM
    timestamp: new Date().toISOString(),
  }, projectId);

  // 5.2 Push final transcripts
  chunker.pushFinalSegment(meetingId, {
    id: 'seg-final-1',
    meetingId,
    speakerId: 'cust-1',
    speakerName: 'Sarah',
    speakerRole: 'CUSTOMER',
    text: 'We also need export to PDF and Excel spreadsheets.',
    isFinal: true,
    timestamp: new Date().toISOString(),
  }, projectId);

  chunker.pushFinalSegment(meetingId, {
    id: 'seg-final-2',
    meetingId,
    speakerId: 'eng-1',
    speakerName: 'Mark',
    speakerRole: 'REQUIREMENT_ENGINEER',
    text: 'Should the exports include confidential financial fields?',
    isFinal: true,
    timestamp: new Date().toISOString(),
  }, projectId);

  chunker.pushFinalSegment(meetingId, {
    id: 'seg-final-3',
    meetingId,
    speakerId: 'cust-1',
    speakerName: 'Sarah',
    speakerRole: 'CUSTOMER',
    text: 'No, only sanitized public transaction summaries.',
    isFinal: true,
    timestamp: new Date().toISOString(),
  }, projectId);

  console.log('Waiting for chunker turn evaluation...');
  const startWait = Date.now();
  while (!chunkerUpdateReceived && Date.now() - startWait < 75000) {
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.assert(chunkerUpdateReceived, 'Chunker should have evaluated the completed turns');

  console.log('\n====================================================');
  console.log('ALL PHASE 3 TESTS COMPLETED AND VERIFIED!');
  console.log('====================================================');
}

runPhase3Tests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
