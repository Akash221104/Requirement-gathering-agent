# SpecPilot: Architecture & Product Decisions

This file logs all confirmed architectural, technological, and product decisions for SpecPilot. Each record contains the decision, status, rationale, and impact on system design.

---

### ADR-001: Autonomous Requirement Engineering Co-Pilot & Agent
- **Decision**: SpecPilot is designed as an AI-powered requirement engineering co-pilot and autonomous agent, not merely a meeting transcriber or summarizer.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Traditional RE meetings lose context and require excessive manual work. SpecPilot actively assists during meetings, extracts structured requirements, detects conflicts, and autonomously executes routine follow-ups.
- **Impact**: Requires a proactive agent architecture with voice interactivity, context reasoning, and workflow automation.

---

### ADR-002: Mandatory Human-in-the-Loop for Important Changes
- **Decision**: The human Requirement Engineer remains the ultimate authority for approving requirements, baseline updates, architectural decisions, and customer communications.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: AI should propose, analyze, and assist, but critical business and contractual baselines cannot be changed without human verification and liability.
- **Impact**: All high-risk agent actions must pass through an explicit permission/approval gate.

---

### ADR-003: Dual Meeting Modes (Engineer-Assisted & Autonomous)
- **Decision**: SpecPilot supports two operational meeting modes: Engineer-Assisted Meeting (Customer + RE + SpecPilot) and Autonomous Meeting (Customer + SpecPilot).
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Discovery meetings require human relationship management and leadership, whereas routine follow-ups and clarifications can be handled autonomously to save engineer time.
- **Impact**: Meeting management and voice pipeline must support different participation roles, conversation managers, and permission policies depending on the mode.

---

### ADR-004: Three Speaking Modes in Engineer-Assisted Meetings
- **Decision**: SpecPilot provides three configurable speaking modes during engineer-assisted sessions: `SILENT`, `SUGGEST`, and `SPEAK / DIRECT INTERVENTION`.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: The engineer needs fine-grained control over when the AI speaks directly to the client versus providing unobtrusive private guidance.
- **Impact**: Voice synthesis must be toggleable in real time; direct intervention requires high-confidence thresholds (e.g., severe conflict detection).

---

### ADR-005: Autonomous Meeting Scope Restricted to Routine Follow-ups
- **Decision**: Autonomous meetings are restricted to routine follow-up sessions based on pre-established agendas and unresolved questions.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Unconstrained initial requirements elicitation requires human nuance, whereas follow-ups on specific open items have well-defined boundaries.
- **Impact**: Autonomous sessions load explicit context, track goal completion, and produce proposed updates rather than committing baselines.

---

### ADR-006: Mandatory Engineer Review for Autonomous Meeting Outcomes
- **Decision**: The autonomous agent cannot commit updates to the official requirement baseline; all outcomes must be reviewed and approved by the Requirement Engineer post-meeting.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Safeguards against hallucinations, misunderstandings, or scope creep introduced during autonomous customer conversations.
- **Impact**: Requires a post-meeting review UI and change-staging workflow for the engineer.

---

### ADR-007: Version-Controlled Requirements & Immutable History
- **Decision**: Requirements are version-controlled (e.g., v1 $\rightarrow$ v2 $\rightarrow$ v3) and must never be silently overwritten or deleted.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Requirement evolution must be fully auditable for compliance, client alignment, and technical development.
- **Impact**: Requirement store data model must support historical version trees and diffs.

---

### ADR-008: Change Proposal Mechanism for Baseline Modifications
- **Decision**: Significant changes to requirements must generate a formal Change Proposal (capturing previous requirement, proposed requirement, reason, source meeting, impact, and approval status).
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Provides a structured artifact for review, discussion, and approval before baseline mutation.
- **Impact**: Core workflow transitions from candidate/draft directly to Change Proposal when modifying existing baselines.

---

### ADR-009: End-to-End Requirement Traceability
- **Decision**: Full traceability must link Customer Statement $\rightarrow$ Meeting $\rightarrow$ Requirement $\rightarrow$ Decision $\rightarrow$ Change Proposal $\rightarrow$ Requirement Version $\rightarrow$ Approval.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Requirement engineers need to answer why a requirement exists, where it originated, why it changed, and who approved it.
- **Impact**: Every entity in the data store must reference its upstream parent entity IDs and meeting timestamps.

