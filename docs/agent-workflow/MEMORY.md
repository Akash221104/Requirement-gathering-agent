# Agent Action & Workflow Module

## Purpose
The Agent Action & Workflow module orchestrates SpecPilot's decision-making and task execution. It transitions the system from a passive conversational tool into an active, disciplined agent capable of evaluating project states, reasoning about objectives, respecting permission boundaries, and executing governed actions across all system modules.

## Responsibilities
- Execute the 8-step agentic decision loop across meetings and background tasks
- Formulate concrete, goal-oriented action proposals based on real-time observations
- Enforce strict permission gates distinguishing autonomous low-risk actions from approval-gated high-risk actions
- Dispatch permitted actions to target modules (requirements, meetings, calendar, memory)
- Verify action outcomes, confirm execution success, and handle failures gracefully
- Commit verified results to persistent memory and trigger necessary follow-up workflows
- Coordinate live conversational actions during autonomous meetings (probing questions, topic transitions, meeting wrap-up)

## Architecture

### Agentic Action Loop
$$\text{Observe} \longrightarrow \text{Understand} \longrightarrow \text{Decide} \longrightarrow \text{Check Permission} \longrightarrow \text{Act} \longrightarrow \text{Verify} \longrightarrow \text{Remember} \longrightarrow \text{Follow-up}$$

1. **Observe**: Ingest real-time conversational utterances, meeting state changes, or background triggers.
2. **Understand**: Synthesize semantic meaning, cross-reference active baselines, and evaluate goal alignment.
3. **Decide**: Formulate a candidate action (e.g., ask clarification, propose requirement edit, schedule session).
4. **Check Permission**: Evaluate action risk level against permission policies. Halt and request human approval if high-risk.
5. **Act**: Execute the approved action via target module APIs.
6. **Verify**: Inspect execution return codes and state changes to ensure intended outcomes were achieved.
7. **Remember**: Record action details, rationale, and results into Project Knowledge & Memory.
8. **Follow-up**: Evaluate if the completed action spawns secondary tasks (e.g., scheduling a follow-up meeting).

## Inputs
- Conversational utterances and speaker events from Meeting Management
- Analysis results, conflict detections, and quality flags from Requirement Engineering
- Open issues, pending questions, and stored baselines from Project Knowledge & Memory
- Explicit human engineer directives, approvals, and rejections

## Processing / Logic
- **Action Classifier & Risk Evaluator**: Categorizes actions into Low-Risk (autonomous) vs. High-Risk (approval-gated).
- **Permission Policy Engine**: Intercepts high-risk actions and routes them to the human engineer's approval queue.
- **Action Dispatcher**: Translates abstract decisions into concrete module operations (e.g., calling `requirement-store.createChangeProposal()`).
- **Autonomous Meeting Driver**: Manages live conversation tactics during autonomous meetings:
  - Asks structured clarification questions
  - Probes vague answers with targeted follow-ups
  - Advances to the next agenda item when current topic objectives are satisfied
  - Concludes the meeting gracefully when all agenda items are completed

## Outputs
- Permitted action executions dispatched to target modules
- Interactive approval prompts submitted to the Requirement Engineer
- Real-time vocal questions or topic transitions during meetings
- Verification logs and error handling diagnostics
- Structured action records committed to persistent memory

## Data / Storage
Action logs and permission queues are persisted in project memory:
- Integrated with `data/projects/{projectId}/issues.json` and `data/projects/{projectId}/changes.json`
- Schema Entities:
  - `actionId`, `actionType`
  - `status` (`pending_permission` | `approved` | `executed` | `failed` | `rejected`)
  - `targetModule`, `payload`
  - `requestedBy` (`agent` | `engineer`), `approvedBy`
  - `executionResult`, `timestamp`

## Agent Behavior

### Autonomous / Low-Risk Actions (Executed without prior confirmation)
- Updating low-risk memory entries and domain fact caches
- Tracking newly identified ambiguities and unverified statements as open issues
- Performing requirement quality analysis and computing conflict scores
- Generating non-intrusive textual suggestions for the engineer interface
- Synthesizing agenda drafts and scheduling recommendations

### High-Risk Actions (Strictly require human approval)
- Committing modifications or deletions to official requirement baselines
- Ratifying significant architectural or scope decisions
- Booking calendar events and dispatching external customer invites
- Sending official customer-facing written communications or formal reports

### Live Meeting Actions
- During live autonomous sessions, the agent directly asks clarification questions, follows up on answers, moves to next agenda topics, and finishes the meeting when objectives are complete.

## Human Approval
- Human approval is an inviolable architectural gate. High-risk actions cannot proceed to execution without explicit authorization from the human Requirement Engineer.
- The engineer can inspect proposed action details, edit action parameters, approve execution, or reject the action outright.

## Dependencies
- Storage abstraction layer (`lib/storage/`)
- LLM reasoning abstraction (Groq / GPT-OSS 120B with OpenRouter fallback)
- Meeting Management and Requirement Engineering module dispatchers

## Integration With Other Modules
- **Meeting Management**: Coordinates live speaking actions and receives conversational trigger events.
- **Requirement Engineering**: Dispatches Change Proposals and requirement draft creation actions.
- **Calendar & Meeting Planning**: Triggers follow-up planning and forwards approved meeting bookings to calendar APIs.
- **Project Knowledge & Memory**: Reads current state to ground decisions and commits executed action records.

## Important Rules
1. Never bypass the permission gate; any action altering requirement baselines or external commitments requires human confirmation.
2. Every action must execute within the 8-step loop to guarantee verification and persistent memory recording.
3. The agent must be proactive and action-oriented, proposing concrete next steps rather than acting as a passive question-answer tool.
4. Actions must be idempotent or cleanly rollbackable if execution verification fails.

## Current Implementation Status
**Phase 4 Implemented Foundations (Voice Intervention Decision Engine & Governed Action Active)**
- Real-time observation (`Observe`), LLM semantic reasoning (`Understand`), quality defect detection (`Decide`), and suggestions to Requirement Engineer (`Act` / `Remember`) are active in `features/requirements/services/requirement-intelligence.ts`.
- Independent `InterventionDecisionEngine` evaluates candidate actions and determines `SILENT`, `SUGGEST`, or `SPEAK` based on strict programmatic hard guards (voice intervention toggle, human speaking status, 45s cooldown, high-severity gating).
- Barge-in cancellation immediately halts speech when a human participant talks, preserving human priority.
- Strict permission gate enforced: AI candidate requirements are strictly advisory (`PROPOSED`, `NEEDS_CLARIFICATION`, `CONFLICT`). High-risk baseline approval remains solely under human engineer authority.
- Voice intervention defaults to OFF and remains strictly toggleable by the human engineer at any time via UI and API.

## Future Considerations
- Long-running asynchronous workflow workers for batch requirement quality audits
- Webhook triggers for CI/CD integration and issue tracker synchronization
- Multi-agent collaboration with specialized subagents (e.g., Security Reviewer Agent, Architecture Checker Agent)

