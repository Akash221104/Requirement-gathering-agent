import type { TranscriptSegment } from '@/types/meeting';
import type { CandidateRequirement, RequirementQualityIssue, Requirement } from '@/types/requirement';
import type { RequirementDecisionItem, RequirementChangeItem, MeetingDocumentBundle } from '@/types/documentation';
import type { FollowUpRecommendation } from '@/types/calendar';
import { documentStore } from '@/lib/storage/document-store';
import { decisionStore } from '@/lib/storage/decision-store';
import { requirementVersionService } from './requirement-version-service';

export interface DocumentationEngineInput {
  meetingId: string;
  projectId: string;
  meetingTitle: string;
  transcriptSegments: TranscriptSegment[];
  candidateRequirements: CandidateRequirement[];
  issues: RequirementQualityIssue[];
  confirmedDecisions: RequirementDecisionItem[];
  detectedChanges: RequirementChangeItem[];
  unresolvedQuestions?: string[];
  actionItems?: string[];
}

export class PostMeetingDocumentationEngine {
  /**
   * Generates all 16 required sections, saves markdown files, and evaluates follow-up needs.
   */
  public async generateDocuments(input: DocumentationEngineInput): Promise<{
    bundle: MeetingDocumentBundle;
    followUp: FollowUpRecommendation;
  }> {
    const {
      meetingId,
      projectId,
      meetingTitle,
      transcriptSegments,
      candidateRequirements,
      issues,
      confirmedDecisions,
      detectedChanges,
      unresolvedQuestions = [],
      actionItems = [],
    } = input;

    const baseline = await requirementVersionService.getBaseline(projectId);
    const dateFormatted = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // 1. Meeting Summary
    const summaryMd = this.generateSummarySection(meetingTitle, meetingId, dateFormatted, transcriptSegments, candidateRequirements, confirmedDecisions);

    // Filter requirements by category
    const frs = candidateRequirements.filter((r) => r.type === 'FUNCTIONAL');
    const nfrs = candidateRequirements.filter((r) => r.type === 'NON_FUNCTIONAL');
    const businessReqs = candidateRequirements.filter((r) => r.type === 'BUSINESS');
    const technicalReqs = candidateRequirements.filter((r) => r.type === 'TECHNICAL');
    const securityReqs = candidateRequirements.filter((r) => r.type === 'SECURITY');
    const perfReqs = candidateRequirements.filter((r) => r.type === 'PERFORMANCE');
    const uiReqs = candidateRequirements.filter((r) => r.type === 'UI_UX');

    // 2-9. Requirements Sections
    const requirementsMd = this.generateRequirementsDocument(
      frs,
      nfrs,
      businessReqs,
      technicalReqs,
      securityReqs,
      perfReqs,
      uiReqs
    );

    // 10. Decisions Log
    const decisionsMd = this.generateDecisionsSection(confirmedDecisions, meetingId);

    // 11. Change Log
    const changesMd = this.generateChangesSection(detectedChanges, meetingId);

    // 12-14. Open Questions, Issues, Action Items
    const openQuestionsMd = this.generateOpenQuestionsSection(unresolvedQuestions, issues);
    const actionItemsMd = this.generateActionItemsSection(actionItems, unresolvedQuestions);

    // 15. Impact Analysis
    const impactAnalysisMd = this.generateImpactAnalysisSection(detectedChanges, issues, baseline);

    // 16. Requirement Traceability
    const traceabilityMd = this.generateTraceabilitySection(candidateRequirements, meetingId);

    // Consolidated SRS Document
    const srsMd = `# Software Requirement Specification (SRS)

**Project:** ${projectId.toUpperCase()}  
**Meeting:** ${meetingTitle} (ID: \`${meetingId}\`)  
**Date:** ${dateFormatted}  
**Status:** DRAFT — PENDING HUMAN ENGINEER REVIEW  

---

## 1. Executive Meeting Summary

${summaryMd}

---

## 2. Requirements Catalogue

${requirementsMd}

---

## 3. Confirmed Architecture & Product Decisions

${decisionsMd}

---

## 4. Detected Baseline Changes & Conflict Analysis

${changesMd}

---

## 5. Quality Issues & Ambiguities

${openQuestionsMd}

---

## 6. Action Items & Next Steps

${actionItemsMd}

---

## 7. System Impact Analysis

${impactAnalysisMd}

---

## 8. Requirement Traceability Matrix

${traceabilityMd}

---
*Generated autonomously by SpecPilot Requirement Engineering Engine. Approved baseline changes require human engineer sign-off.*
`;

    const bundle: MeetingDocumentBundle = {
      meetingId,
      projectId,
      meetingTitle,
      generatedAt: new Date().toISOString(),
      summary: summaryMd,
      srs: srsMd,
      requirements: requirementsMd,
      decisions: decisionsMd,
      changes: changesMd,
      traceability: traceabilityMd,
      openQuestions: unresolvedQuestions,
      actionItems,
      impactAnalysis: impactAnalysisMd,
    };

    // Save markdown files and bundle JSON
    await documentStore.saveDocuments(bundle);

    // Save decisions, changes, and summary JSON
    await decisionStore.saveDecisions(meetingId, confirmedDecisions, projectId);
    await decisionStore.saveChanges(meetingId, detectedChanges, projectId);
    await decisionStore.saveSummary(
      meetingId,
      {
        meetingId,
        title: meetingTitle,
        summary: summaryMd.slice(0, 300) + '...',
        completedAt: new Date().toISOString(),
        keyDecisionsCount: confirmedDecisions.length,
        candidateRequirementsCount: candidateRequirements.length,
        unresolvedQuestionsCount: unresolvedQuestions.length,
      },
      projectId
    );

    // Evaluate follow-up requirement
    const followUp = this.evaluateFollowUp(meetingId, projectId, unresolvedQuestions, issues, detectedChanges);

    return { bundle, followUp };
  }