---

### ADR-010: Cross-Meeting Persistent Project Memory
- **Decision**: Project knowledge, decisions, requirements, and meeting context persist permanently across meetings rather than existing ephemerally.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Eliminates amnesia between meetings and enables the agent to reference historical agreements during live discussions.
- **Impact**: Project Knowledge & Memory module serves as a persistent repository across all sessions.

---

### ADR-011: Relevant Context Retrieval Over Full-History LLM Ingestion
- **Decision**: The system selectively retrieves relevant memory entities rather than dumping the full raw project history into LLM prompts.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Avoids token exhaustion, reduces latency, prevents hallucinations from irrelevant context, and controls operational costs.
- **Impact**: Memory Manager must implement targeted keyword and semantic retrieval pipelines.

---

### ADR-012: Initial Storage on Local Filesystem for Hackathon Simplicity
- **Decision**: The initial hackathon implementation will use structured local filesystem storage under `data/projects/...`.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Enables rapid development, zero external database setup friction, and easy manual inspection during early demos.
- **Impact**: Application reads and writes structured JSON files for projects, requirements, meetings, and memory.

---

### ADR-013: PostgreSQL + pgvector as Future Database Migration Path
- **Decision**: The long-term production storage target is PostgreSQL with pgvector for relational data and semantic embedding search.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Filesystem storage will not scale to concurrent multi-user production environments with large vector search indexes.
- **Impact**: The data schema and store APIs must be designed to map cleanly to relational tables and vector columns.

---

### ADR-014: Storage Abstraction Layer (`lib/storage/`)
- **Decision**: Domain and agent logic must access storage exclusively via abstract store interfaces (`project-store`, `requirement-store`, `meeting-store`, `memory-store`, `decision-store`).
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Ensures that replacing the filesystem backend with PostgreSQL + pgvector does not require touching meeting, agent, or requirement logic.
- **Impact**: Clean decoupling of persistence from domain workflows.

---

### ADR-015: Next.js as Full-Stack Application Framework
- **Decision**: Next.js is selected for the frontend UI, backend API routes, and agent/business logic orchestration.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Provides a unified TypeScript ecosystem across UI, API endpoints, server-sent events / streaming, and server actions.
- **Impact**: Single codebase for both user interface and backend orchestration.

---

### ADR-016: Real-Time Voice Layer via VerbX / Voice AI Integration
- **Decision**: Voice capabilities will be integrated using the VerbX / Verbex / Voice AI layer based on the final available hackathon integration.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Meets the requirement for low-latency streaming STT, natural TTS, and conversational voice interaction.
- **Impact**: Audio components interface through the voice layer adapter.

---

### ADR-017: Groq as Primary LLM Provider with GPT-OSS 120B Target
- **Decision**: Groq is chosen as the primary LLM provider with GPT-OSS 120B as the primary target model (subject to provider availability/limits).
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Ultra-fast inference speeds on Groq are essential for real-time conversational co-pilot feedback and direct voice intervention.
- **Impact**: LLM client interfaces with Groq's API while respecting token rate limits.

---

### ADR-018: OpenRouter as Fallback LLM Provider
- **Decision**: OpenRouter (using free/open models) is designated as the fallback LLM provider.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Ensures continuous operational reliability during hackathon demos in case of Groq rate limits, model downtime, or quota depletion.
- **Impact**: The LLM abstraction must support seamless failover between Groq and OpenRouter.

---

### ADR-019: Common Voice Agent Shared Between Meeting Modes
- **Decision**: Both Engineer-Assisted and Autonomous meeting modes share the exact same underlying voice agent pipeline.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Avoids duplicating the speech pipeline, STT/TTS adapters, and interruption detection logic across meeting types.
- **Impact**: Mode-specific behavior is governed by configuration, prompts, and permission gates rather than separate voice engines.

---

