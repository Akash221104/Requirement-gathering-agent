# Meeting Management Module

## Purpose
The Meeting Management module manages live requirement engineering meetings. It provides real-time AI co-pilot capabilities during engineer-led sessions and autonomously hosts routine follow-up requirement sessions with customers.

## Responsibilities
- Manage live audio sessions and real-time conversation streaming
- Conduct live conversation analysis and turn management
- Extract candidate requirements in real time
- Detect ambiguity, incompleteness, and missing constraints
- Detect conflicts with previously approved requirements and decisions
- Detect client requirement drift and scope changes
- Provide real-time suggestions and targeted questions to the Requirement Engineer
- Answer real-time queries posed by the Requirement Engineer
- Intervene directly via voice on high-confidence, critical contradictions or risks
- Host and conduct autonomous follow-up meetings based on pre-defined agendas
- Handle barge-in and audio interruption detection
- Generate complete meeting transcripts, structured summaries, and post-meeting change proposals

## Architecture
The module operates across two distinct operational modes utilizing a shared real-time voice pipeline:

### Modes
1. **Engineer-Assisted Meeting**:
   - Participants: Customer + Requirement Engineer (RE) + SpecPilot.
   - Lead: Requirement Engineer leads the discussion.
   - SpecPilot Role: Intelligent co-pilot listening, analyzing, suggesting questions, answering engineer inquiries, and intervening when necessary.
2. **Autonomous Meeting**:
   - Participants: Customer + SpecPilot.
   - Lead: SpecPilot acts as host and facilitator for routine follow-up sessions.
   - SpecPilot Role: Loads project context and pending questions, presents agenda, asks follow-up questions, analyzes answers, detects changes, and generates proposed requirement updates for post-meeting engineer review.

### Voice Pipeline & Barge-In
$$\text{Speech} \longrightarrow \text{Voice Layer} \longrightarrow \text{Streaming STT} \longrightarrow \text{Conversation Manager} \longrightarrow \text{Agent Brain} \longrightarrow \text{Requirement/Decision Engine} \longrightarrow \text{Response} \longrightarrow \text{Streaming TTS} \longrightarrow \text{Voice Layer}$$

- **Barge-In Flow**: When the agent is speaking and user speech is detected by the voice layer, TTS playback halts immediately, transitioning the agent back into listening and processing mode.

### Speaking Modes (Engineer-Assisted)
- `SILENT`: Listens and analyzes in the background without vocal output.
- `SUGGEST`: Emits textual recommendations, cues, and questions to the engineer's interface.
- `SPEAK / DIRECT INTERVENTION`: Agent speaks directly into the audio conference when high-confidence issues demand immediate clarification.

## Inputs
- Real-time client and engineer audio streams
- Text commands and inquiries from the Requirement Engineer
- Active project context, prior meeting summaries, and baseline requirements from Project Knowledge & Memory
- Structured agendas from Calendar & Meeting Planning

## Processing / Logic
- Streaming STT processing and speaker diarization/identification
- Real-time conversation chunking and semantic evaluation
- Ambiguity and conflict detection against stored requirement baselines
- Confidence scoring for potential vocal interventions (evaluating contradiction severity, security implications, or major client inconsistencies)
- Interruption handling (barge-in event processing)
- Agenda tracking and goal completion evaluation during autonomous meetings

## Outputs
- Low-latency synthesized speech (Streaming TTS)
- Textual suggestions and warnings rendered in the engineer UI
- Live-extracted requirement candidates and flagged issues
- Final timestamped meeting transcript
- Structured meeting summary and action items
- Post-meeting Change Proposals

## Data / Storage
Meeting sessions are stored under the project filesystem directory:
- Path: `data/projects/{projectId}/meetings/meeting-{meetingId}.json`
- Schema Entities:
  - `meetingId`, `projectId`, `title`, `mode` (`assisted` | `autonomous`)
  - `status` (`scheduled` | `in_progress` | `completed`)
  - `participants` (names, roles)
  - `startTime`, `endTime`, `duration`
  - `agenda` (list of agenda items and completion statuses)
  - `transcript` (array of timestamped utterances with speaker IDs)
  - `extractedRequirements` (IDs of candidate requirements extracted)
  - `detectedIssues` (ambiguities, conflicts, drift warnings)
  - `changeProposals` (IDs of generated change proposals)
  - `summary` (structured recap, key decisions, action items)

