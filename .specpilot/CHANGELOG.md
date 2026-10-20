# SpecPilot: Project Changelog

A chronological log of all meaningful project changes, milestones, and architectural revisions.

---

## Format

Entries follow this structure:
- **Date**: `YYYY-MM-DD`
- **Change**: Description of what was changed, added, or removed
- **Reason**: Rationale behind the modification
- **Affected Module**: Target module(s) or cross-cutting area

---

## Entries

| Date | Change | Reason | Affected Module |
|---|---|---|---|
| 2026-10-18 | Initialized `.specpilot` memory structure and module documentation skeletons | Establish persistent AI agent memory and development protocols | All (Documentation) |
| 2026-10-18 | Populated high-level project memory in `.specpilot/PROJECT_MEMORY.md` | Document agreed 5-module architecture, tech stack, and core principles | All (Architecture) |
| 2026-10-18 | Fully synchronized `.specpilot/` documentation (Agent Rules, 22 Decisions, Current State) and populated all 5 module `MEMORY.md` files | Establish complete architectural ground truth, prevent context loss, and enforce implementation discipline | All (Documentation & Memory) |
| 2026-10-19 | Initialized Next.js 16 (App Router, Turbopack, React Compiler, TypeScript 5, Tailwind CSS v4), shadcn/ui (13 core components), Lucide icons, Zod, Date-fns | Establish verified modern full-stack foundation | Architecture & UI Scaffolding |
| 2026-10-19 | Established internal application scaffolding: feature modules (`features/*`), domain types (`types/*`), and minimal provider abstractions (`lib/storage/`, `lib/llm/`, `lib/voice/`, `lib/config/`, `services/`, `components/shared/`) | Create scalable, modular foundation for module-by-module development without premature business logic | Architecture & Foundation |
| 2026-10-19 | Implemented Meeting Module Phase 1 (LiveKit Video Meeting Foundation): LiveKit Cloud integration, server token API, PreJoinScreen, MeetingRoom UI with ParticipantTile, audio/video toggles, and filesystem meeting persistence | Deliver working two-party video meeting foundation for Customer and Requirement Engineer | Meeting Management |
| 2026-10-19 | Fixed video track rendering in `ParticipantTile` and `MeetingRoom` by integrating LiveKit's reactive `useTracks` and `useIsMuted` hooks to ensure camera video streams attach and render immediately | Resolve video not appearing after joining room | Meeting Management |
| 2026-10-19 | Implemented Meeting Module Phase 2 (SpecPilot AI Participant & Realtime STT Pipeline): Server-side AI participant via `@livekit/rtc-node`, remote audio stream ingestion (16kHz linear16 PCM), replaceable STT abstraction with `DeepgramSTTProvider`, lightweight `ConversationManager`, `LiveTranscriptPanel` UI, `SpecPilotStatusBadge`, WebRTC data channel streaming, and filesystem transcript storage (`meeting-{id}-transcript.json`) | Enable SpecPilot to join LiveKit meeting as silent listener, ingest participant audio, stream to Deepgram STT, and display/persist live transcripts with non-blocking error handling | Meeting Management |
| 2026-10-19 | Implemented Phase 3 (Requirement Engineering Intelligence & LLM Brain): LLM provider abstraction (`ILLMProvider`, `GroqProvider`, `OpenRouterProvider`, `FallbackLLMProvider`), `ConversationChunker` with sliding turn context and interim filtering, `RequirementIntelligenceEngine` extracting candidate requirements, detecting quality defects (ambiguity, vagueness, missing constraints), and synthesizing clarification questions with baseline comparison, LiveKit WebRTC Data Channel broadcasting (`topic: 'requirement-intelligence'`), tabbed `RequirementIntelligencePanel` UI for Requirement Engineer, and filesystem persistence (`meeting-{id}-intelligence.json`) | Deliver real-time requirement intelligence and co-pilot suggestions while strictly preserving human approval authority | Requirement Engineering & Meeting Management |
| 2026-10-19 | Implemented Phase 4 (SpecPilot Voice Intervention & Decision Engine): Server-side TTS provider abstraction (`ITTSProvider`, `DeepgramTTSProvider` with Aura linear16 mono PCM synthesis), independent `InterventionDecisionEngine` with programmatic hard guards (disabled toggle, human speaking, 45s cooldown, high-severity gating), `VoiceInterventionService` with LiveKit `AudioSource` publishing and 10ms frame pacing, active barge-in aborting speech when humans speak, circular self-listening prevention via track filtering, `/api/meetings/[meetingId]/voice` toggle endpoint, `MeetingControlBar` voice toggle button, `MeetingHeader` voice badge, `RequirementIntelligencePanel` silent suggestions list, and speaking pulse overlay | Enable SpecPilot to voice-intervene cleanly on critical requirement ambiguities while preventing spamming and interruptions, with engineer control | Voice AI & Meeting Management |
| 2026-10-19 | Fixed SpecPilot not speaking in Autonomous Mode & WebRTC Audio Track Publishing: (1) Removed the defect-only gate in `InterventionDecisionEngine` for autonomous mode so SpecPilot actively converses and interviews the customer; (2) Fed recent conversation transcript turns into `InterventionContext` so the LLM responds directly to customer speech; (3) Pre-published persistent LiveKit audio track upon room connection and added `audioSource.waitForPlayout()` to eliminate WebRTC renegotiation delays and dropped audio frames; (4) Reduced conversational turn cooldown from 45s to 4s in autonomous mode; (5) Enabled voice intervention by default for autonomous discovery sessions | Resolve SpecPilot staying silent when customer greets or describes app requirements in autonomous meetings | Voice AI & Meeting Management |
| 2026-10-19 | Overhauled Voice Pipeline Performance & Audio Quality: (1) Added HTTP 401 fail-fast circuit breaker in `FallbackLLMProvider` so invalid Groq keys bypass immediately to OpenRouter saving 2–4s per turn; (2) Upgraded Deepgram TTS to 48,000 Hz linear16 PCM and aligned LiveKit `AudioSource` to native 48,000 Hz WebRTC Opus rate; (3) Removed artificial 400ms sleep throttling loop in `VoiceInterventionService` to eliminate audio stutter and buffer underruns; (4) Humanized conversational prompts for warm, natural phrasing | Resolve audio stutter/buffer noise and improve latency and speech naturalness | Voice AI & Audio Quality |
| 2026-10-19 | Overhauled Meeting UX with Complete Role Separation (ADR-030): (1) Implemented clean, minimal Customer View showing only participant video, simple non-technical indicator (`● SpecPilot is participating`), and essential controls (`Mic`, `Camera`, `Leave`); (2) Isolated internal intelligence data from Customer clients (no endpoint polling, no Data Channel subscription to internal topics); (3) Built unified 3-zone desktop Engineer Workspace (`EngineerWorkspacePanel`) with 4 tabs: `Requirements` (cards with ID, category, confidence, and review modal), `Issues` (CRITICAL/HIGH/MEDIUM/LOW defects with explanations), `Suggestions` (actionable questions with [Use Question] and [Dismiss]), and `Transcript` (role badges and scroll-aware auto-scrolling); (4) Eliminated "undefined" string glitches with robust fallbacks across meeting headers, lists, and pre-join screens | Deliver distinct, production-ready Customer vs. Engineer meeting experiences without exposing internal engineering telemetry | Meeting Management & UI/UX |
| 2026-10-19 | Implemented Phase 4.5 (SpecPilot AI Participant Tile & Meeting Polish - ADR-031): (1) Created dedicated `SpecPilotParticipantTile` rendering SpecPilot as a visual 3rd participant in the video stage alongside human participants; (2) Synchronized visual states (`LISTENING`, `ANALYZING`, `SPEAKING`, `MUTED / VOICE OFF`) with real-time waveform bar animations; (3) Enabled direct conversational inquiry answering in Assisted Mode when AI voice is ON (`isDirectInquiry`), unlocking verbal co-pilot Q&A without requiring requirement defects; (4) Added fast 800ms debounce on inquiries in `ConversationChunker`; (5) Added HTTP 404 fail-fast bypass in `FallbackLLMProvider` | Transform prototype meeting UI into enterprise-grade 3-participant requirement engineering co-pilot product | UI/UX & Voice AI |







