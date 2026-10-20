/**
 * Meeting Document Service — Post-Meeting Documentation, Versioning & PDF Reporting
 *
 * Coordinates:
 * - PostMeetingDocumentationEngine: Generating Summary, SRS, Requirements, Decisions, Changes, Traceability
 * - DocumentStore: Persisting markdown artifacts and JSON bundle
 * - RequirementVersionService: Incrementing and snapshotting baseline versions (v1.0, v1.1...)
 * - CalendarStore: Scheduling follow-up meetings if recommended
 * - PDF Report HTML Generator: Creating a clean, phase-by-phase printable PDF report
 */

import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';
import type { Meeting, TranscriptSegment } from '@/types/meeting';
import type { CandidateRequirement, RequirementQualityIssue } from '@/types/requirement';
import type { MeetingDocumentBundle, RequirementBaselineVersion } from '@/types/documentation';
import { meetingStore } from '@/lib/storage/meeting-store';
import { documentStore } from '@/lib/storage/document-store';
import { decisionStore } from '@/lib/storage/decision-store';
import { calendarStore } from '@/lib/storage/calendar-store';
import { transcriptStore } from '@/lib/storage/transcript-store';
import { conversationManager } from '@/features/meeting/conversation/conversation-manager';
import { postMeetingDocumentationEngine } from './post-meeting-documentation-engine';
import { requirementVersionService } from './requirement-version-service';
import { transcriptSynthesizer } from './transcript-synthesizer';
import { requirementIntelligenceEngine } from './requirement-intelligence';

export class MeetingDocumentService {
  /**
   * Retrieve existing documents or automatically generate them on the fly from transcripts and intelligence.
   */
  public async getOrGenerateDocuments(
    meetingId: string,
    projectId: string = 'project-001'
  ): Promise<{
    bundle: MeetingDocumentBundle;
    versions: RequirementBaselineVersion[];
    meeting: Meeting | null;
  }> {
    // Check if documents already exist in store
    let bundle = await documentStore.getDocuments(meetingId, projectId);

    const meeting = await meetingStore.getMeeting(meetingId, projectId);

    if (!bundle) {
      bundle = await this.generateDocumentsForMeeting(meetingId, projectId);
    }

    const versions = await requirementVersionService.getVersionHistory(projectId);

    return { bundle, versions, meeting };
  }