## Agent Behavior
- **In Assisted Mode**: Adapts to the configured speaking mode (`SILENT`, `SUGGEST`, `SPEAK`). Never interrupts the human engineer. Intervenes only on critical contradictions or major missing constraints when `SPEAK` mode is enabled.
- **In Autonomous Mode**: Greets the customer, introduces the session agenda, systematically covers unresolved items, probes vague answers with clarification questions, validates constraints, acknowledges customer input, and concludes gracefully once goals are met.

## Human Approval
- In Assisted Mode, the engineer controls speaking mode toggles, can mute the agent at any point, and chooses whether to voice suggested questions.
- In Autonomous Mode, the agent is strictly prohibited from mutating official requirement baselines; all findings, notes, and draft changes are queued for subsequent human engineer approval.

## Dependencies
- Next.js API/backend routes and WebSocket/SSE streaming
- Real-time Voice AI layer (VerbX / Verbex / Voice AI integration)
- Primary LLM provider (Groq / GPT-OSS 120B) with OpenRouter fallback
- Storage abstraction layer (`lib/storage/meeting-store.ts`)

## Integration With Other Modules
- **Requirement Engineering**: Supplies live transcripts and utterance chunks for real-time requirement extraction, classification, and conflict analysis.
- **Project Knowledge & Memory**: Retrieves historical context before meetings and writes completed transcripts, summaries, and facts post-meeting.
- **Calendar & Meeting Planning**: Receives meeting agendas and emits unresolved items to trigger follow-up scheduling.
- **Agent Action & Workflow**: Delegates action proposals (e.g., updating drafts, creating issues) to the agent workflow loop.

## Important Rules
1. Never speak directly in an assisted meeting unless explicitly permitted by the active speaking mode (`SPEAK`).
2. Immediate vocal intervention requires high-confidence detection of critical contradictions, severe security/privacy ambiguities, or significant client inconsistencies.
3. Support seamless barge-in; halt agent audio playback instantly upon detecting user speech.
4. Autonomous meetings must never commit baseline requirement changes directly.

## Current Implementation Status
**Phase 1 & Phase 2: LiveKit Video Meeting Foundation & SpecPilot AI Realtime STT Pipeline (IMPLEMENTED & VERIFIED)**

- **Phase 1: Video Meeting Foundation (COMPLETE)**:
  - Full-featured browser-based video meeting room utilizing LiveKit Cloud (`wss://agent-uyio24ml.livekit.cloud`).
  - Multi-participant video grid supporting Customer and Requirement Engineer.
  - Real-time two-way audio and video streaming.
  - Mute/unmute microphone and enable/disable camera controls with state feedback.
  - Pre-join room entry screen with role selection (`Customer` vs. `Requirement Engineer`), display name customizer, and local device preview.
  - Participant tiles with dynamic role badges, speaking indicators, avatar fallbacks, and mic status icons.
  - Meeting header with live elapsed timer, participant count, and one-click invite link copier.
  - Secure server-side LiveKit JWT token generation endpoint (`/api/livekit/token`) with role metadata.
  - Filesystem persistence via `FileMeetingStore` (`/api/meetings`, `/api/meetings/[meetingId]`).

- **Phase 2: SpecPilot AI Participant & Realtime STT Pipeline (COMPLETE)**:
  - **Server-Side AI Participant**:
    - SpecPilot joins the same LiveKit room as a backend WebRTC participant (`specpilot-ai`, role: `SPEC_PILOT`) via `@livekit/rtc-node` (`features/meeting/services/specpilot-agent.ts`).
    - API lifecycle control endpoints at `/api/meetings/[meetingId]/agent` (GET, POST, DELETE).
  - **Audio Ingestion**:
    - Automatically subscribes to incoming participant audio tracks (`TrackKind.KIND_AUDIO`) from Customer and Requirement Engineer.
    - Uses `AudioStream(track, 16000, 1)` to ingest 16kHz mono linear16 PCM audio frames.
    - Zero raw audio is stored on disk.
  - **Speech-to-Text Pipeline (Deepgram)**:
    - Replaceable STT abstraction (`ISTTProvider` interface in `features/meeting/stt/stt-provider.ts`).
    - `DeepgramSTTProvider` (`features/meeting/stt/deepgram-stt-provider.ts`) connects directly via resilient WebSocket to `wss://api.deepgram.com/v1/listen`.
    - Per-speaker isolated STT sessions guaranteeing 100% accurate speaker attribution without heuristic diarization errors.
    - Supports interim (partial) streaming transcripts and finalized transcripts.
  - **Conversation Manager (`features/meeting/conversation/conversation-manager.ts`)**:
    - Maintains chronological utterance sequence.
    - Updates interim speech per speaker and commits final utterances.
    - Preserves speaker identity (`speakerId`, `speakerName`, `speakerRole`).
    - Publishes updates in real time via LiveKit WebRTC Data Channel (`topic: 'transcript'`).
  - **Live Transcript UI & Status Badge**:
    - `LiveTranscriptPanel`: Collapsible panel showing speaker utterances, role badges, timestamps, final text, and streaming interim indicators.
    - `SpecPilotStatusBadge`: Real-time status indicator (`Connecting...`, `Listening`, `Transcribing...`, `Disconnected`, `Unavailable`).
    - Seamlessly integrated into `MeetingRoom`, `MeetingHeader`, and `MeetingControlBar`.
  - **Transcript Storage (`lib/storage/transcript-store.ts`)**:
    - Persists final transcript segments under `data/projects/{projectId}/meetings/meeting-{meetingId}-transcript.json`.
    - REST retrieval endpoint at `/api/meetings/[meetingId]/transcript`.
  - **Failure Handling**:
    - Completely non-blocking: Human meeting continues uninterrupted if SpecPilot or Deepgram encounters errors.

