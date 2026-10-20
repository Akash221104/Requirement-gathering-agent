# SpecPilot: Project Memory

This file serves as the permanent, high-level project memory for **SpecPilot**. It defines the agreed project purpose, architectural design, module responsibilities, technology stack, storage layout, and governing product principles.

> [!IMPORTANT]
> **Architecture vs. Implementation Notice**: This document details the agreed project design and target architecture (**DESIGNED** / **PLANNED**). It does **not** claim that these features are currently implemented in code. Implementation status is tracked separately in `.specpilot/CURRENT_STATE.md` and verified exclusively against the codebase.

---

## 1. Project Purpose

**SpecPilot** is an AI-powered autonomous requirement engineering co-pilot and agent.

It assists the Requirement Engineer (RE) during customer requirement meetings and can autonomously conduct routine follow-up requirement meetings. Throughout all workflows, the human Requirement Engineer remains the final authority and decision-maker for important requirements, architectural decisions, and baseline changes.

SpecPilot is **not** merely a meeting recorder or passive summarizer. It actively:
- Understands conversations in real time
- Extracts structured requirements
- Detects ambiguity and missing information
- Detects conflicts with prior requirements and decisions
- Detects requirement drift and changes
- Asks clarification questions
- Suggests targeted questions to the engineer
- Answers engineer queries during meetings
- Maintains cross-meeting project memory
- Compares ongoing discussions with past decisions
- Proposes structured requirement updates
- Performs impact analysis
- Plans and schedules follow-up meetings
- Conducts routine follow-up meetings autonomously
- Executes controlled, permission-gated agent actions
- Maintains full requirement history and traceability

---

## 2. Problem Being Solved

- **Inefficient Requirement Elicitation**: Traditional requirement meetings suffer from heavy manual note-taking overhead, missed nuances, incomplete constraints, and delayed documentation.
- **Context Loss Across Meetings**: Project knowledge frequently fragments between meetings, leading to forgotten decisions, repeated discussions, and lost rationale.
- **Uncaptured Drift and Hidden Conflicts**: Subtle client changes, scope creep, and contradictions with earlier requirements often go unnoticed until late in development.
- **Follow-up Overhead**: Requirement Engineers spend valuable time scheduling and running routine clarification sessions that can be standardized and executed autonomously.

---

## 3. Core Concept

SpecPilot is designed as an action-oriented requirement engineering co-pilot with dual operational modes:
1. **Engineer-Assisted Mode**: Active collaboration during primary discovery sessions where the human engineer leads and SpecPilot provides live assistance, analysis, and intervention.
2. **Autonomous Meeting Mode**: Autonomous execution of routine follow-up meetings where SpecPilot conducts the session directly with the customer, subject to subsequent human engineer review and approval.

Underpinning both modes is a persistent memory system, a shared real-time voice pipeline with interruption handling, an action-driven workflow loop, and strict human-in-the-loop governance.

---

## 4. Overall Architecture

### 4.1 Voice Pipeline & Barge-In
A single, shared voice agent serves both meeting modes:

$$\text{Speech} \longrightarrow \text{Voice Layer} \longrightarrow \text{Streaming STT} \longrightarrow \text{Conversation Manager} \longrightarrow \text{Agent Brain} \longrightarrow \text{Requirement/Decision Engine} \longrightarrow \text{Response} \longrightarrow \text{Streaming TTS} \longrightarrow \text{Voice Layer}$$

- **Voice Pipeline Features**: Realtime audio, streaming STT, natural low-latency TTS, context-aware responses, speaker awareness, and barge-in / interruption handling.
- **Barge-In Flow**:
  $$\text{Agent speaking} \longrightarrow \text{User starts speaking} \longrightarrow \text{Detect interruption} \longrightarrow \text{Halt TTS playback} \longrightarrow \text{Listen} \longrightarrow \text{Process new input} \longrightarrow \text{Respond}$$

### 4.2 Agent Action & Workflow Loop
The agent is action-oriented and executes a disciplined agentic loop:

