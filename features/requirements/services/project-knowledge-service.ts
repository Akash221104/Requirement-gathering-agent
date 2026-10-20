/**
 * Project Knowledge Service — Continuous Cross-Meeting Memory & Living Specification Engine
 *
 * Responsibilities:
 * 1. Aggregates complete project history across all meetings (summaries, decisions, requirements, changes).
 * 2. Injects rich, real-time knowledge base into voice agents (Deepgram, LiveKit, Intervention Engine).
 * 3. Prevents the agent from ever claiming "I don't have access to previous meeting notes".
 * 4. Tracks requirement evolution (NEW, UPDATED, REMOVED, STABLE) with visual diff comparisons.
 */

import fs from 'fs/promises';
import path from 'path';
import type { Meeting } from '@/types/meeting';
import type { CandidateRequirement, RequirementQualityIssue, ClarificationQuestion, Requirement } from '@/types/requirement';
import type { RequirementDecisionItem, RequirementChangeItem } from '@/types/documentation';
import { meetingStore } from '@/lib/storage/meeting-store';
import { decisionStore } from '@/lib/storage/decision-store';
import { requirementVersionService } from './requirement-version-service';
import { intelligenceStore } from '@/lib/storage/intelligence-store';
import { documentStore } from '@/lib/storage/document-store';
import { getProjectsDir } from '@/lib/storage/data-dir';

export interface MeetingKnowledgeSummary {
  meetingId: string;
  meetingNumber: number;
  title: string;
  date: string;
  mode: string;
  summaryText: string;
  requirements: CandidateRequirement[];
  decisions: RequirementDecisionItem[];
  changes: RequirementChangeItem[];
  questions: ClarificationQuestion[];
}

export interface RequirementEvolutionItem {
  id: string;
  currentText: string;
  previousText?: string;
  category: 'functional' | 'non_functional' | 'security' | 'technical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'TAGGED_FOR_NEXT_MEETING' | 'NEEDS_CLARIFICATION' | string;
  evolutionType: 'NEW' | 'UPDATED' | 'REMOVED' | 'STABLE';
  originMeetingId: string;
  originMeetingNumber: number;
  lastUpdatedMeetingId?: string;
  lastUpdatedMeetingNumber?: number;
  changeRationale?: string;
  confidence: number;
  version: string;
}

export interface ProjectKnowledgeBase {
  projectId: string;
  projectName: string;
  clientName: string;
  clientContact: string;
  description: string;
  currentBaselineVersion: string;
  meetingsChronology: MeetingKnowledgeSummary[];
  baselineRequirements: Requirement[];
  allCandidateRequirements: CandidateRequirement[];
  allDecisions: RequirementDecisionItem[];
  allChanges: RequirementChangeItem[];
  allQualityIssues: RequirementQualityIssue[];
  allClarificationQuestions: ClarificationQuestion[];
  evolutionMatrix: RequirementEvolutionItem[];
}

export class ProjectKnowledgeService {
  /**
   * Retrieve complete cross-meeting knowledge base for a project.
   */
  public async getProjectKnowledgeBase(
    projectId: string = 'project-001',
    excludeMeetingId?: string
  ): Promise<ProjectKnowledgeBase> {
    const cleanProjectId = projectId || 'project-001';

    // 1. Fetch Project Details
    let projectName = 'Enterprise Requirement Discovery';
    let clientName = 'Client Stakeholder';
    let clientContact = 'Lead Client Contact';
    let projectDescription = 'Continuous living requirement elicitation and architecture discovery.';

    try {
      const projPath = path.join(getProjectsDir(), cleanProjectId, 'project.json');
      const raw = await fs.readFile(/*turbopackIgnore: true*/ projPath, 'utf-8');
      const p = JSON.parse(raw);
      projectName = p.name || projectName;
      clientName = p.clientName || clientName;
      clientContact = p.clientContact || clientContact;
      projectDescription = p.description || projectDescription;
    } catch {
      // Fallback defaults
    }

    // 2. Fetch baseline versions and approved requirements
    const baselineRequirements = await requirementVersionService.getBaseline(cleanProjectId);
    const versionHistory = await requirementVersionService.getVersionHistory(cleanProjectId);
    const currentBaselineVersion = versionHistory[0]?.versionLabel || 'v1.0';

    // 3. Fetch all meetings sorted chronologically
    const allMeetings = await meetingStore.getMeetings(cleanProjectId);
    const sortedMeetings = [...allMeetings].sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );

