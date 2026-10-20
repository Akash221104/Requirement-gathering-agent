# Requirement Engineering Module

## Purpose
The Requirement Engineering module transforms raw conversation transcripts, stakeholder statements, and change requests into structured, analyzable, editable, and version-controlled requirements with complete end-to-end traceability.

## Responsibilities
- Extract candidate requirements from meeting transcripts and text inputs
- Classify requirements into standard domain categories
- Perform automated quality analysis (detect ambiguity, incompleteness, testability gaps, etc.)
- Formulate targeted clarification questions for vague or incomplete items
- Detect contradictions and conflicts against existing requirement baselines and decisions
- Detect requirement drift, scope expansions, and proposed alterations
- Perform priority and downstream impact analysis for proposed changes
- Maintain immutable version histories (e.g., v1 $\rightarrow$ v2 $\rightarrow$ v3) across all requirements
- Manage the Change Proposal lifecycle for baseline modifications
- Support human-in-the-loop editing, review, approval, and rejection workflows
- Enforce bidirectional traceability linking requirements to source statements, meetings, proposals, and decisions

## Architecture

### Requirement Lifecycle
$$\text{Candidate} \longrightarrow \text{Proposed} \longrightarrow \text{Quality Analysis} \longrightarrow \text{Clarification} \longrightarrow \text{Engineer Review} \longrightarrow \begin{cases} \text{Approve} \\ \text{Edit} \\ \text{Reject} \end{cases} \longrightarrow \text{Approved Baseline} \longrightarrow \text{Future Change} \longrightarrow \text{New Version}$$

### Change Proposal Mechanism
Any modification to an approved requirement baseline must generate a formal Change Proposal:
- Tracks: Previous version, proposed updated requirement, rationale, source meeting/statement ID, impact analysis, and current review status (`Pending`, `Approved`, `Rejected`, `Edited`).
- Official baseline updates only occur upon explicit human Requirement Engineer approval.

### End-to-End Traceability
$$\text{Customer Statement} \longrightarrow \text{Meeting} \longrightarrow \text{Requirement} \longrightarrow \text{Decision} \longrightarrow \text{Change Proposal} \longrightarrow \text{Requirement Version} \longrightarrow \text{Approval}$$

## Inputs
- Utterances and transcripts from the Meeting Management module
- Direct manual inputs and edits from the Requirement Engineer
- Baseline requirements and architectural decisions from Project Knowledge & Memory
- External requirement documents or change request notes

## Processing / Logic
- **Extraction Engine**: Identifies candidate requirements and converts conversational dialogue into standard requirement statements (e.g., EARS or user story format).
- **Classification Engine**: Categorizes requirements into Functional, Non-functional, Business, Technical, Security, Performance, and UI/UX.
- **Quality Analyzer**: Flags quality defects:
  - *Ambiguity*: Vague terminology (e.g., "fast", "user-friendly", "robust").
  - *Incompleteness*: Missing actors, conditions, or exception cases.
  - *Duplication*: Redundant statements overlapping existing requirements.
  - *Missing Constraints*: Omitted security boundaries, volume limits, or compliance standards.
  - *Lack of Testability / Measurability*: Unverifiable assertions.
  - *Contradictions*: Direct conflicts with active baselines or past decisions.
- **Impact & Conflict Analyzer**: Evaluates dependencies, identifies affected components, and quantifies risk.
- **Versioning Engine**: Manages immutable revision trees, diff computation, and changelog generation.

## Outputs
- Structured requirement candidate lists and classified items
- Quality analysis scorecards and recommended clarification prompts
- Conflict and contradiction alerts
- Change Proposals with computed impact assessments
- Versioned requirement baselines
- Full traceability graphs linking statements to approvals

## Data / Storage
Persisted through `lib/storage/requirement-store.ts` in local JSON files:
- Requirements file: `data/projects/{projectId}/requirements.json`
- Changes file: `data/projects/{projectId}/changes.json`
- Schema Entities:
  - **Requirement**: `id` (e.g., `REQ-012`), `title`, `description`, `category`, `status` (`candidate` | `proposed` | `approved` | `deprecated`), `currentVersion`, `priority` (`low` | `medium` | `high` | `critical`), `tags`, `sourceMeetingId`, `sourceUtteranceId`, `createdAt`, `updatedAt`
  - **RequirementVersion**: `versionNumber`, `content`, `rationale`, `author`, `approvedBy`, `timestamp`, `changeProposalId`
  - **ChangeProposal**: `id` (e.g., `CP-005`), `requirementId`, `previousVersion`, `proposedVersion`, `reason`, `impactSummary`, `sourceMeetingId`, `status` (`pending` | `approved` | `rejected` | `edited`), `reviewedBy`, `reviewedAt`