$$\text{Observe} \longrightarrow \text{Understand} \longrightarrow \text{Decide} \longrightarrow \text{Check Permission} \longrightarrow \text{Act} \longrightarrow \text{Verify} \longrightarrow \text{Remember} \longrightarrow \text{Follow-up}$$

- **Permission Gate**: The agent evaluates permissions before taking any action. Low-risk actions execute autonomously; critical actions require explicit human approval.

### 4.3 Storage & Retrieval Architecture
- **Context-Aware Retrieval**: The system dynamically retrieves relevant context using structured queries and semantic matching instead of sending the entire project history to the LLM.
- **Source of Truth**: Project storage is the single canonical source of truth; exported documents (PDF, DOCX, JSON, CSV) are derived outputs, not primary sources of truth.
- **Storage Abstraction**: Storage operations are decoupled from domain logic via dedicated stores (`lib/storage/`), enabling local filesystem storage to be replaced later by PostgreSQL + pgvector without refactoring application logic.

---

## 5. Technology Stack

- **Application Framework**: Next.js (frontend, backend API routes, agent & business logic, requirement management, workflow logic)
- **Voice AI Layer**: VerbX / Verbex / Voice AI layer (based on final available integration)
- **Primary LLM Provider**: Groq
- **Primary Target LLM Model**: GPT-OSS 120B (subject to provider availability and limits)
- **Fallback LLM Provider**: OpenRouter (free/open models)
- **LLM Abstraction**: Application incorporates an LLM provider abstraction to decouple provider specifics from prompt/workflow logic.
- **Initial Hackathon / Demo Storage**: Local filesystem (`data/projects/...`)
- **Future Migration Target**: PostgreSQL + pgvector

---

## 6. Major Modules

The system is decomposed into five distinct logical modules:

### 1. Meeting Management
Manages live audio sessions, transcripts, and interaction across two primary operational modes:
- **Engineer-Assisted Meeting**:
  - Participants: Customer + Requirement Engineer + SpecPilot.
  - Leadership: Requirement Engineer leads the meeting.
  - SpecPilot Role: Continuously analyzes conversation, extracts candidate requirements, detects ambiguity/missing information/conflicts/changes, answers engineer inquiries, suggests questions, maintains context, and intervenes when necessary.
  - Agent Speaking Modes:
    - `SILENT`: Listens and analyzes in the background without audio output.
    - `SUGGEST`: Emits textual suggestions/cues to the engineer UI; engineer decides whether to ask the customer.
    - `SPEAK / DIRECT INTERVENTION`: Speaks directly into the meeting when high-confidence issues demand immediate clarification (e.g., contradiction with approved requirements, major security/privacy ambiguity, significant customer contradiction).
  - Engineer Controls: Enable/disable agent voice, enable/disable suggestions, select intervention mode, mute agent, ask SpecPilot questions, view live requirements/issues, end meeting, review and approve results.
- **Autonomous Meeting**:
  - Participants: Customer + SpecPilot.
  - Leadership: SpecPilot acts as host and conducts routine follow-up sessions.
  - SpecPilot Workflow: Loads approved requirements, previous meetings, pending questions, recent changes, decisions, and project context. Opens meeting, explains agenda, asks structured follow-up questions, analyzes answers, detects changes/conflicts, records decisions, advances agenda, determines goal completion, and generates proposed requirement updates with impact analysis.
  - Post-Meeting Rule: Autonomous meetings **never** automatically alter the official baseline; the Requirement Engineer reviews and approves all outcomes afterward.

### 2. Requirement Engineering
Transforms discussions and changes into structured, version-controlled requirements:
- **Lifecycle**: Candidate $\rightarrow$ Proposed $\rightarrow$ Quality Analysis $\rightarrow$ Clarification $\rightarrow$ Engineer Review $\rightarrow$ Approve / Edit / Reject $\rightarrow$ Approved Baseline $\rightarrow$ Future Change $\rightarrow$ New Version.
- **Responsibilities**: Requirement extraction, classification, quality analysis (ambiguity, incompleteness, duplication, missing constraints, lack of testability/measurability, contradictions), clarification generation, conflict detection, change detection, priority analysis, impact analysis, versioning, editing, approval, and traceability.
- **Categories**: Functional, Non-functional, Business, Technical, Security, Performance, UI/UX.
- **Change Proposals**: Significant changes trigger a Change Proposal (containing previous requirement, proposed requirement, reason, source meeting, impact, status: Pending/Approved/Rejected/Edited).
- **Immutability**: Requirements are never silently overwritten; revision history (e.g., REQ-012 v1 $\rightarrow$ v2 $\rightarrow$ v3) is immutably preserved.