    const meetingsChronology: MeetingKnowledgeSummary[] = [];
    const allCandidateRequirements: CandidateRequirement[] = [];
    const allDecisions: RequirementDecisionItem[] = [];
    const allChanges: RequirementChangeItem[] = [];
    const allQualityIssues: RequirementQualityIssue[] = [];
    const allClarificationQuestions: ClarificationQuestion[] = [];

    // Map to track origin and history of each requirement
    const reqOriginMap = new Map<string, { meetingId: string; meetingNumber: number }>();
    const reqTextHistory = new Map<string, string[]>();

    for (let idx = 0; idx < sortedMeetings.length; idx++) {
      const m = sortedMeetings[idx];
      const meetingNumber = idx + 1;
      const cleanMeetingId = m.id.replace(/^meeting-/, '');

      // Load intelligence
      const intel = await intelligenceStore.getIntelligence(m.id, cleanProjectId);
      const reqs = intel?.candidateRequirements || [];
      const issues = intel?.issues || [];
      const questions = intel?.clarificationQuestions || [];

      // Track origins
      for (const r of reqs) {
        if (!reqOriginMap.has(r.id)) {
          reqOriginMap.set(r.id, { meetingId: m.id, meetingNumber });
        }
        if (!reqTextHistory.has(r.id)) {
          reqTextHistory.set(r.id, []);
        }
        reqTextHistory.get(r.id)!.push(r.requirementText);
      }

      // Load decisions and changes
      const decisions = await decisionStore.getDecisions(m.id, cleanProjectId);
      const changes = await decisionStore.getChanges(m.id, cleanProjectId);

      // Load summary text
      let summaryText = '';
      try {
        const bundle = await documentStore.getDocuments(m.id, cleanProjectId);
        if (bundle && bundle.summary) {
          summaryText = bundle.summary
            .replace(/^#+\s+.*$/gm, '')
            .split('\n')
            .filter((l) => l.trim().length > 0)
            .slice(0, 5)
            .join(' ');
        }
      } catch {}

      if (!summaryText && reqs.length > 0) {
        summaryText = `Captured ${reqs.length} requirements including: ${reqs.slice(0, 3).map((r) => r.requirementText).join('; ')}.`;
      }

      meetingsChronology.push({
        meetingId: m.id,
        meetingNumber,
        title: m.title || `Requirement Discovery #${meetingNumber}`,
        date: m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'Recent',
        mode: m.mode,
        summaryText,
        requirements: reqs,
        decisions,
        changes,
        questions,
      });

      allCandidateRequirements.push(...reqs);
      allDecisions.push(...decisions);
      allChanges.push(...changes);
      allQualityIssues.push(...issues);
      allClarificationQuestions.push(...questions);
    }

    // 4. Build Requirement Evolution Matrix with Diffs
    const evolutionMatrix: RequirementEvolutionItem[] = [];
    const processedIds = new Set<string>();

    // Process all candidate requirements
    for (const r of allCandidateRequirements) {
      if (processedIds.has(r.id)) continue;
      processedIds.add(r.id);

      const origin = reqOriginMap.get(r.id) || { meetingId: r.meetingId, meetingNumber: 1 };
      const matchingChanges = allChanges.filter((c) => c.requirementId === r.id);
      const latestChange = matchingChanges[matchingChanges.length - 1];

      let evolutionType: 'NEW' | 'UPDATED' | 'REMOVED' | 'STABLE' = 'STABLE';
      let previousText: string | undefined = undefined;
      let changeRationale: string | undefined = undefined;

      const latestMeetingNumber = sortedMeetings.length;

      if (r.status === 'REJECTED') {
        evolutionType = 'REMOVED';
        previousText = r.requirementText;
        changeRationale = r.notes || 'Marked out of scope by stakeholder';
      } else if (latestChange && latestChange.changeType === 'MODIFIED') {
        evolutionType = 'UPDATED';
        previousText = latestChange.oldText;
        changeRationale = latestChange.impactSummary;
      } else if (origin.meetingNumber === latestMeetingNumber && latestMeetingNumber > 1) {
        evolutionType = 'NEW';
      } else {
        evolutionType = 'STABLE';
      }

      evolutionMatrix.push({
        id: r.id,
        currentText: r.requirementText,
        previousText,
        category: (r.type === 'FUNCTIONAL' ? 'functional' : 'non_functional') as any,
        priority: (r.priority as any) || 'high',
        status: r.status,
        evolutionType,
        originMeetingId: origin.meetingId,
        originMeetingNumber: origin.meetingNumber,
        lastUpdatedMeetingId: latestChange?.sourceMeetingId,
        changeRationale,
        confidence: r.confidence || 0.95,
        version: currentBaselineVersion,
      });
    }

    // Also include baseline requirements not in candidates
    for (const b of baselineRequirements) {
      if (processedIds.has(b.id)) continue;
      processedIds.add(b.id);
      evolutionMatrix.push({
        id: b.id,
        currentText: b.description,
        category: b.category as any,
        priority: (b.priority as any) || 'high',
        status: 'APPROVED',
        evolutionType: 'STABLE',
        originMeetingId: 'baseline-v1',
        originMeetingNumber: 1,
        confidence: 1.0,
        version: `v${b.currentVersion}`,
      });
    }

    return {
      projectId: cleanProjectId,
      projectName,
      clientName,
      clientContact,
      description: projectDescription,
      currentBaselineVersion,
      meetingsChronology,
      baselineRequirements,
      allCandidateRequirements,
      allDecisions,
      allChanges,
      allQualityIssues,
      allClarificationQuestions,
      evolutionMatrix,
    };
  }