- **Phase 3: Requirement Intelligence & LLM Brain (IMPLEMENTED & VERIFIED)**:
  - **Conversation Chunker (`features/requirements/conversation-chunker.ts`)**:
    - Discards interim transcripts, processing only finalized utterances (`isFinal: true`).
    - Sliding window maintaining last 15 turns for context.
    - Adaptive debouncing based on requirement trigger keywords and turn counts.
    - Segment ID deduplication preventing repeated LLM analysis.
  - **LLM Brain & Resilient Fallback (`lib/llm/`)**:
    - Primary Groq (`llama-3.3-70b-versatile`) with transparent failover to OpenRouter (`meta-llama/llama-3.3-70b-instruct`).
    - Robust JSON sanitization (`cleanAndRepairJson`) handling edge-case LLM outputs.
  - **Requirement Intelligence Engine (`features/requirements/services/requirement-intelligence.ts`)**:
    - Real-time extraction of structured candidate requirements.
    - Quality defect analysis (ambiguity, vagueness, missing constraints, non-measurability, baseline conflicts).
    - Targeted clarification questions synthesized for the Requirement Engineer.
    - Baseline awareness: Checks against existing project requirements in `data/projects/{projectId}/requirements.json`.
    - Strict human authority rule: All candidates remain in advisory states (`PROPOSED`, `NEEDS_CLARIFICATION`, `CONFLICT`).
  - **Real-Time Delivery & UI Panel**:
    - LiveKit WebRTC Data Channel broadcasting under topic `requirement-intelligence`.
    - `RequirementIntelligencePanel` tabbed sidebar displaying Candidates, Quality Issues, and Clarifications with one-click copy.
    - Filesystem persistence to `data/projects/{projectId}/meetings/meeting-{meetingId}-intelligence.json`.
    - Non-blocking architecture: Meeting audio/video and STT transcription continue uninterrupted during LLM analysis or failovers.

- **Phase 4: SpecPilot Voice Intervention & Decision Engine (IMPLEMENTED & VERIFIED)**:
  - **TTS Provider Abstraction (`lib/tts/`)**:
    - `ITTSProvider` interface specifying raw PCM audio synthesis.
    - `DeepgramTTSProvider` using Deepgram Aura REST API (`aura-asteria-en`) producing raw linear16 mono PCM (16 kHz).
    - Server-side only: API keys (`DEEPGRAM_API_KEY`) never leak to browser bundles.
  - **Intervention Decision Engine (`lib/voice/intervention-decision-engine.ts`)**:
    - Sole authority over `SILENT`, `SUGGEST`, or `SPEAK` actions.
    - Strictly decoupled from Requirement Intelligence.
    - Hard programmatic guards: (1) Voice intervention toggle ON, (2) No human participant currently speaking, (3) 45-second cooldown timer, (4) High-severity defect or critical conflict present.
    - Validated by Zod `InterventionDecisionSchema`.
  - **Voice Intervention Service (`features/meeting/services/voice-intervention-service.ts`)**:
    - Manages LiveKit `AudioSource` and `LocalAudioTrack` on the `specpilot-ai` participant.
    - Paces raw PCM streaming into 10ms `AudioFrame` chunks (160 samples per frame at 16 kHz).
    - Unpublishes and disposes tracks cleanly after speech completes.
    - Barge-in handling: `currentSpeechAbortController.abort()` instantly stops audio streaming when a human starts speaking.
    - Circular self-listening prevention: Filter rejects tracks from `identity === 'specpilot-ai'`.
    - Silent suggestion mode: Broadcasts text & rationale over LiveKit data channel (`topic: 'voice-suggestion'`).
  - **Engineer Controls & UI Integration**:
    - REST toggle endpoint `/api/meetings/[meetingId]/voice` (GET, POST).
    - `MeetingControlBar`: Voice toggle button allowing the engineer to enable or mute voice intervention.
    - `MeetingHeader`: Live badge indicating `● Voice On` / `○ Voice Muted`.
    - `RequirementIntelligencePanel`: Real-time display of silent voice suggestions with one-click copy.
    - `MeetingRoom`: Pulse overlay showing currently spoken text when SpecPilot is speaking.

