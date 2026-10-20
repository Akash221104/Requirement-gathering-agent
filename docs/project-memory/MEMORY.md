# Project Knowledge & Memory Module

## Purpose
The Project Knowledge & Memory module serves as the central, persistent intelligence repository for SpecPilot. It preserves structured context, historical rationale, architectural decisions, and domain knowledge across all meetings, ensuring the agent operates with continuous project awareness without suffering from memory loss or context window overflow.

## Responsibilities
- Persist meeting transcripts, structured summaries, and conversation excerpts
- Store and manage versioned requirements and change proposals
- Maintain the official registry of architectural, product, and scope decisions
- Track open issues, ambiguities, unresolved questions, and requirement conflicts
- Record verified project facts, technical constraints, domain entities, and client preferences
- Maintain action items, owner assignments, and completion statuses
- Implement selective, context-aware retrieval to deliver relevant memories to the LLM
- Preserve strict provenance for every memory entity (source meeting, speaker, timestamp, confidence score)
- Prevent silent overwrites or loss of historical project data
- Serve as the application's single canonical source of truth

## Architecture

### Memory Flow & Retrieval Pipeline
$$\begin{matrix} \text{Meetings} \\ \text{Requirements} \\ \text{Decisions} \\ \text{Issues / Facts} \end{matrix} \longrightarrow \text{Memory Manager} \longrightarrow \begin{cases} \text{Structured Memory (JSON / Relational)} \\ \text{Semantic Memory (Embeddings / Vector)} \end{cases} \longrightarrow \text{Relevant Retrieval} \longrightarrow \text{Agent Context}$$

- **Targeted Retrieval Policy**: The system strictly avoids sending entire raw project transcripts to the LLM. Instead, the Memory Manager synthesizes targeted prompts combining relevant active baselines, recent decisions, open issues, and semantically matched snippets.
- **Source of Truth Rule**: The persistent storage layer is canonical reality; exported documents (PDF, DOCX, JSON, CSV) are derived read-only outputs.

## Inputs
- Meeting transcripts, summaries, and action items from Meeting Management
- Approved requirements, version trees, and change proposals from Requirement Engineering
- Documented decisions and rationale from the Requirement Engineer
- Tracked ambiguities and conflict reports from all system modules

## Processing / Logic
- **Entity Indexing**: Normalizes incoming facts, decisions, and requirements into standardized JSON records.
- **Provenance Tagging**: Attaches source metadata (`sourceMeetingId`, `timestamp`, `authorRole`, `confidenceScore`) to every stored fact.
- **Relevance Retrieval Engine**: Combines keyword filtering (by module, requirement ID, topic) and semantic similarity scoring to construct concise, high-signal context windows for agent prompts.
- **Immutability Enforcement**: Appends new records and revision nodes rather than performing destructive in-place updates.

## Outputs
- Precision-curated context slices for LLM prompts in live meetings and background tasks
- Historical audit trails and provenance reports for requirements and decisions
- Global project knowledge summaries and state reports
- Search results for domain facts, past discussions, and stakeholder positions

## Data / Storage
Stored on the local filesystem under `data/projects/{projectId}/` accessed via abstract stores in `lib/storage/`:
- `data/projects/{projectId}/project.json`: Project metadata, configuration, participant profiles
- `data/projects/{projectId}/requirements.json`: Active requirement baselines and full version histories
- `data/projects/{projectId}/meetings/`: Directory of individual meeting transcripts, audio metadata, and summaries
- `data/projects/{projectId}/decisions.json`: Formal architectural, scope, and technical decision records
- `data/projects/{projectId}/issues.json`: Tracked ambiguities, gaps, contradictions, and open questions
- `data/projects/{projectId}/changes.json`: Logged Change Proposals and status transitions
- `data/projects/{projectId}/memory.json`: Structured domain facts, constraints, and semantic cache

### Storage Abstraction Interfaces (`lib/storage/`)
- `project-store.ts`, `requirement-store.ts`, `meeting-store.ts`, `memory-store.ts`, `decision-store.ts`

## Agent Behavior
- Queries the Memory Manager before formulating questions, answering queries, or evaluating requirement changes.
- Cross-references ongoing discussions against previously recorded decisions to catch contradictions in real time.
- Preserves context across meetings so the agent can reference previous agreements seamlessly.
- Never mutates historical records without creating an explicit revision or transition entry.

## Human Approval
- Important decisions, requirement baselines, and permanent domain facts require human engineer validation.
- Low-risk factual observations and automated conversation indexing proceed autonomously.

## Dependencies
- Storage abstraction layer (`lib/storage/memory-store.ts`, `lib/storage/decision-store.ts`)
- Primary LLM provider (Groq / GPT-OSS 120B with OpenRouter fallback)
- Semantic embedding utilities (planned for vector retrieval)

## Integration With Other Modules
- **Meeting Management**: Supplies pre-meeting context briefings and receives post-meeting transcripts, summaries, and action items.
- **Requirement Engineering**: Supplies active baselines and stores versioned requirements and change proposals.
- **Calendar & Meeting Planning**: Provides unresolved questions and open issues to drive agenda generation.
- **Agent Action & Workflow**: Supplies historical state and receives verified action results to update persistent memory.

## Important Rules
1. Project storage is the single source of truth; generated document exports are merely read-only outputs.
2. Never dump the entire project history into the LLM context window; always retrieve targeted, relevant context.
3. Every memory entity must preserve provenance: source meeting, author/speaker, timestamp, and confidence score.
4. Historical information and past decisions must never be silently overwritten or erased.
5. Keep storage operations decoupled via abstract store interfaces to ensure seamless future migration to PostgreSQL + pgvector.

## Current Implementation Status
**Planned / Designed / Not Yet Implemented**
- The memory schema, file layouts, store interfaces, and retrieval architecture are fully designed.
- No code implementation, filesystem stores, or retrieval engines exist in the repository.

## Future Considerations
- Migration to PostgreSQL with `pgvector` for scalable relational storage and high-dimensional semantic search
- Hybrid search combining BM25 keyword matching with dense vector embeddings
- Automated knowledge graph construction linking domain concepts and stakeholder constraints