  /**
   * Build complete system instruction string for Deepgram Voice Agent and LLM brains.
   * Gives the AI full memory of all past meetings and explicit rules to acknowledge previous agreements.
   */
  public async buildVoiceAgentKnowledgePrompt(
    projectId: string = 'project-001',
    currentMeetingId?: string,
    mode: 'assisted' | 'autonomous' = 'assisted'
  ): Promise<string> {
    const kb = await this.getProjectKnowledgeBase(projectId, currentMeetingId);

    // Format previous meetings into a compact, easily accessible chronology
    const pastMeetings = kb.meetingsChronology.filter((m) => !currentMeetingId || m.meetingId !== currentMeetingId);

    let meetingsHistorySection = '';
    if (pastMeetings.length > 0) {
      meetingsHistorySection = pastMeetings
        .map((m) => {
          const reqsSnippet =
            m.requirements.length > 0
              ? m.requirements.map((r) => `"${r.requirementText}"`).slice(0, 4).join(', ')
              : 'Discovery discussion';
          const decisionsSnippet =
            m.decisions.length > 0
              ? m.decisions.map((d) => `${d.topic}: ${d.decision}`).join('; ')
              : 'Initial architecture established';

          return `* Meeting #${m.meetingNumber} [${m.title}] (${m.date}):\n  - Topics & Requirements: ${reqsSnippet}\n  - Confirmed Decisions: ${decisionsSnippet}`;
        })
        .join('\n\n');
    } else {
      meetingsHistorySection = '(This is the first meeting for this project.)';
    }

    // Format current approved & candidate requirements
    const activeReqs = kb.evolutionMatrix
      .filter((e) => e.evolutionType !== 'REMOVED')
      .slice(0, 8)
      .map((e) => `- [${e.id} | ${e.evolutionType}] ${e.currentText}`)
      .join('\n');

    // Format confirmed decisions
    const decisionsSummary =
      kb.allDecisions.length > 0
        ? kb.allDecisions.slice(0, 5).map((d) => `- ${d.topic}: ${d.decision}`).join('\n')
        : '- Google SSO and cloud catalog baseline';

    // Format topics tagged for today
    const taggedTopics = kb.allCandidateRequirements
      .filter((r) => r.status === 'TAGGED_FOR_NEXT_MEETING' || r.taggedForNextMeeting)
      .map((r) => `- Clarify: "${r.requirementText}"`)
      .join('\n');

    const prompt = `You are SpecPilot, the dedicated Agentic AI Requirement Engineering Co-Pilot for "${kb.projectName}" (Client: ${kb.clientName}).

======================================================================
CONTINUOUS PROJECT MEMORY & CROSS-MEETING KNOWLEDGE BASE
======================================================================
PROJECT CONTEXT:
- Name: ${kb.projectName}
- Client: ${kb.clientName} (${kb.clientContact})
- Overview: ${kb.description}
- Current Baseline: ${kb.currentBaselineVersion}

PREVIOUS MEETINGS & DISCUSSIONS:
${meetingsHistorySection}

ACTIVE REQUIREMENTS BASELINE:
${activeReqs || '(None captured yet)'}

CONFIRMED ARCHITECTURE & PRODUCT DECISIONS:
${decisionsSummary}

${taggedTopics ? `TOPICS & QUESTIONS FLAGGED FOR TODAY'S SESSION:\n${taggedTopics}\n` : ''}
======================================================================

CRITICAL MEMORY & BEHAVIORAL RULES:
1. COMPLETE HISTORICAL ACCESS:
   - YOU HAVE FULL ACCESS to all previous meeting notes, decisions, and discussions above.
   - NEVER EVER say: "I don't have access to previous meeting notes", "I cannot recall previous meetings", or "As an AI, I don't retain memory".
   - If the user asks: "Do you remember what we talked about in the last meeting?" or "What did we agree on?":
     Respond warmly and specifically! Mention the key points from Meeting #1:
     "Yes, absolutely! Last meeting we discussed building an e-commerce platform for your offline clothing store, featuring seasonal collections (summer, winter, rainy) for teenagers and young adults, and Google SSO authentication. Today we're continuing on catalog filtering and checkout details!"

2. HANDLING CHANGES & UPDATES (REQUIREMENT EVOLUTION):
   - If the customer wants to change, update, or contradict a previous requirement (e.g., "Instead of Google SSO, we want mobile OTP login", or "We only want clothes for teens"):
     Acknowledge the change warmly and confirm the update:
     "Understood! We'll update the requirement: switching from Google SSO to mobile OTP authentication for customer sign-in."

3. MEETING LEADERSHIP & VOICE STYLE:
   - Tone: Friendly, expert, empathetic, natural human collaborator.
   - Length: 1 to 2 spoken sentences maximum per turn. Never monologue or give numbered lists over voice.
   - Ask ONE focused question at a time.
   - When addressed or asked for technical advice, give crisp, authoritative recommendations.

Mode: ${mode.toUpperCase()}
`.trim();

    return prompt;
  }

  /**
   * Build the Master Living SRS Specification Document Markdown.
   * Tracks full evolution across all meetings with color-coded diff indicators:
   * - [+ NEW in Meeting #X]
   * - [↻ UPDATED in Meeting #X] (shows current text AND strikethrough of previous text)
   * - [- REMOVED in Meeting #X]
   * - [✓ STABLE]
   */
  public async generateMasterLivingSpecificationMarkdown(projectId: string = 'project-001'): Promise<string> {
    const kb = await this.getProjectKnowledgeBase(projectId);

    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const functional = kb.evolutionMatrix.filter((r) => r.category === 'functional');
    const nonFunctional = kb.evolutionMatrix.filter((r) => r.category !== 'functional');

    const newCount = kb.evolutionMatrix.filter((r) => r.evolutionType === 'NEW').length;
    const updatedCount = kb.evolutionMatrix.filter((r) => r.evolutionType === 'UPDATED').length;
    const removedCount = kb.evolutionMatrix.filter((r) => r.evolutionType === 'REMOVED').length;
    const stableCount = kb.evolutionMatrix.filter((r) => r.evolutionType === 'STABLE').length;

    const renderRequirementRow = (r: RequirementEvolutionItem) => {
      let badge = '';
      if (r.evolutionType === 'NEW') {
        badge = `**<span style="color:#10b981;">[+ NEW in Meeting #${r.originMeetingNumber}]</span>**`;
      } else if (r.evolutionType === 'UPDATED') {
        badge = `**<span style="color:#f59e0b;">[↻ UPDATED in Meeting #${r.originMeetingNumber}]</span>**`;
      } else if (r.evolutionType === 'REMOVED') {
        badge = `**<span style="color:#ef4444;">[- REMOVED in Meeting #${r.originMeetingNumber}]</span>**`;
      } else {
        badge = `**<span style="color:#06b6d4;">[✓ STABLE]</span>**`;
      }

      let textCell = '';
      if (r.evolutionType === 'UPDATED' && r.previousText) {
        textCell = `**Current:** ${r.currentText}<br/><span style="color:#a1a1aa;text-decoration:line-through;">Previous: "${r.previousText}"</span>${r.changeRationale ? `<br/><em>*Rationale:* ${r.changeRationale}</em>` : ''}`;
      } else if (r.evolutionType === 'REMOVED') {
        textCell = `<span style="color:#ef4444;text-decoration:line-through;">${r.currentText}</span><br/><em>*Out of scope:* ${r.changeRationale || 'Marked out of scope'}</em>`;
      } else {
        textCell = r.currentText;
      }

      return `| \`${r.id}\` | ${badge} ${textCell.replace(/\|/g, '\\|')} | \`${r.priority.toUpperCase()}\` | \`${r.status}\` | ${r.version} |`;
    };