- **Role-Based Meeting UX & Intelligence Data Isolation (IMPLEMENTED & VERIFIED - ADR-030)**:
  - **Customer Meeting Experience**:
    - Clean, minimal, non-technical video conference interface.
    - Customer sees: Meeting title, `Customer Session` badge, `● SpecPilot is participating` subtle indicator, participant count, elapsed timer, participant videos, self-preview, and minimal controls (`[Mute]`, `[Camera]`, `[Leave]`).
    - Customer does NOT see: Transcript, intelligence, candidate requirements, defects, confidence scores, AI suggestions, copy buttons, voice intervention toggles, or debug statuses.
  - **Data Visibility & Isolation**:
    - The customer client does not poll `/api/meetings/[id]/intelligence` or `/api/meetings/[id]/voice`.
    - LiveKit Data Channel messages on internal engineering topics (`requirement-intelligence`, `voice-suggestion`, `specpilot-voice-state`) are explicitly discarded by customer clients.
  - **Requirement Engineer Co-Pilot Workspace**:
    - Professional 3-zone layout: Header, 60–65% video on left, 35–40% `EngineerWorkspacePanel` on right.
    - Unified 4-tab copilot workspace:
      1. `Requirements`: Candidate cards with ID (`FR-004`), type badge, confidence score, source speaker/timestamp, status (`Proposed`, `Needs Clarification`, `Conflict`), and `[Review]` dialog (safe summary, no raw prompt dumps).
      2. `Issues`: Quality defect cards with `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` risk badges, explanation of why it matters, and suggested clarification questions with copy actions.
      3. `Suggestions`: Actionable questions with `[Use Question]` (copies to clipboard) and `[Dismiss]` actions.
      4. `Transcript`: Live diarized transcript with `CUSTOMER`, `REQUIREMENT ENGINEER`, and `SPEC PILOT` badges, timestamps, and scroll-aware auto-scrolling.
  - **Meeting Header & Control Bar Polish**:
    - Clean visual hierarchy with zero `undefined`, `null`, or `NaN` values. Safe fallbacks for meeting titles across all views.
    - Grouped controls separating participant actions (`Mic`, `Camera`) from AI controls (`Workspace`, `AI Voice: On/Muted`), with prominent `Leave` control.

- **Phase 4.5: SpecPilot AI Participant Tile & Meeting Polish (IMPLEMENTED & VERIFIED - ADR-031)**:
  - **Visual 3-Participant Meeting Stage (`SpecPilotParticipantTile.tsx`)**:
    - SpecPilot visually appears as an explicit 3rd participant tile on the video stage alongside human participants (Customer and Requirement Engineer), eliminating the invisible-bot paradigm without fabricating a fake webcam stream.
    - Active visual states: `LISTENING` (subtle pulse), `ANALYZING` (cyan breathing ring), `SPEAKING` (animated outer pulse ring + dynamic bouncing waveform bars), `MUTED / VOICE OFF` (amber indicator), and `CONNECTING`.
    - Stage layout: Video grid dynamically adapts from 1 to 3 grid tiles (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) with video area receiving 60–65% of screen width.
  - **Direct Conversational Inquiry Answering in Assisted Mode**:
    - `InterventionDecisionEngine` distinguishes between unsolicited defect interventions and direct conversational questions/inquiries (`isDirectInquiry` matching `what`, `how`, `can you`, `tell me`, `recommend`, etc.).
    - Bypasses the defect-only gate in Assisted Mode when AI Voice is enabled (`voiceInterventionEnabled === true`), allowing SpecPilot to answer RE and customer questions verbally with 3s conversational cooldown while preserving 45s cooldown for unsolicited defect alerts.
    - `ConversationChunker` configured with 800ms fast-debounce on question inquiries.
    - Fail-fast bypass in `FallbackLLMProvider` for HTTP 404 / `model_not_found` errors.

- **Phase 5+ (Pending / Not Implemented Yet)**:
  - Autonomous meeting leadership and agenda conduction (driving customer meetings without human RE)
  - Requirement document generation & markdown/PDF export
  - Video stream and presentation screen-share analysis