### 3. Calendar & Meeting Planning
Translates unresolved requirement issues into planned follow-ups:
- **Flow**: Project/Meeting Status $\rightarrow$ Pending Items Analysis $\rightarrow$ Follow-up Needed? $\rightarrow$ Generate Agenda $\rightarrow$ Check Availability $\rightarrow$ Suggest Time Slots $\rightarrow$ Human Approval $\rightarrow$ Schedule Event $\rightarrow$ Calendar/Meeting Link $\rightarrow$ Meeting History.
- **Responsibilities**: Follow-up detection, meeting recommendations, automated agenda generation, availability checking, time-slot suggestions, human approval gate, calendar event creation, meeting linking, reminders, meeting history tracking.
- **Operating Rule**: $\text{AI} = \text{detect} + \text{plan} + \text{suggest}$; $\text{Human} = \text{approve}$; $\text{Calendar} = \text{execute}$.

### 4. Project Knowledge & Memory
Maintains cross-meeting persistent intelligence without raw context dumping:
- **Stored Entities**: Meeting transcripts, summaries, requirements, requirement versions, architectural decisions with reasons, issues, conflicts, pending questions, requirement changes, project facts, constraints, and action items.
- **Architecture**: Structured Memory + Semantic Memory managed via a Memory Manager, delivering targeted retrieval to the Agent Brain.
- **Data Integrity**: Preserves source meeting, timestamp, confidence, and approval status for all memory items.

### 5. Agent Action & Workflow
Translates real-time analysis into governed, purposeful actions:
- **Loop**: Observe $\rightarrow$ Understand $\rightarrow$ Decide $\rightarrow$ Check Permission $\rightarrow$ Act $\rightarrow$ Verify $\rightarrow$ Remember $\rightarrow$ Follow-up.
- **Permitted Autonomous / Low-Risk Actions**: Low-risk memory updates, issue tracking, requirement analysis, generating suggestions, agenda drafts.
- **Approval-Gated High-Risk Actions**: Modifying requirement baselines, committing major decisions, scheduling calendar events, communicating externally with customers.
- **Live Meeting Execution**: Agent can ask clarification, pose follow-up questions, advance agenda topics, and conclude sessions when objectives are met.

---

## 7. Storage Architecture

### 7.1 Initial Filesystem Layout
Initial hackathon storage resides in the local filesystem under `data/`:

```
data/
└── projects/
    └── project-001/
        ├── project.json          # Project metadata and configuration
        ├── requirements.json     # Active requirements and full version trees
        ├── meetings/             # Meeting sessions, audio metadata, transcripts
        │   ├── meeting-001.json
        │   └── meeting-002.json
        ├── decisions.json        # Logged architectural and product decisions
        ├── issues.json           # Tracked ambiguities, gaps, and conflicts
        ├── changes.json          # Change Proposals and revision histories
        └── memory.json           # Structured facts, entities, and semantic indices
```

### 7.2 Storage Abstraction Layer
Domain logic must not interact directly with raw filesystem calls. Instead, all operations go through abstract store interfaces located in `lib/storage/`:

```
lib/storage/
├── project-store.ts        # Project configuration & settings operations
├── requirement-store.ts    # Requirement versions, baselines, & proposals
├── meeting-store.ts        # Transcripts, summaries, & participant metadata
├── memory-store.ts         # Facts, issues, & semantic memory retrieval
└── decision-store.ts       # Architectural & product decision logs
```

This abstraction ensures that swapping the filesystem backend for PostgreSQL + pgvector requires zero modification to meeting, agent, or requirement logic.

---

## 8. Traceability Architecture