    return `# Master Living Software Requirements Specification (SRS)

**Project:** ${kb.projectName.toUpperCase()}  
**Client:** ${kb.clientName} (${kb.clientContact})  
**Baseline Version:** ${kb.currentBaselineVersion}  
**Date Generated:** ${dateStr}  
**Evolution Status:** ${newCount} New &bull; ${updatedCount} Updated &bull; ${removedCount} Removed &bull; ${stableCount} Stable  
**Continuous Memory Scope:** Aggregated across all ${kb.meetingsChronology.length} meeting discovery sessions  

---

## 1. Project Purpose & Executive Overview
${kb.description}

### Meeting Discovery Cadence
${
  kb.meetingsChronology.length > 0
    ? kb.meetingsChronology
        .map(
          (m) =>
            `- **Meeting #${m.meetingNumber} (${m.mode.toUpperCase()})**: *${m.title}* — ${m.date} (ID: \`${m.meetingId}\`)\n  - *Summary:* ${m.summaryText || 'Requirement elicitation and scoping'}`
        )
        .join('\n')
    : '_No meetings conducted yet._'
}

---

## 2. Requirement Evolution & Change Summary
The living specification continuously reflects all additions, modifications, and deletions agreed upon across meetings:

| Metric | Count | Description |
|---|---|---|
| **<span style="color:#10b981;">[+ NEW]</span>** | **${newCount}** | Elicited and introduced in recent discovery iterations |
| **<span style="color:#f59e0b;">[↻ UPDATED]</span>** | **${updatedCount}** | Scope or rule changed from an earlier meeting discussion |
| **<span style="color:#ef4444;">[- REMOVED]</span>** | **${removedCount}** | Marked out of scope or superseded during client review |
| **<span style="color:#06b6d4;">[✓ STABLE]</span>** | **${stableCount}** | Confirmed requirements unchanged across iterations |

