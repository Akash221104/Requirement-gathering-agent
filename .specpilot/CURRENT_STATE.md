# SpecPilot: Current Development State

This document tracks the immediate, active state of development. It maintains a strict separation between what is **Designed / Planned** and what is actually **Implemented** in the codebase.

---

## Current Phase
**Phase 4.5: Meeting UI/UX Polish, Role-Based Experience & SpecPilot Participant Tile (Verified & Complete)**

---

## Current Module
Meeting UI/UX & Voice Experience Refinement (Phase 4.5: Dedicated SpecPilot AI Participant Tile, 3-Participant Video Grid, Role-Segregated Customer vs Engineer Views, Unified Engineer Co-Pilot Workspace, Direct Conversational Question Answering in Assisted Mode, and Zero-Undefined Header/Control Polish)

---

## Implemented Foundations & Modules (Verified Codebase Status)

### 1. TTS Provider Abstraction & Deepgram Aura Integration (**IMPLEMENTED - Phase 4**)
- **Vendor-Decoupled Interface (`lib/tts/types.ts`)**:
  - `ITTSProvider` interface specifying `synthesize(options: TTSSynthesisOptions): Promise<TTSSynthesisResult>`.
  - Server-side only by architectural mandate (ADR-027). Secrets (`DEEPGRAM_API_KEY`) never leak to browser bundles.
- **Deepgram Aura Provider (`lib/tts/deepgram-tts-provider.ts`)**:
  - Synthesizes raw linear16 mono PCM audio (16 kHz / 24 kHz) directly via Deepgram Aura REST API.
  - Returns `audioBuffer`, duration estimation, and audio parameters for LiveKit `AudioFrame` delivery.

### 2. Intervention Decision Engine (**IMPLEMENTED - Phase 4**)
- **Sole Decision Authority (`lib/voice/intervention-decision-engine.ts`)**:
  - Evaluates whether SpecPilot should `SILENT`, `SUGGEST`, or `SPEAK`.
  - Requirement Intelligence (Phase 3) is decoupled from voice output; it only supplies facts and detections.
- **Strict Hard Guards (Never involve LLM if guards fail)**:
  - Voice Intervention Toggle Guard: If RE has voice intervention disabled (default: OFF), returns `SILENT`.
  - Self-Speaking Guard: If SpecPilot is currently speaking, returns `SILENT`.
  - Interruption Guard: If a human participant is currently speaking, returns `SILENT`.
  - Cooldown Enforcement: 45-second minimum cooldown between spoken interventions.
  - Severity Threshold Guard: Returns `SILENT` if no high-severity defect or critical conflict exists.
- **Structured Schema & Structured Fallback**:
  - Validated by Zod `InterventionDecisionSchema`.

### 3. Voice Intervention Service & LiveKit Audio Publishing (**IMPLEMENTED - Phase 4**)
- **Service Orchestration (`features/meeting/services/voice-intervention-service.ts`)**:
  - Manages LiveKit `AudioSource` and `LocalAudioTrack` on the `specpilot-ai` participant.
  - Paces raw PCM streaming into 10ms `AudioFrame` chunks (160 samples per frame at 16 kHz).
  - Unpublishes and closes tracks cleanly after speech completes.
- **Barge-In Interruption Handling**:
  - Monitored in `SpecPilotAgent.notifyHumanSpeaking()`.
  - When any human participant starts speaking, `currentSpeechAbortController.abort()` immediately terminates audio frame streaming and clears the playout queue.
- **Self-Listening Prevention**:
  - Track subscription filter explicitly rejects tracks where `participant.identity === 'specpilot-ai'`.
  - `isCurrentlySpeaking` flag inhibits any circular feedback loops into the STT layer.
- **Silent Suggestion Mode (`SUGGEST`)**:
  - When `action === 'SUGGEST'`, text and rationale are broadcast over LiveKit data channel (`topic: 'voice-suggestion'`) without audio output.

### 4. Engineer Voice Controls & UI Integration (**IMPLEMENTED - Phase 4**)
- **API Endpoint (`/api/meetings/[meetingId]/voice`)**:
  - `GET`: Returns `{ voiceInterventionEnabled }`.
  - `POST`: Toggles voice intervention ON or OFF with `{ enabled: boolean }`.
- **UI Control Bar (`MeetingControlBar.tsx`)**:
  - Voice Intervention toggle button allowing the engineer to mute or enable SpecPilot voice output at any time.
- **UI Header Indicator (`MeetingHeader.tsx`)**:
  - Live badge indicator showing `● Voice On` / `○ Voice Muted`.
- **UI Intelligence Panel Integration (`RequirementIntelligencePanel.tsx`)**:
  - Real-time display of silent voice suggestions with instant one-click copy button.
- **Speaking Overlay (`MeetingRoom.tsx`)**:
  - Visual pulse overlay displaying the active spoken phrase when SpecPilot is talking.

### 5. Role-Based Meeting UX & Data Isolation (**IMPLEMENTED - ADR-030**)
- **Customer View**:
  - Distraction-free, minimal meeting experience (`isCustomer === true`).
  - Renders only participant video/audio, clean title, session pill (`Customer Session`), simple non-technical indicator (`● SpecPilot is participating`), and essential controls (`Mic`, `Camera`, `Leave`).
  - No access to intelligence, defects, confidence scores, transcripts, internal AI statuses, or voice intervention toggles.