### ADR-020: 8-Step Action Loop with Barge-In Interruption Handling
- **Decision**: The agent workflow executes the sequence `Observe` $\rightarrow$ `Understand` $\rightarrow$ `Decide` $\rightarrow$ `Check Permission` $\rightarrow$ `Act` $\rightarrow$ `Verify` $\rightarrow$ `Remember` $\rightarrow$ `Follow-up`, and the voice pipeline supports barge-in interruption.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Ensures disciplined agentic behavior without runaway autonomy, and provides natural conversational dynamics where users can interrupt the AI.
- **Impact**: STT must remain active during TTS playback; detecting user speech triggers an immediate audio halt and state transition.

---

### ADR-021: Project Storage as Canonical Source of Truth
- **Decision**: The persistent project storage is the single source of truth; exported artifacts (PDF, DOCX, JSON, CSV) are derived read-only outputs.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Documents become stale and desynchronized. Treating structured storage as canonical ensures consistent versioning and traceability.
- **Impact**: Re-importing or regenerating documents always pulls from the structured data store.

---

### ADR-022: Preservation of Historical Information Without Silent Overwrites
- **Decision**: Historical information (past meetings, superseded requirements, rejected proposals, and previous decisions) must never be silently overwritten or deleted.
- **Date / Status**: 2026-10-18 / Accepted
- **Reason**: Requirement engineering relies on understanding prior trade-offs, discarded ideas, and customer rationale.
- **Impact**: Store implementations append new revisions and transition statuses rather than mutating records in place.

---

### ADR-023: LiveKit Cloud as Real-Time Audio/Video Foundation for Meeting Rooms
- **Decision**: LiveKit Cloud is adopted as the WebRTC audio/video infrastructure for real-time meetings between Customer, Requirement Engineer, and the future SpecPilot AI participant.
- **Date / Status**: 2026-10-19 / Accepted
- **Reason**: LiveKit provides low-latency WebRTC media routing, selective forwarding (SFU), robust client SDKs for React/Next.js, and native compatibility with server-side AI voice agents.
- **Impact**: Server handles token generation via `livekit-server-sdk` without exposing secrets to the client; client uses `@livekit/components-react` and `livekit-client`.

---

### ADR-024: Backend AI Participant with Per-Speaker Realtime Deepgram STT and LiveKit Data Channel Delivery
- **Decision**: SpecPilot joins meetings as a server-side backend WebRTC participant (`specpilot-ai`, role: `SPEC_PILOT`) via `@livekit/rtc-node`. Remote participant audio tracks are subscribed to individually and streamed (16kHz mono linear16 PCM) into isolated `DeepgramSTTProvider` WebSocket sessions. Transcripts are managed by a lightweight `ConversationManager` and broadcast in real time to browsers over LiveKit WebRTC Data Channels (`topic: 'transcript'`).
- **Date / Status**: 2026-10-19 / Accepted
- **Reason**: Server-side WebRTC guarantees zero secret exposure to clients, eliminates browser CPU overhead for STT, and separate audio streams per speaker guarantee 100% accurate speaker attribution without relying on error-prone heuristic diarization. Delivering transcripts via WebRTC data channel provides zero-polling, instant UI updates while remaining completely non-blocking to human media streams.
- **Impact**: Secrets (`DEEPGRAM_API_KEY`, `LIVEKIT_API_SECRET`) exist strictly server-side. Meeting failure handling is resilient: if STT or the AI participant encounters an error, the Customer ↔ Engineer call continues normally without interruption.

---

### ADR-025: Replaceable LLM Provider Abstraction with Groq Primary & OpenRouter Fallback
- **Decision**: An abstract `ILLMProvider` interface decouples the application from specific AI vendors. `GroqProvider` serves as the high-speed primary engine (`llama-3.3-70b-versatile`), wrapped transparently by `FallbackLLMProvider` which automatically fails over to `OpenRouterProvider` (`meta-llama/llama-3.3-70b-instruct`) on rate limits, HTTP 401/429/5xx errors, or network timeouts.
- **Date / Status**: 2026-10-19 / Accepted
- **Reason**: Guarantees system resilience during live meetings. Ultra-fast inference on Groq provides rapid co-pilot intelligence, while automatic OpenRouter fallback prevents failure if quotas or temporary network drops occur.
- **Impact**: All LLM calls remain strictly server-side; API keys are never exposed to browser bundles. Structured outputs are strongly validated via Zod schemas and sanitized against malformed tokens.