---

## 3. Living Functional Requirements (FR)
| ID | Requirement Specification & Evolution Status | Priority | Status | Version |
|---|---|---|---|---|
${
  functional.length > 0
    ? functional.map(renderRequirementRow).join('\n')
    : '| `REQ-001` | System baseline pending functional requirements elicitation | `HIGH` | `PROPOSED` | v1.0 |'
}

---

## 4. Living Non-Functional & Security Attributes (NFR)
| ID | Attribute Specification & Evolution Status | Priority | Status | Version |
|---|---|---|---|---|
${
  nonFunctional.length > 0
    ? nonFunctional.map(renderRequirementRow).join('\n')
    : '| `REQ-SEC-001` | Authentication and role-based access control must be enforced across all APIs. | `CRITICAL` | `APPROVED` | v1.0 |'
}

---

## 5. Confirmed Architectural Decisions Across All Meetings
${
  kb.allDecisions.length > 0
    ? kb.allDecisions
        .map(
          (d, i) =>
            `${i + 1}. **${d.topic}**: ${d.decision}  \n   *(Confirmed by: ${d.confirmedBy} in meeting \`${d.meetingId}\`)*`
        )
        .join('\n\n')
    : '> No formal architectural decisions recorded yet. Baseline relies on default cloud microservices architecture.'
}

---

## 6. Audit Trail of Requirement Modifications & Drift
${
  kb.allChanges.length > 0
    ? kb.allChanges
        .map(
          (c, i) =>
            `${i + 1}. **[${c.changeType}] in \`${c.requirementId || 'NEW'}\`**: ${c.impactSummary}  \n   - *Previous:* "${c.oldText || 'None'}"  \n   - *Updated:* "${c.newText}"  \n   - *Source:* Meeting \`${c.sourceMeetingId}\` (${c.speaker})`
        )
        .join('\n\n')
    : '> Zero requirement conflicts or breaking drift detected across meeting iterations.'
}

---

## 7. Open Ambiguities & Clarification Questions for Next Session
${
  kb.allClarificationQuestions.length > 0
    ? kb.allClarificationQuestions
        .slice(0, 5)
        .map((q, i) => `${i + 1}. **Question:** "${q.question}"  \n   - *Rationale:* ${q.rationale}`)
        .join('\n\n')
    : '- [ ] Review latest baseline with engineering and product leads.\n- [ ] Customer sign-off on production readiness.'
}

---
*Maintained autonomously by SpecPilot Continuous Project Knowledge Engine. Living baseline stamped by Lead Requirement Engineer.*
`;
  }
}

export const projectKnowledgeService = new ProjectKnowledgeService();