  private generateSummarySection(
    title: string,
    meetingId: string,
    date: string,
    transcripts: TranscriptSegment[],
    candidates: CandidateRequirement[],
    decisions: RequirementDecisionItem[]
  ): string {
    const customerTurns = transcripts.filter((t) => t.speakerRole === 'CUSTOMER').length;
    const engineerTurns = transcripts.filter((t) => t.speakerRole === 'REQUIREMENT_ENGINEER').length;
    const specPilotTurns = transcripts.filter((t) => t.speakerRole === 'SPEC_PILOT').length;

    return `The requirement elicitation meeting for **${title}** concluded on ${date}. 
During this session, **${candidates.length} candidate requirements** were identified and **${decisions.length} product decisions** were confirmed with stakeholders.

### Meeting Participation Telemetry
- Total Speech Exchanges: ${transcripts.length}
- Customer Contributions: ${customerTurns} turns
- Requirement Engineer Turns: ${engineerTurns} turns
- SpecPilot Interventions / Questions: ${specPilotTurns} turns

### Key Highlights
${
  candidates.length > 0
    ? candidates.slice(0, 3).map((c, i) => `${i + 1}. **${c.type}**: "${c.requirementText}" (Confidence: ${Math.round(c.confidence * 100)}%)`).join('\n')
    : 'No explicit candidate requirements were captured.'
}`;
  }

  private generateRequirementsDocument(
    frs: CandidateRequirement[],
    nfrs: CandidateRequirement[],
    business: CandidateRequirement[],
    technical: CandidateRequirement[],
    security: CandidateRequirement[],
    performance: CandidateRequirement[],
    uiUx: CandidateRequirement[]
  ): string {
    const formatReqList = (reqs: CandidateRequirement[], categoryTitle: string, emptyMessage: string) => {
      if (reqs.length === 0) {
        return `### ${categoryTitle}\n> ℹ️ *${emptyMessage}*\n`;
      }

      const tableRows = reqs.map((r) => {
        const statusBadge = r.status === 'APPROVED' ? '✅ **APPROVED**' : '⏳ **PROPOSED (Pending Review)**';
        const confPercent = Math.round((r.confidence || 0.85) * 100);
        return `| **\`${r.id}\`** | ${r.requirementText.replace(/\|/g, '\\|')} | \`${r.priority || 'medium'}\` | ${confPercent}% | ${statusBadge} |`;
      }).join('\n');

      return `### ${categoryTitle} (${reqs.length})

| Req ID | Requirement Statement & Criteria | Priority | Confidence | Review State |
|:---|:---|:---:|:---:|:---|
${tableRows}
`;
    };

    return [
      formatReqList(frs, 'Functional Requirements (FR)', 'No functional requirements were explicitly identified during this session.'),
      formatReqList(nfrs, 'Non-Functional Requirements (NFR)', 'No general non-functional constraints were identified.'),
      formatReqList(securityReqsList(security), 'Security & Compliance Requirements', 'No specific security or authentication constraints were recorded.'),
      formatReqList(performance, 'Performance & Scalability Requirements', 'No latency, throughput, or capacity constraints were specified.'),
      formatReqList(uiUx, 'UI / UX & Design Interaction Requirements', 'No dedicated front-end visual specifications were identified.'),
      formatReqList(business, 'Business & Regulatory Requirements', 'No business or regulatory mandates were noted.'),
      formatReqList(technical, 'Technical Architecture & Platform Requirements', 'No infrastructure or technology stack mandates were noted.'),
    ].join('\n---\n\n');

    function securityReqsList(list: CandidateRequirement[]) {
      return list;
    }
  }

  private generateDecisionsSection(decisions: RequirementDecisionItem[], meetingId: string): string {
    if (decisions.length === 0) {
      return `> No definitive decisions were finalized during this meeting. Pending items require follow-up.\n`;
    }

    return decisions
      .map(
        (d, idx) => `#### DEC-${(idx + 1).toString().padStart(3, '0')}: ${d.topic}
- **Decision:** ${d.decision}
- **Confirmed By:** ${d.confirmedBy}
- **Timestamp:** ${new Date(d.timestamp).toLocaleTimeString()}
- **Status:** \`${d.status}\` (Pending Engineer Approval)`
      )
      .join('\n\n');
  }