---

### ADR-026: Conversation Chunking & Real-Time Requirement Intelligence Pipeline
- **Decision**: Raw speech transcripts are never passed token-by-token or sentence-by-sentence to the LLM. The `ConversationChunker` consumes only finalized speech utterances (`isFinal: true`), discards interims, buffers turn exchanges with adaptive keyword and turn thresholds, and triggers asynchronous analysis in `RequirementIntelligenceEngine`. Extracted candidate requirements, quality defects (ambiguity, missing constraints, non-measurability), and suggested engineer clarifications are broadcast to browsers over LiveKit Data Channel (`topic: 'requirement-intelligence'`) and persisted to filesystem JSON.
- **Date / Status**: 2026-10-19 / Accepted
- **Reason**: Conserves LLM costs and latency, prevents duplicate evaluations of repeated speech, maintains sliding context history, and protects the real-time meeting pipeline from blocking or crashing.
- **Impact**: AI output is strictly advisory (`PROPOSED`, `NEEDS_CLARIFICATION`, `CONFLICT`). The human Requirement Engineer remains the sole approving authority. No requirements are auto-approved into the project baseline.

---

### ADR-027: Server-Side TTS Abstraction with Deepgram Aura Linear16 PCM Synthesis
- **Decision**: An abstract `ITTSProvider` interface decouples text-to-speech synthesis from underlying TTS engines. `DeepgramTTSProvider` synthesizes natural spoken audio via Deepgram Aura REST API (`aura-asteria-en`) returning raw linear16 mono PCM buffers at 16 kHz. Execution is strictly server-side inside the Node.js runtime.
- **Date / Status**: 2026-10-19 / Accepted
- **Reason**: Direct raw linear16 PCM generation matches LiveKit's native `AudioFrame` expectations without requiring external transcoders or ffmpeg binaries. Server-side isolation prevents client audio glitches and keeps `DEEPGRAM_API_KEY` strictly private.
- **Impact**: Synthesized audio can be fed frame-by-frame (10ms chunks, 160 samples at 16 kHz) directly into LiveKit `AudioSource`.

---

### ADR-028: Independent Intervention Decision Engine with Hard Guards
- **Decision**: The LLM Requirement Intelligence engine (Phase 3) is strictly decoupled from the decision to speak. An independent `InterventionDecisionEngine` serves as the sole authority determining `SILENT`, `SUGGEST`, or `SPEAK`. It enforces mandatory hard guards before LLM invocation: (1) Voice intervention enabled toggle (default: OFF); (2) No active speech from human participants; (3) Cooldown timer (45 seconds between spoken interventions); (4) At least one high-severity defect or critical conflict present.
- **Date / Status**: 2026-10-19 / Accepted
- **Reason**: AI assistants that interrupt human dialogue or speak incessantly degrade meeting dynamics. Hard programmatic guards eliminate unnecessary LLM calls and enforce professional meeting etiquette.
- **Impact**: When voice intervention is disabled, or in `SUGGEST` mode, AI outputs remain silent suggestions delivered exclusively to the Requirement Engineer's UI via LiveKit Data Channel (`topic: 'voice-suggestion'`).

---

### ADR-029: Realtime Barge-In Interruption & Self-Listening Prevention
- **Decision**: The `SpecPilotAgent` implements active barge-in: when any human participant speaks, `notifyHumanSpeaking()` triggers an `AbortController` that instantly cancels ongoing speech synthesis, drops pending audio frames, and unpublishes the audio track. To prevent circular echo loops, the agent's STT track subscriber strictly ignores tracks from `identity === 'specpilot-ai'`, and tracks the `isCurrentlySpeaking` state.
- **Date / Status**: 2026-10-19 / Accepted
- **Reason**: When humans speak, AI must yield immediately. Furthermore, an AI must never listen to or transcribe its own spoken output, which would otherwise induce hallucination and cascading echo feedback loops.
- **Impact**: Seamless conversational flow where humans always retain natural conversational priority.

