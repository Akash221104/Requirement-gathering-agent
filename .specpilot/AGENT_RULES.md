# SpecPilot Agent Rules

As the AI coding agent for **SpecPilot**, you must strictly abide by the following operational, architectural, and documentation rules during all development, refactoring, and maintenance tasks.

---

## 1. Pre-Task Initialization (Mandatory)

Before starting **ANY** development, refactoring, or modification task, execute the following steps in sequence:

1. **Read `.specpilot/PROJECT_MEMORY.md`**: Understand high-level project goals, core principles, system architecture, and constraints.
2. **Read `.specpilot/CURRENT_STATE.md`**: Understand the current development phase, active module, designed vs. implemented status, and immediate priorities.
3. **Read `.specpilot/DECISIONS.md`**: Ensure no established architectural or product decisions are violated.
4. **Read the `MEMORY.md` of every relevant module**: Check module contracts, responsibilities, input/output schemas, agent behaviors, and integration boundaries.
5. **Inspect the existing code before modifying anything**: Always inspect and verify the actual codebase state before writing, editing, or refactoring code.

---

## 2. Integrity and Truthfulness

- **Never assume that missing information is true**: If requirements or specifications are ambiguous or absent, request clarification or mark them explicitly as open questions.
- **Never invent project requirements or architectural decisions**: Ground all work strictly in explicit user instructions or documented architecture.
- **Never contradict documented project decisions silently**: If an existing decision in `DECISIONS.md` appears problematic or outdated, discuss it explicitly with the user before changing course.
- **Do not start implementing a new module until its intended design has been documented** or clearly provided in the current task.
- **Explain large architectural changes before making them**: Always explain the rationale, trade-offs, and downstream impact prior to initiating substantial refactors.

---

## 3. Decision-Making & Architectural Governance

- If a new architectural or product decision is required:
  - Clearly explain the proposed decision and rationale.
  - Ask for / obtain user confirmation when appropriate.
  - Record the confirmed decision in `.specpilot/DECISIONS.md`.
- Keep architecture modular and storage replaceable.
- Avoid premature production complexity during prototype/hackathon phases.

---

## 4. Documentation Synchronization & Maintenance

- **After completing a meaningful development task**:
  - Update `.specpilot/CURRENT_STATE.md` (active module, progress, known issues, next immediate step, last updated).
  - Update `.specpilot/CHANGELOG.md` with date, change, reason, and affected module.
  - Update relevant `docs/<module>/MEMORY.md` if the module design, behavior, interfaces, or implementation status changed.
- **Keep documentation synchronized with the actual verified implementation**.
- **If documentation and code contradict each other**:
  - Identify the contradiction explicitly.
  - Inspect the actual implementation in the codebase.
  - Do not silently ignore or conceal the discrepancy.
  - Resolve the contradiction and update the appropriate state/history documentation.

---

## 5. History & Memory Preservation

- **Do not rewrite memory files unnecessarily**: Preserve previous decisions and context.
- **Do not delete historical information** unless explicitly instructed to do so.
- **Never silently rewrite history**: Requirements, decisions, and meeting records must maintain immutable revision trails.

---

## 6. Implementation Status Discipline

Always strictly distinguish between these three states:

| Status | Meaning |
|---|---|
| **DESIGNED** | The architecture, behavior, and interfaces have been agreed upon and documented. |
| **PLANNED** | The feature is intended for future phases, but implementation has not started or is incomplete. |
| **IMPLEMENTED** | The feature has been verified through existing, functioning code in the actual codebase. |

- **Never confuse or conflate DESIGNED or PLANNED with IMPLEMENTED.**
- Treat actual verified code as the sole source of truth for implementation status.
- Treat documented architecture as the source of truth for development intent.