## Agent Behavior
- Evaluates statements continuously without altering active baselines.
- Flags ambiguities early to prompt timely clarification during or right after meetings.
- Proposes structured requirement drafts and change proposals with explicit rationale.
- Never silently mutates, deletes, or overwrites existing requirements or history.

## Human Approval
- The human Requirement Engineer holds exclusive authority to approve, edit, or reject Change Proposals.
- Only approved items transition to the official requirement baseline.

## Dependencies
- Storage abstraction layer (`lib/storage/requirement-store.ts`)
- LLM abstraction (Groq / GPT-OSS 120B with OpenRouter fallback) for semantic extraction, classification, and conflict reasoning
- Project Knowledge & Memory for baselines and decision logs

## Integration With Other Modules
- **Meeting Management**: Consumes live transcripts and surfaces real-time requirement suggestions and conflict warnings.
- **Project Knowledge & Memory**: Reads stored baselines and persists accepted requirements, versions, and change proposals.
- **Calendar & Meeting Planning**: Forwards unclarified requirements and pending questions to trigger agenda generation and follow-up sessions.
- **Agent Action & Workflow**: Emits actions for creating change proposals and updating requirement drafts.

## Important Rules
1. Requirements must never be silently overwritten or deleted; all mutations generate a new version record.
2. Baseline requirements can only change via approved Change Proposals.
3. Every requirement must maintain traceable lineage to its originating meeting, statement, and approving engineer.
4. LLM reasoning is used for semantic extraction, quality checking, and conflict detection; schema validation and version trees are managed deterministically.

## Current Implementation Status
**Phase 3: Requirement Engineering Intelligence & LLM Brain (IMPLEMENTED & VERIFIED)**

- **LLM Abstraction & Multi-Provider Fallback**:
  - `ILLMProvider` interface in `lib/llm/types.ts` defining `generateText()` and `generateStructured()`.
  - Primary provider: `GroqProvider` (`llama-3.3-70b-versatile`).
  - Fallback provider: `OpenRouterProvider` (`meta-llama/llama-3.3-70b-instruct`).
  - Resilient wrapper: `FallbackLLMProvider` automatically routes to OpenRouter on Groq 401/429/5xx errors or timeouts.
  - JSON repair utility: `cleanAndRepairJson` in `lib/llm/json-repair.ts` sanitizes unquoted enum tokens and markdown wrapping.
- **Conversation Chunking Layer**:
  - `ConversationChunker` in `features/requirements/conversation-chunker.ts`.
  - Filters out interim transcripts; processes only finalized speaker utterances (`isFinal: true`).
  - Implements sliding conversation window and debounced turn accumulation.
  - Dedupes transcript segment IDs to prevent duplicate LLM analysis.
- **Requirement Extraction & Classification Engine**:
  - `RequirementIntelligenceEngine` in `features/requirements/services/requirement-intelligence.ts`.
  - Extracts candidate requirements with types: `FUNCTIONAL`, `NON_FUNCTIONAL`, `BUSINESS`, `TECHNICAL`, `SECURITY`, `PERFORMANCE`, `UI_UX`.
  - Preserves source attribution (`sourceSpeakerName`, `sourceSpeakerRole`, `sourceTurnRef`, `confidence`).
  - **Human Authority Rule**: Candidate requirements are strictly proposed (`PROPOSED`, `NEEDS_CLARIFICATION`, `CONFLICT`). The AI never automatically marks them approved.
- **Quality Defect & Ambiguity Analysis**:
  - Detects `AMBIGUITY`, `INCOMPLETENESS`, `MISSING_CONSTRAINT`, `VAGUE_LANGUAGE`, `NOT_MEASURABLE`, `CONFLICT`, and `DUPLICATE`.
  - Formulates actionable, concise clarification questions for the Requirement Engineer.
  - Compares candidate requirements against existing project baselines (`data/projects/{projectId}/requirements.json`) without inventing fake requirements.
- **Filesystem Persistence & Event Broadcasting**:
  - `FileIntelligenceStore` (`lib/storage/intelligence-store.ts`) persists intelligence state under `data/projects/{projectId}/meetings/meeting-{meetingId}-intelligence.json`.
  - `FileRequirementStore` (`lib/storage/requirement-store.ts`) reads and writes project baselines under `data/projects/{projectId}/requirements.json`.
  - Real-time broadcasting to meeting participants via LiveKit WebRTC Data Channel (`topic: 'requirement-intelligence'`).
- **Requirement Engineer Suggestion Panel**:
  - `RequirementIntelligencePanel` (`features/meeting/components/RequirementIntelligencePanel.tsx`) renders live tabs for Candidates, Quality Defects, and Clarification Questions with quick-copy buttons and status badges.

## Future Considerations
- Automated test case generation from approved requirements (BDD / Gherkin syntax)
- Formal verification of requirement consistency and completeness matrices
- Import/export integrations with industry ALM tools (e.g., Jira, Azure DevOps)

