# Calendar & Meeting Planning Module

## Purpose
The Calendar & Meeting Planning module analyzes unresolved requirements, open ambiguities, and project milestones to determine when follow-up meetings are required, automatically generating tailored agendas, proposing optimal time slots, and scheduling approved sessions.

## Responsibilities
- Detect the need for follow-up sessions based on unresolved ambiguities and open questions
- Formulate meeting recommendations with concrete objectives
- Automatically generate structured, itemized meeting agendas from pending items
- Check stakeholder and engineer availability
- Suggest candidate time slots based on constraints and scheduling preferences
- Enforce human approval gates before committing calendar events
- Create calendar events and generate meeting connection links
- Link scheduled meetings to originating meetings and specific requirement IDs
- Send automated reminders and preparatory briefings
- Maintain comprehensive meeting scheduling history

## Architecture

### Planning Flow
$$\text{Project / Meeting Status} \longrightarrow \text{Pending Items Analysis} \longrightarrow \text{Follow-up Needed?} \longrightarrow \text{Generate Agenda} \longrightarrow \text{Check Availability} \longrightarrow \text{Suggest Time Slots} \longrightarrow \text{Human Approval} \longrightarrow \text{Schedule Event} \longrightarrow \text{Calendar / Meeting Link} \longrightarrow \text{Meeting History}$$

### Operating Division of Responsibility
- $\text{AI} = \text{detect} + \text{plan} + \text{suggest}$
- $\text{Human} = \text{approve}$
- $\text{Calendar} = \text{execute}$

## Inputs
- Unresolved issues, questions, and conflicting requirements from Requirement Engineering
- Post-meeting summaries and action items from Meeting Management
- Stakeholder availability calendars and time preferences
- Requirement engineer scheduling guidelines

## Processing / Logic
- **Follow-Up Analyzer**: Scans active issues, ambiguous requirements, and customer action items to calculate an urgency score for follow-up sessions.
- **Agenda Generator**: Synthesizes open items into prioritized, time-boxed agenda topics with specific clarification goals.
- **Availability & Slot Finder**: Queries available windows and identifies non-conflicting time slots for all required participants.
- **Approval Dispatcher**: Submits proposed meeting details (agenda, duration, suggested times, mode: Assisted vs. Autonomous) to the Requirement Engineer for confirmation.
- **Event Dispatcher**: Calls calendar integration APIs to book confirmed sessions, generate meeting links, and attach relevant requirement context.

## Outputs
- Meeting recommendation alerts
- Structured, time-boxed agenda drafts
- Candidate scheduling options (time-slot proposals)
- Confirmed calendar events with integrated conference links
- Notification alerts and reminders sent to participants
- Updated meeting scheduling history records

## Data / Storage
Managed via `lib/storage/` in project JSON files:
- Integrated with `data/projects/{projectId}/meetings/meeting-{meetingId}.json`
- Tracking entities include:
  - `scheduledEventId`, `linkedMeetingIds` (prior meeting references)
  - `status` (`proposed` | `pending_approval` | `scheduled` | `cancelled` | `completed`)
  - `proposedSlots` (list of candidate start/end times)
  - `confirmedSlot` (final start/end time)
  - `agenda` (items, allocated durations, target requirement IDs)
  - `participantAvailability` (status per attendee)
  - `calendarLink`, `conferenceLink`

## Agent Behavior
- Evaluates meeting outcomes automatically after sessions conclude.
- Drafts follow-up proposals proactively when critical questions remain unanswered.
- Selects the recommended meeting mode (suggests Autonomous mode for routine clarifications, Assisted mode for complex or controversial items).
- Never books calendar events or sends external customer invitations without explicit engineer confirmation.

## Human Approval
- Human approval is mandatory. The Requirement Engineer must review and approve the meeting objective, agenda, suggested mode, and chosen time slot before any event is finalized or communicated to external stakeholders.

## Dependencies
- Storage abstraction layer (`lib/storage/meeting-store.ts`, `lib/storage/project-store.ts`)
- LLM abstraction (Groq / GPT-OSS 120B with OpenRouter fallback) for intelligent agenda synthesis and urgency evaluation
- Calendar API integrations (Google Calendar / Outlook / iCal format)

## Integration With Other Modules
- **Meeting Management**: Scans transcripts and action items from finished meetings, and provisions agendas/links for upcoming meetings.
- **Requirement Engineering**: Gathers pending clarification questions and attaches specific requirement IDs to agenda topics.
- **Project Knowledge & Memory**: Reads project milestones and logs scheduled meeting metadata into persistent memory.
- **Agent Action & Workflow**: Coordinates approval requests and triggers calendar execution actions through the agent loop.

## Important Rules
1. AI detects, plans, and suggests; Human approves; Calendar executes.
2. The agent must never finalize a calendar event or transmit invites without human engineer approval.
3. Every scheduled follow-up meeting must link directly to the originating meeting and the specific requirement IDs being clarified.
4. Routine follow-ups can be recommended for Autonomous mode, but the engineer retains the choice to switch to Assisted mode.

## Current Implementation Status
**Planned / Designed / Not Yet Implemented**
- The planning lifecycle, agenda generation algorithm, approval gate, and scheduling model are fully designed.
- No code implementation, calendar connectors, or scheduling UI exist in the repository.

## Future Considerations
- Two-way synchronization with Google Calendar, Microsoft Outlook, and CalDAV
- Timezone negotiation and automated participant polling
- Smart rescheduling upon client conflicts or urgent priority shifts