SpecPilot enforces end-to-end requirement traceability across the entire product lifecycle:

$$\text{Customer Statement} \longrightarrow \text{Meeting} \longrightarrow \text{Requirement} \longrightarrow \text{Decision} \longrightarrow \text{Change Proposal} \longrightarrow \text{Requirement Version} \longrightarrow \text{Approval}$$

The system can definitively answer:
- Where did this requirement come from?
- Which meeting and timestamp introduced or revised it?
- Why did it change?
- What was the exact previous version?
- Who reviewed and approved it?

---

## 9. Core Principles

SpecPilot's architecture, development, and operation are governed by fourteen fundamental principles:

1. **AI assists; humans approve important decisions**: The Requirement Engineer maintains ultimate decision-making authority.
2. **Preserve requirement and decision history**: Every iteration, change, and decision maintains an immutable audit trail.
3. **Maintain context across meetings**: Knowledge persists seamlessly from session to session, preventing project amnesia.
4. **Use LLM reasoning where appropriate**: Reserve LLM calls for semantic synthesis, extraction, clarification, and reasoning.
5. **Do not unnecessarily use LLMs for deterministic tasks**: Use deterministic algorithms and code for schema validation, ID generation, storage, and state machines.
6. **Agent should be action-oriented**: The system proactively plans, proposes, identifies gaps, and executes workflows rather than acting as a passive chatbot.
7. **Important actions require permission**: High-impact actions (baseline changes, external communications, final scheduling) must pass through human approval gates.
8. **Requirement changes must be traceable**: Every requirement must link directly to source statements, meetings, proposals, and approvals.
9. **Never silently rewrite history**: Modifications create new versions or revision records; historical states remain permanently accessible.
10. **Storage is the source of truth**: Internal persistent storage represents canonical project reality.
11. **Keep architecture modular**: The five core modules must maintain clear separation of concerns.
12. **Keep storage replaceable**: Abstract storage operations to facilitate seamless database migration.
13. **Avoid premature production complexity**: Focus the hackathon phase on clean abstractions, robust workflows, and core functionality.
14. **Documentation must reflect actual implementation status**: Never claim designed or planned features are implemented until verified in code.

---

## 10. Human-in-the-Loop Principles

- **Co-Pilot, Not Replacement**: In assisted sessions, SpecPilot advises and accelerates the engineer, who remains the primary meeting facilitator.
- **Post-Autonomous Review**: In autonomous follow-up sessions, all requirement updates, newly identified conflicts, and draft decisions are queued as proposals for subsequent engineer review before baseline commitment.
- **Explicit Permission Gates**: Automated agent actions that affect external state, schedule meetings, or alter requirement statuses require explicit human confirmation.

---

## 11. Important Project Terminology

- **SpecPilot**: The overall autonomous requirement engineering co-pilot and agent system.
- **Requirement Engineer (RE)**: The primary human operator and final decision-maker.
- **Customer / Stakeholder**: The external party providing domain needs and requirements.
- **Engineer-Assisted Meeting**: A three-way meeting (Customer + RE + SpecPilot) led by the human engineer.
- **Autonomous Meeting**: A two-way routine follow-up meeting (Customer + SpecPilot) conducted autonomously by the agent.
- **Speaking Modes**:
  - `SILENT`: Agent observes and records without audio output.
  - `SUGGEST`: Agent provides non-intrusive text suggestions to the RE.
  - `SPEAK / DIRECT INTERVENTION`: Agent speaks directly into the audio conference.
- **Requirement Baseline**: The officially accepted, approved state of project requirements.
- **Change Proposal**: A drafted modification, addition, or deletion to requirements awaiting RE approval.
- **Action Loop**: The 8-step sequence (`Observe` $\rightarrow$ `Understand` $\rightarrow$ `Decide` $\rightarrow$ `Check Permission` $\rightarrow$ `Act` $\rightarrow$ `Verify` $\rightarrow$ `Remember` $\rightarrow$ `Follow-up`) governing agent operations.
- **Barge-In**: The capability of the voice agent to detect user speech while speaking, immediately halt audio playback, and transition to listening.