- **Client Data Isolation**:
  - Customer frontend does not poll `/api/meetings/[id]/intelligence` or `/api/meetings/[id]/voice`.
  - Discards LiveKit Data Channel messages on internal topics (`requirement-intelligence`, `voice-suggestion`, `specpilot-voice-state`).
- **Requirement Engineer Co-Pilot Workspace**:
  - 3-zone layout with 60–65% video and 35–40% `EngineerWorkspacePanel`.
  - Tab 1 `Requirements`: Structured cards with candidate ID (e.g. `FR-004`), category badges, requirement text, confidence scores, source speaker and timestamps, and `[Review]` action dialog (no raw prompt dumps).
  - Tab 2 `Issues`: Quality defect cards with `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` severities, defect titles, "Why it matters" explanations, and "Suggested clarification" questions with copy buttons.
  - Tab 3 `Suggestions`: Actionable questions with `[Use Question]` and `[Dismiss]` actions.
  - Tab 4 `Transcript`: Diarized utterances with `CUSTOMER`, `REQUIREMENT ENGINEER`, and `SPEC PILOT` badges, scroll-aware auto-scrolling, and clean empty states.
- **Control Bar & Header Hierarchy**:
  - Grouped controls separating participant actions from AI controls.
  - Zero "undefined" or null string renders; safe fallbacks across meeting lists, pre-join, and active rooms.

### 6. SpecPilot AI Participant Tile & Three-Participant Video Stage (**IMPLEMENTED - Phase 4.5 & ADR-031**)
- **Visual AI Presence (`SpecPilotParticipantTile.tsx`)**:
  - SpecPilot renders as an explicit 3rd participant tile on the video stage alongside human participants (Customer and Requirement Engineer), eliminating the invisible-bot paradigm without fabricating a fake webcam stream.
  - Real-time visual states: `LISTENING` (subtle pulse), `ANALYZING` (cyan breathing ring), `SPEAKING` (animated outer pulse ring + dynamic bouncing waveform bars), `MUTED / VOICE OFF` (amber indicator), and `CONNECTING`.
  - Identity matching: Renders when `participant.role === 'SPEC_PILOT'` or `identity === 'specpilot-ai'`.
  - Stage layout: Dynamically scales from 1 to 3 grid tiles (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) with video area receiving 60–65% of screen width.
- **Direct Conversational Inquiry Answering in Assisted Mode**:
  - `InterventionDecisionEngine` now recognizes conversational questions and inquiries directed at SpecPilot or regarding technical architecture/requirements (`isDirectInquiry` matching `what`, `how`, `can you`, `tell me`, `recommend`, etc.).
  - Bypasses the defect-only gate in Assisted Mode when AI Voice is enabled (`voiceInterventionEnabled === true`), allowing SpecPilot to answer RE and customer questions directly with 3s conversational cooldown while preserving the 45s cooldown for unsolicited defect alerts.
  - `ConversationChunker` configured with 800ms fast-debounce on question inquiries.
  - Fail-fast bypass in `FallbackLLMProvider` for HTTP 404 / `model_not_found` errors to prevent stalled voice turns.

### 7. Phase 3 Requirement Intelligence (**IMPLEMENTED - Phase 3**)
- LLM abstraction (Groq + OpenRouter fallback), `ConversationChunker`, `RequirementIntelligence`, and JSON repair.

### 8. Phase 1 & 2 Foundations (**IMPLEMENTED - Phase 1 & 2**)
- LiveKit Cloud WebRTC meeting foundation (`MeetingRoom`, `ParticipantTile`, `MeetingControlBar`).
- Server-side AI participant (`specpilot-ai`) with Deepgram streaming STT.
- `ConversationManager` and LiveKit Data Channel streaming.

---

## Designed Modules (Agreed Architecture - NOT Implemented Yet)
The following functionality belongs to subsequent phases and is **NOT IMPLEMENTED**:
1. **NO Automatic Baseline Mutation**: The human Requirement Engineer remains the sole approving authority.
2. **NO Calendar Integration or Autonomous Scheduling**.
3. **NO PostgreSQL or pgvector Database Migration**.

---

## Current Verification & Test Status
- `npx tsc --noEmit`: 0 errors (Verified clean)
- `npm test`: 9/9 tests passing (100% pass rate)
  - ✓ DeepgramTTSProvider initialization, error handling, and mock PCM synthesis verified
  - ✓ InterventionDecisionEngine hard guards (disabled toggle, human speaking, cooldown) verified
  - ✓ InterventionDecisionEngine high-severity SPEAK decision verified
  - ✓ InterventionDecisionEngine direct conversational inquiry in assisted mode verified
  - ✓ Autonomous mode customer speech trigger verified
- `npm run lint`: 0 errors (Verified clean)
- `npm run build`: Next.js 16 production build succeeded (Exit code: 0)
- Security & Data Audit:
  - Zero hardcoded secrets in source code, commit history, or logs
  - DEEPGRAM_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY accessed strictly server-side
  - Internal intelligence data channels isolated from customer clients

---

## Next Recommended Phase
- **Phase 5: Requirement Engineering Workflows, Document Export & Baseline Consolidation**.

---

## Last Updated
- 2026-10-19