---

### ADR-030: Role-Based Meeting UX and Internal Intelligence Isolation
- **Decision**: SpecPilot enforces strict role separation during live meetings between Customer and Requirement Engineer:
  1. **Customer View**: Dedicated minimal video conference view. Customers see only participant video/audio, clean meeting title, simple non-technical indicator (`● SpecPilot is participating`), and essential controls (`Mic`, `Camera`, `Leave`). Customers never see internal engineering intelligence, live transcripts, defect severities, confidence scores, or AI voice toggles.
  2. **Customer Data Isolation**: The customer browser bundle does not request `/api/meetings/[id]/intelligence` or `/api/meetings/[id]/voice`, and discards internal LiveKit Data Channel topics (`requirement-intelligence`, `voice-suggestion`, `specpilot-voice-state`).
  3. **Engineer View**: Dedicated 3-zone desktop workspace (60–65% video on left, 35–40% `EngineerWorkspacePanel` on right) featuring 4 unified tabs: `Requirements` (structured cards with ID, type, confidence, source, and review dialog), `Issues` (defects with CRITICAL/HIGH/MEDIUM/LOW severities, explanations, and suggested clarifications), `Suggestions` (actionable questions with [Use Question] and [Dismiss] controls), and `Transcript` (role badges, formatted timestamps, and scroll-aware auto-scroll).
  4. **Control Separation**: Bottom control bar explicitly isolates participant controls (`Mic`, `Camera`) from engineer co-pilot controls (`Workspace`, `AI Voice: On/Muted`), keeping the `Leave` action clearly distinguishable.
- **Date / Status**: 2026-10-19 / Accepted
- **Reason**: SpecPilot is an internal co-pilot for the Requirement Engineer. Exposing raw requirement defects, confidence calculations, or internal suggestions to client stakeholders confuses clients and undermines professional meeting dynamics.
- **Impact**: Clean, enterprise-grade separation of concerns across both frontend rendering and network data subscriptions. Zero occurrences of undefined/null fallbacks.

---

### ADR-031: Dedicated SpecPilot AI Participant Tile and Conversational Inquiry Handling in Assisted Mode
- **Decision**: 
  1. **Visual Presence as a 3rd Meeting Participant (`SpecPilotParticipantTile`)**:
     SpecPilot renders as a first-class meeting participant tile in the video grid alongside human participants (Customer and Requirement Engineer) across both Customer and Engineer views, matching existing identity `specpilot-ai` or role `SPEC_PILOT`. It explicitly avoids simulating a webcam feed, instead presenting an elegant AI card with live state indicators (`LISTENING`, `ANALYZING`, `SPEAKING`, `MUTED / VOICE OFF`, `CONNECTING`) and subtle speech-synchronized audio waveform animations.
  2. **Conversational Question Answering in Engineer-Assisted Mode**:
     In Engineer-Assisted meetings, `InterventionDecisionEngine` distinguishes between unsolicited defect interventions and direct conversational questions/inquiries (`isDirectInquiry`: questions about tech stack, requirements, architecture, or directed queries to SpecPilot). When AI Voice is enabled (`voiceInterventionEnabled === true`), questions bypass the high-severity defect gate, allowing SpecPilot to answer user inquiries verbally with a reduced 3-second conversational cooldown. Unsolicited interventions continue to require critical defect thresholds and a 45-second cooldown.
- **Date / Status**: 2026-10-19 / Accepted
- **Reason**: 
  - An invisible AI assistant or text-only dashboard feels alien and disorienting in client video meetings. Rendering a visible AI tile establishes SpecPilot as an active, professional participant.
  - In assisted meetings, engineers and customers expect SpecPilot to answer direct questions when voice is enabled, rather than remaining silent because no requirement defect was detected.
- **Impact**: 
  - Dynamic 1–3 column video layout allocates 60–65% width to the meeting stage with high visual polish.
  - Natural question-and-answer interactions during live requirement elicitation while strictly adhering to barge-in interruptions, human-speaking guards, and engineer mute controls.