  /**
   * Generate all documents, version snapshot, and calendar follow-up for a meeting.
   */
  public async generateDocumentsForMeeting(
    meetingId: string,
    projectId: string = 'project-001',
    forceReanalyze: boolean = false
  ): Promise<MeetingDocumentBundle> {
    const meeting = await meetingStore.getMeeting(meetingId, projectId);
    const meetingTitle = meeting?.title || 'Requirement Elicitation Meeting';

    // 1. Gather transcript segments (from live memory or transcriptStore)
    let segments: TranscriptSegment[] = conversationManager.getSegments(meetingId, projectId);
    const cleanId = meetingId.replace(/^meeting-/, '');
    if (!segments || segments.length === 0) {
      try {
        const persisted = await transcriptStore.getTranscript(meetingId, projectId);
        if (persisted && Array.isArray(persisted.segments) && persisted.segments.length > 0) {
          segments = persisted.segments;
        } else {
          const transcriptPath = path.join(
            process.cwd(),
            'data',
            'projects',
            projectId,
            'meetings',
            `meeting-${cleanId}-transcript.json`
          );
          const data = await fs.readFile(transcriptPath, 'utf-8');
          const parsed = JSON.parse(data);
          segments = Array.isArray(parsed) ? parsed : (parsed.segments || []);
        }
      } catch {
        segments = [];
      }
    }

    // 2. Gather intelligence state (candidate requirements, issues)
    let candidateRequirements: CandidateRequirement[] = [];
    let issues: RequirementQualityIssue[] = [];

    const intelPath = path.join(
      process.cwd(),
      'data',
      'projects',
      projectId,
      'meetings',
      `meeting-${cleanId}-intelligence.json`
    );

    let savedIntel: any = null;
    try {
      const data = await fs.readFile(intelPath, 'utf-8');
      savedIntel = JSON.parse(data);
      candidateRequirements = savedIntel.candidateRequirements || [];
      issues = savedIntel.issues || [];
    } catch {}

    // 3. Transcript Synthesis: Extract full requirements, decisions, and reschedule agreements
    let detectedReschedule: any = null;
    if (segments.length > 0) {
      try {
        // On force-reanalyze, clear existing intelligence so re-synthesis is clean
        if (forceReanalyze) {
          candidateRequirements = [];
          issues = [];
        }

        const synthesis = await transcriptSynthesizer.synthesize(meetingId, projectId, segments);

        // Merge synthesized requirements with existing ones (manual ones take precedence)
        const existingTexts = new Set(candidateRequirements.map((r) => r.requirementText.toLowerCase().trim()));
        for (const synReq of synthesis.candidateRequirements) {
          if (!existingTexts.has(synReq.requirementText.toLowerCase().trim())) {
            candidateRequirements.push(synReq);
            existingTexts.add(synReq.requirementText.toLowerCase().trim());
          }
        }

        // Save decisions if found
        if (synthesis.decisions.length > 0) {
          await decisionStore.saveDecisions(meetingId, synthesis.decisions, projectId);
        }

        if (synthesis.issues.length > 0 && (forceReanalyze || issues.length === 0)) {
          issues = synthesis.issues;
        }

        detectedReschedule = synthesis.reschedule;

        // Persist updated candidate requirements to disk
        const updatedIntel = {
          meetingId,
          projectId,
          candidateRequirements,
          issues,
          clarificationQuestions: synthesis.questions || [],
          lastUpdated: new Date().toISOString(),
        };
        await fs.mkdir(path.dirname(intelPath), { recursive: true });
        await fs.writeFile(intelPath, JSON.stringify(updatedIntel, null, 2), 'utf-8');
        requirementIntelligenceEngine.invalidateCache(meetingId, updatedIntel as any);
      } catch (err) {
        console.warn('[MeetingDocumentService] Transcript synthesis notice:', err);
      }
    }

    // 4. Gather decisions and changes
    const confirmedDecisions = await decisionStore.getDecisions(meetingId, projectId);
    const detectedChanges = await decisionStore.getChanges(meetingId, projectId);

    // 5. Generate post-meeting documentation bundle and follow-up
    const result = await postMeetingDocumentationEngine.generateDocuments({
      meetingId,
      projectId,
      meetingTitle,
      transcriptSegments: segments,
      candidateRequirements,
      issues,
      confirmedDecisions,
      detectedChanges,
      unresolvedQuestions: issues.map((i) => i.description).slice(0, 4),
      actionItems: [
        'Requirement Engineer to verify candidate requirements against scope',
        'Review Google SSO and access controls with security leads',
        'Review clothing catalog category hierarchy and filtering',
        'Customer to sign off on baseline draft',
      ],
    });

    // 6. Schedule follow-up calendar event if detected from transcript OR recommended by engine
    const shouldSchedule = detectedReschedule?.isRescheduled || result.followUp?.recommended;
    if (shouldSchedule) {
      try {
        let followUpDateStr: string;
        let followUpTitle: string;
        let followUpReason: string;
        let followUpAgenda: string[];

        if (detectedReschedule?.isRescheduled) {
          followUpDateStr = detectedReschedule.agreedDate;
          followUpTitle = detectedReschedule.suggestedTitle;
          followUpReason = detectedReschedule.reason;
          followUpAgenda = detectedReschedule.suggestedAgenda;
        } else {
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + 2); // default 2 days later
          followUpDateStr = nextDate.toISOString().split('T')[0];
          followUpTitle = `Follow-Up: ${meetingTitle}`;
          followUpReason = result.followUp.reason;
          followUpAgenda = result.followUp.suggestedAgenda;
        }

        const newMeetingId = `meeting-followup-${Date.now().toString(36)}`;

        await calendarStore.createEvent({
          meetingId: newMeetingId,
          linkedMeetingId: meetingId,
          projectId,
          title: followUpTitle,
          description: followUpReason,
          date: followUpDateStr,
          startTime: '10:00',
          endTime: '10:45',
          timezone: 'UTC',
          meetingMode: meeting?.mode || 'assisted',
          agenda: followUpAgenda,
          participants: meeting?.participants.map((p) => ({
            name: p.name,
            role: (p.role === 'engineer' || (p.role as string) === 'REQUIREMENT_ENGINEER'
              ? 'REQUIREMENT_ENGINEER'
              : p.role === 'agent' || (p.role as string) === 'SPEC_PILOT'
              ? 'SPEC_PILOT'
              : 'CUSTOMER') as 'CUSTOMER' | 'REQUIREMENT_ENGINEER' | 'SPEC_PILOT',
          })) || [
            { name: 'Requirement Engineer', role: 'REQUIREMENT_ENGINEER' },
            { name: 'Customer Stakeholder', role: 'CUSTOMER' },
          ],
          status: 'SCHEDULED',
        });

        // Also register in meetingStore so it appears in Timeline and can be joined
        await meetingStore.saveMeeting({
          id: newMeetingId,
          title: followUpTitle,
          mode: meeting?.mode || 'assisted',
          status: 'scheduled',
          projectId,
          createdAt: new Date().toISOString(),
          participants: meeting?.participants || [
            { id: 'eng-1', name: 'Requirement Engineer', role: 'engineer' },
            { id: 'cust-1', name: 'Customer Stakeholder', role: 'customer' },
          ],
          agenda: (followUpAgenda || []).map((topic, i) => ({
            id: `agenda-${i + 1}`,
            topic,
            completed: false,
          })),
        });
      } catch (err) {
        console.warn('[MeetingDocumentService] Follow-up scheduling notice:', err);
      }
    }