  private generateChangesSection(changes: RequirementChangeItem[], meetingId: string): string {
    if (changes.length === 0) {
      return `> No scope mutations or conflicts against the existing baseline were detected during this meeting.\n`;
    }

    return changes
      .map(
        (c, idx) => `#### CHG-${(idx + 1).toString().padStart(3, '0')}: ${c.changeType}
- **Baseline Requirement:** ${c.oldText || 'None (New Scope)'}
- **New Proposed Requirement:** ${c.newText}
- **Impact Summary:** ${c.impactSummary}
- **Severity:** \`${c.severity.toUpperCase()}\`
- **Status:** \`${c.status}\` (Pending Engineer Approval)`
      )
      .join('\n\n');
  }

  private generateOpenQuestionsSection(questions: string[], issues: RequirementQualityIssue[]): string {
    const items = [...questions];
    for (const issue of issues) {
      if (issue.issueType === 'AMBIGUITY' || issue.issueType === 'INCOMPLETENESS' || issue.issueType === 'MISSING_CONSTRAINT') {
        items.push(`${issue.description} — *${issue.explanation}*`);
      }
    }

    if (items.length === 0) {
      return `> All discussed requirement points were adequately resolved. No open ambiguities remain.\n`;
    }

    return items.map((q, idx) => `${idx + 1}. **Open Item ${idx + 1}:** ${q}`).join('\n');
  }

  private generateActionItemsSection(actionItems: string[], questions: string[]): string {
    const list = [...actionItems];
    if (list.length === 0 && questions.length > 0) {
      list.push('Requirement Engineer to review and confirm proposed requirements.');
      list.push(`Conduct follow-up clarification on ${questions.length} unresolved questions.`);
    }

    if (list.length === 0) {
      return `> 1. Requirement Engineer review and sign-off on generated SRS draft.\n`;
    }

    return list.map((a, idx) => `- [ ] ${a}`).join('\n');
  }

  private generateImpactAnalysisSection(
    changes: RequirementChangeItem[],
    issues: RequirementQualityIssue[],
    baseline: Requirement[]
  ): string {
    if (changes.length === 0 && issues.length === 0) {
      return `> System impact is low. Captured requirements complement the existing baseline (${baseline.length} approved items) with zero architectural conflicts.\n`;
    }

    return `The identified changes and potential ambiguities introduce the following architectural and project considerations:
${changes.map((c) => `- **${c.changeType}**: ${c.impactSummary}`).join('\n')}
${issues.filter((i) => i.severity === 'high').map((i) => `- **High Risk Risk Factor**: ${i.description} (${i.explanation})`).join('\n')}`;
  }

  private generateTraceabilitySection(candidates: CandidateRequirement[], meetingId: string): string {
    if (candidates.length === 0) {
      return `> No traceability entries available for this session.\n`;
    }

    return `| Candidate ID | Requirement Type | Speaker Attribution | Timestamp / Turn | Approval State |
|---|---|---|---|---|
${candidates
  .map(
    (c) =>
      `| \`${c.id}\` | ${c.type} | ${c.sourceSpeakerName} (${c.sourceSpeakerRole}) | \`${c.sourceTurnRef || new Date(c.timestamp).toLocaleTimeString()}\` | \`${c.status}\` |`
  )
  .join('\n')}`;
  }

  private evaluateFollowUp(
    meetingId: string,
    projectId: string,
    unresolvedQuestions: string[],
    issues: RequirementQualityIssue[],
    changes: RequirementChangeItem[]
  ): FollowUpRecommendation {
    const highIssues = issues.filter((i) => i.severity === 'high');
    const unresolvedCount = unresolvedQuestions.length + highIssues.length;

    if (unresolvedCount > 0 || changes.some((c) => c.severity === 'high')) {
      const suggestedAgenda: string[] = [];
      if (unresolvedQuestions.length > 0) {
        suggestedAgenda.push(...unresolvedQuestions.slice(0, 3));
      }
      for (const issue of highIssues.slice(0, 2)) {
        suggestedAgenda.push(issue.description);
      }

      return {
        meetingId,
        projectId,
        recommended: true,
        reason: `${unresolvedCount} requirement question(s) or high-severity ambiguities remain unresolved.`,
        urgency: unresolvedCount >= 3 ? 'high' : 'medium',
        suggestedAgenda: suggestedAgenda.length > 0 ? suggestedAgenda : ['Clarify open requirement questions'],
        suggestedMode: unresolvedCount >= 4 ? 'assisted' : 'autonomous',
        unresolvedCount,
      };
    }

    return {
      meetingId,
      projectId,
      recommended: false,
      reason: 'All discussed requirements were confirmed with clear boundaries.',
      urgency: 'low',
      suggestedAgenda: [],
      suggestedMode: 'autonomous',
      unresolvedCount: 0,
    };
  }
}

export const postMeetingDocumentationEngine = new PostMeetingDocumentationEngine();