    // 7. Ensure meeting status is marked completed
    if (meeting && meeting.status !== 'completed') {
      meeting.status = 'completed';
      await meetingStore.saveMeeting(meeting);
    }

    return result.bundle;
  }

  /**
   * Signs off and officially approves the baseline requirements from a meeting,
   * promoting candidate requirements to approved and producing an official stamped baseline version.
   */
  public async signOffMeetingBaseline(
    meetingId: string,
    projectId: string = 'project-001',
    approvedBy: string = 'Lead Requirement Engineer'
  ): Promise<{ success: boolean; versionLabel: string; approvedCount: number }> {
    const meeting = await meetingStore.getMeeting(meetingId, projectId);
    const meetingTitle = meeting?.title || meetingId;

    const cleanId = meetingId.replace(/^meeting-/, '');
    const intelPath = path.join(
      process.cwd(),
      'data',
      'projects',
      projectId,
      'meetings',
      `meeting-${cleanId}-intelligence.json`
    );

    let candidates: CandidateRequirement[] = [];
    let fullIntel: any = null;
    try {
      const data = await fs.readFile(intelPath, 'utf-8');
      fullIntel = JSON.parse(data);
      candidates = fullIntel.candidateRequirements || [];
    } catch {}

    let approvedCount = 0;
    for (const req of candidates) {
      req.status = 'APPROVED';
      req.reviewedBy = approvedBy;
      req.reviewedAt = new Date().toISOString();
      await requirementVersionService.approveCandidateRequirement(
        req.id,
        req.requirementText,
        req.type === 'FUNCTIONAL' ? 'functional' : 'non_functional',
        projectId,
        approvedBy
      );
      approvedCount++;
    }

    if (fullIntel) {
      fullIntel.lastUpdated = new Date().toISOString();
      await fs.writeFile(intelPath, JSON.stringify(fullIntel, null, 2), 'utf-8');
    }

    const snapshot = await requirementVersionService.signOffBaseline(
      projectId,
      approvedBy,
      `Official Human Engineer Sign-Off for Meeting "${meetingTitle}"`
    );

    // Save baseline status on meeting
    if (meeting) {
      meeting.baselineApproved = true;
      meeting.baselineVersion = snapshot.versionLabel;
      meeting.baselineApprovedAt = new Date().toISOString();
      meeting.baselineApprovedBy = approvedBy;
      await meetingStore.saveMeeting(meeting);
    }

    // Regenerate document bundle to reflect approved baseline
    try {
      await this.generateDocumentsForMeeting(meetingId, projectId);
    } catch {}

    return {
      success: true,
      versionLabel: snapshot.versionLabel,
      approvedCount: Math.max(approvedCount, snapshot.requirements.length),
    };
  }

  /**
   * Generates a Phase-by-Phase printable HTML report for PDF export.
   */
  public generatePdfHtmlReport(
    bundle: MeetingDocumentBundle,
    meeting: Meeting | null,
    versions: RequirementBaselineVersion[]
  ): string {
    const title = bundle.meetingTitle || meeting?.title || 'Requirement Engineering Report';
    const date = new Date(bundle.generatedAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const latestVersion = versions[0]?.versionLabel || 'v1.0';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} — SpecPilot Engineering Specification PDF</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 15mm 20mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      line-height: 1.6;
      margin: 0;
      padding: 24px;
      background: #ffffff;
      font-size: 13px;
    }
    .no-print-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #ffffff;
      padding: 14px 22px;
      border-radius: 10px;
      margin-bottom: 28px;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.25);
    }
    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .version-tag {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      font-family: monospace;
    }
    .btn-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .print-btn {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: background 0.15s;
    }
    .print-btn:hover {
      background: #0369a1;
    }
    .approve-btn {
      background: #059669;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: background 0.15s;
    }
    .approve-btn:hover {
      background: #047857;
    }
    @media print {
      .no-print-bar {
        display: none !important;
      }
      body {
        padding: 0;
      }
      .page-break {
        page-break-after: always;
        break-after: page;
        height: 0;
        margin: 0;
      }
      .no-break {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      table, tr, .sign-off-card {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
    .report-header {
      border-bottom: 3px solid #0284c7;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 6px 0;
      letter-spacing: -0.02em;
    }
    .brand-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 16px 0;
      font-weight: 500;
    }
    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f8fafc;
      padding: 14px 18px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .meta-item strong {
      display: block;
      color: #64748b;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 3px;
      font-weight: 700;
    }
    .meta-item span {
      font-weight: 700;
      color: #0f172a;
      font-size: 12px;
    }
    .phase-badge {
      display: inline-block;
      background: #e0f2fe;
      color: #0369a1;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-top: 20px;
      margin-bottom: 8px;
      border: 1px solid #bae6fd;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin: 22px 0 12px 0;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 6px;
    }
    h2 {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
      margin-top: 14px;
      margin-bottom: 12px;
    }
    h3 {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin-top: 14px;
      margin-bottom: 8px;
    }
    h4 {
      font-size: 13px;
      font-weight: 600;
      color: #0369a1;
      margin-top: 12px;
      margin-bottom: 4px;
    }
    p, li {
      color: #334155;
      font-size: 13px;
      line-height: 1.6;
    }
    ul, ol {
      margin: 8px 0 14px 20px;
      padding: 0;
    }
    li {
      margin-bottom: 4px;
    }
    code {
      background: #f1f5f9;
      color: #0369a1;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      font-weight: 600;
    }
    pre {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      line-height: 1.5;
    }
    pre code {
      background: transparent;
      border: none;
      padding: 0;
      color: inherit;
    }
    blockquote {
      border-left: 4px solid #0284c7;
      background: #f8fafc;
      padding: 10px 16px;
      margin: 14px 0;
      color: #334155;
      border-radius: 0 6px 6px 0;
      font-style: italic;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 12px;
      background: #ffffff;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #cbd5e1;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 10px 14px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f1f5f9;
      font-weight: 700;
      color: #0f172a;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .sign-off-card {
      margin-top: 32px;
      padding: 18px 22px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
    }
    .sign-off-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 16px;
    }
    .sign-box {
      border-top: 1px dashed #94a3b8;
      padding-top: 8px;
      font-size: 11px;
      color: #64748b;
    }
    .footer {
      margin-top: 36px;
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>

  <div class="no-print-bar">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span class="brand-badge">⚡ SpecPilot RE</span>
      <span style="font-weight: 700; font-size: 13px;">Requirement Engineering Specification</span>
      <span class="version-tag">Baseline: ${latestVersion}</span>
      <span id="approval-status" style="font-size: 11px; color: #34d399; font-weight: 600;"></span>
    </div>
    <div class="btn-group">
      <button class="approve-btn" id="btn-approve" onclick="approveBaseline('${bundle.meetingId}', '${bundle.projectId}')">
        ✓ Sign-Off Baseline
      </button>
      <button class="print-btn" onclick="window.print()">
        🖨️ Print / Save as PDF
      </button>
    </div>
  </div>

  <div class="report-header">
    <div class="brand-title">${escapeHtml(title)}</div>
    <div class="brand-subtitle">Automated Post-Meeting Requirement Engineering Specification &bull; Living Baseline ${escapeHtml(latestVersion)}</div>
    <div class="metadata-grid">
      <div class="meta-item">
        <strong>Meeting ID</strong>
        <span>${escapeHtml(bundle.meetingId)}</span>
      </div>
      <div class="meta-item">
        <strong>Session Date</strong>
        <span>${escapeHtml(date)}</span>
      </div>
      <div class="meta-item">
        <strong>Baseline Version</strong>
        <span>${escapeHtml(latestVersion)}</span>
      </div>
      <div class="meta-item">
        <strong>Session Mode</strong>
        <span>${escapeHtml(meeting?.mode?.toUpperCase() || 'ASSISTED')}</span>
      </div>
    </div>
  </div>

  <!-- PHASE 1: Executive Summary -->
  <span class="phase-badge">Phase 1 &bull; Executive Meeting Summary</span>
  <h2>1. Meeting Summary &amp; Overview</h2>
  <div class="document-content">${renderMarkdown(bundle.summary)}</div>

  <div class="page-break"></div>

  <!-- PHASE 2: Requirements Specification -->
  <span class="phase-badge">Phase 2 &bull; Requirements Specification</span>
  <h2>2. Detailed Requirements Inventory</h2>
  <div class="document-content">${renderMarkdown(bundle.requirements)}</div>

  <div class="page-break"></div>

  <!-- PHASE 3: Confirmed Decisions & Changes -->
  <span class="phase-badge">Phase 3 &bull; Decisions &amp; Scope Tracking</span>
  <h2>3. Confirmed Architecture &amp; Product Decisions</h2>
  <div class="document-content">${renderMarkdown(bundle.decisions)}</div>

  <h2>4. Scope Mutations &amp; Change Log</h2>
  <div class="document-content">${renderMarkdown(bundle.changes)}</div>

  <div class="page-break"></div>

  <!-- PHASE 4: Traceability & Impact -->
  <span class="phase-badge">Phase 4 &bull; Traceability &amp; Verification</span>
  <h2>5. Requirement Traceability Matrix &amp; Action Items</h2>
  <div class="document-content">${renderMarkdown(bundle.traceability)}</div>

  <div class="page-break"></div>

  <!-- PHASE 5: Formal SRS Document -->
  <span class="phase-badge">Phase 5 &bull; Autonomous SRS Baseline</span>
  <h2>6. Software Requirements Specification (SRS)</h2>
  <div class="document-content">${renderMarkdown(bundle.srs)}</div>

  <!-- FORMAL SIGN-OFF & APPROVAL BLOCK -->
  <div class="sign-off-card no-break">
    <strong style="font-size: 13px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">7. Formal Sign-Off &amp; Engineering Approval</strong>
    <p style="margin: 4px 0 16px 0; font-size: 12px; color: #64748b;">
      By signing below, the undersigned parties acknowledge and confirm the requirement baseline captured above as the authoritative scope for the upcoming development sprint.
    </p>
    <div class="sign-off-grid">
      <div class="sign-box">
        <strong>Lead Requirement Engineer:</strong> ____________________________<br>
        <span style="font-size: 10px;">Date &amp; Signature</span>
      </div>
      <div class="sign-box">
        <strong>Customer Stakeholder / Product Owner:</strong> ____________________________<br>
        <span style="font-size: 10px;">Date &amp; Signature</span>
      </div>
    </div>
  </div>

  <div class="footer">
    SpecPilot Agentic Requirement Engineering Co-Pilot &bull; Generated on ${new Date().toISOString()} &bull; Baseline Version: ${latestVersion} &bull; Confidential
  </div>

  <script>
  async function approveBaseline(meetingId, projectId) {
    const btn = document.getElementById('btn-approve');
    const status = document.getElementById('approval-status');
    btn.disabled = true;
    btn.innerText = 'Signing off...';
    try {
      const res = await fetch('/api/meetings/' + meetingId + '/approve?projectId=' + projectId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'Lead Requirement Engineer' })
      });
      const data = await res.json();
      if (res.ok) {
        btn.innerText = '✓ Baseline Approved (' + (data.versionLabel || 'v2.0') + ')';
        btn.style.background = '#047857';
        status.innerText = '• Signed off by Lead Requirement Engineer';
        alert('Baseline officially approved and stamped as ' + (data.versionLabel || 'v2.0') + '!');
        setTimeout(() => window.location.reload(), 1200);
      } else {
        btn.disabled = false;
        btn.innerText = '✓ Sign-Off Baseline';
        alert('Failed: ' + (data.error || 'Server error'));
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerText = '✓ Sign-Off Baseline';
      alert('Approval error: ' + err.message);
    }
  }
  </script>

</body>
</html>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(md: string): string {
  if (!md) return '<p>No content recorded.</p>';
  try {
    return marked.parse(md, { gfm: true, breaks: true }) as string;
  } catch {
    return `<pre style="white-space: pre-wrap;">${escapeHtml(md)}</pre>`;
  }
}

export const meetingDocumentService = new MeetingDocumentService();

