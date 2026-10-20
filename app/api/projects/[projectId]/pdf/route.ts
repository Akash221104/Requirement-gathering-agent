import { NextRequest, NextResponse } from 'next/server';
import { projectKnowledgeService } from '@/features/requirements/services/project-knowledge-service';
import { requirementVersionService } from '@/features/requirements/services/requirement-version-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const cleanProjectId = projectId || 'project-001';

    const kb = await projectKnowledgeService.getProjectKnowledgeBase(cleanProjectId);
    const versionHistory = await requirementVersionService.getVersionHistory(cleanProjectId);

    const html = generateMasterPdfHtmlReport(kb, versionHistory);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate Master SRS PDF report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function generateMasterPdfHtmlReport(
  kb: import('@/features/requirements/services/project-knowledge-service').ProjectKnowledgeBase,
  versions: import('@/types/documentation').RequirementBaselineVersion[]
): string {
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Master Living SRS — ${escapeHtml(kb.projectName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    @page {
      size: A4;
      margin: 14mm 16mm 14mm 16mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 9px;
        color: #64748b;
        font-family: 'Inter', sans-serif;
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.6;
    }

    /* Print toolbar at top */
    .print-toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .print-toolbar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: -0.01em;
    }
    .print-toolbar-brand span.badge {
      background: #059669;
      color: #ffffff;
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .print-toolbar-actions {
      display: flex;
      gap: 10px;
    }
    .btn-print {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .btn-print:hover {
      background: #1d4ed8;
    }
    .btn-close {
      background: #334155;
      color: #e2e8f0;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .btn-close:hover {
      background: #475569;
    }

    .doc-container {
      max-width: 900px;
      margin: 24px auto;
      background: #ffffff;
      padding: 40px 48px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }

    @media print {
      body {
        background: #ffffff;
      }
      .print-toolbar {
        display: none !important;
      }
      .doc-container {
        max-width: 100%;
        margin: 0;
        padding: 0;
        border: none;
        box-shadow: none;
      }
      .page-break {
        break-before: page;
        page-break-before: always;
      }
      tr, .diff-card, .decision-item {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }

    /* Executive Header */
    .exec-header {
      border-bottom: 3px solid #059669;
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    .exec-pretitle {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #059669;
      margin-bottom: 4px;
    }
    .exec-title {
      font-size: 28px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 6px 0;
      letter-spacing: -0.02em;
    }
    .exec-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 16px 0;
    }

    /* Metadata Bar */
    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 14px 18px;
      border-radius: 8px;
    }
    .meta-box strong {
      display: block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 3px;
    }
    .meta-box span {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
    }

    /* Evolution KPI Ribbon */
    .kpi-ribbon {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin: 20px 0 28px 0;
    }
    .kpi-card {
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid;
    }
    .kpi-card.new {
      background: #ecfdf5;
      border-color: #a7f3d0;
      color: #065f46;
    }
    .kpi-card.updated {
      background: #fffbeb;
      border-color: #fde68a;
      color: #92400e;
    }
    .kpi-card.removed {
      background: #fff1f2;
      border-color: #fecdd3;
      color: #9f1239;
    }
    .kpi-card.stable {
      background: #ecfeff;
      border-color: #a5f3fc;
      color: #155e75;
    }
    .kpi-card .count {
      font-size: 22px;
      font-weight: 800;
      line-height: 1;
      margin-bottom: 4px;
    }
    .kpi-card .label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    /* Headings */
    h2.section-heading {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 6px;
      margin: 32px 0 16px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2.section-heading span.num {
      background: #0f172a;
      color: #ffffff;
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 4px;
      font-weight: 700;
    }

    /* Tables */
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 12px;
    }
    table.data-table thead th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 10px 12px;
      border: 1px solid #cbd5e1;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    table.data-table tbody td {
      padding: 9px 12px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
      vertical-align: top;
    }
    table.data-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
      border: 1px solid;
    }
    .badge.new {
      background: #d1fae5;
      color: #065f46;
      border-color: #6ee7b7;
    }
    .badge.updated {
      background: #fef3c7;
      color: #92400e;
      border-color: #fcd34d;
    }
    .badge.removed {
      background: #ffe4e6;
      color: #9f1239;
      border-color: #fda4af;
    }
    .badge.stable {
      background: #cffafe;
      color: #155e75;
      border-color: #67e8f9;
    }
    .badge.crit {
      background: #fecdd3;
      color: #9f1239;
      border-color: #fb7185;
    }
    .badge.high {
      background: #fed7aa;
      color: #9a3412;
      border-color: #fdba74;
    }
    .badge.med {
      background: #e2e8f0;
      color: #334155;
      border-color: #cbd5e1;
    }

    /* Diff Comparison Box */
    .diff-box {
      margin: 8px 0;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      font-size: 12px;
    }
    .diff-old {
      background: #fff1f2;
      color: #9f1239;
      padding: 8px 12px;
      border-bottom: 1px dashed #fecdd3;
      text-decoration: line-through;
    }
    .diff-new {
      background: #fffbeb;
      color: #92400e;
      padding: 8px 12px;
      font-weight: 600;
    }
    .diff-rationale {
      background: #f8fafc;
      color: #475569;
      padding: 6px 12px;
      font-size: 11px;
      border-top: 1px solid #e2e8f0;
      font-style: italic;
    }

    /* Decision list */
    .decision-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #059669;
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 10px;
    }
    .decision-item strong {
      color: #0f172a;
      font-size: 13px;
    }
    .decision-item .meta {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
    }

    /* Sign-off Box */
    .signoff-box {
      margin-top: 40px;
      border: 2px dashed #cbd5e1;
      padding: 24px;
      border-radius: 8px;
      background: #f8fafc;
    }
    .signoff-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 18px;
    }
    .signoff-field {
      border-bottom: 1px solid #94a3b8;
      padding-bottom: 6px;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>

  <!-- Print Toolbar (Hidden during actual print) -->
  <div class="print-toolbar">
    <div class="print-toolbar-brand">
      <span>SpecPilot Living SRS</span>
      <span class="badge">${escapeHtml(kb.currentBaselineVersion)}</span>
      <span style="color: #94a3b8; font-size: 12px;">&bull; Project: ${escapeHtml(kb.projectName)}</span>
    </div>
    <div class="print-toolbar-actions">
      <button onclick="window.print()" class="btn-print">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        Print / Save to PDF
      </button>
      <button onclick="window.close()" class="btn-close">Close Window</button>
    </div>
  </div>

  <div class="doc-container">

    <!-- Executive Header -->
    <div class="exec-header">
      <div class="exec-pretitle">Enterprise Requirements Specification &bull; Continuous Single Source of Truth</div>
      <h1 class="exec-title">${escapeHtml(kb.projectName.toUpperCase())}</h1>
      <p class="exec-subtitle">Master Living Software Requirements Specification (SRS) &bull; Autonomously compiled and maintained by SpecPilot AI</p>

      <div class="metadata-grid">
        <div class="meta-box">
          <strong>Client Stakeholder</strong>
          <span>${escapeHtml(kb.clientName)}</span>
        </div>
        <div class="meta-box">
          <strong>Baseline Version</strong>
          <span style="color: #059669;">${escapeHtml(kb.currentBaselineVersion)}</span>
        </div>
        <div class="meta-box">
          <strong>Date Generated</strong>
          <span>${dateStr}</span>
        </div>
        <div class="meta-box">
          <strong>Discovery Sessions</strong>
          <span>${kb.meetingsChronology.length} Meetings</span>
        </div>
      </div>
    </div>

    <!-- KPI Ribbon -->
    <div class="kpi-ribbon">
      <div class="kpi-card new">
        <div class="count">+${newCount}</div>
        <div class="label">New Points</div>
      </div>
      <div class="kpi-card updated">
        <div class="count">↻ ${updatedCount}</div>
        <div class="label">Updated Diffs</div>
      </div>
      <div class="kpi-card removed">
        <div class="count">- ${removedCount}</div>
        <div class="label">Removed Scope</div>
      </div>
      <div class="kpi-card stable">
        <div class="count">✓ ${stableCount}</div>
        <div class="label">Stable Baseline</div>
      </div>
    </div>

    <!-- Section 1: Executive Overview -->
    <h2 class="section-heading"><span class="num">1</span> Executive Purpose &amp; Overview</h2>
    <p>${escapeHtml(kb.description || 'Continuous software requirements elicitation and living architectural specification.')}</p>

    <!-- Meeting Cadence Table -->
    <h3 style="font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 18px; margin-bottom: 8px;">Meeting Discovery Journey</h3>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 80px;">Session</th>
          <th style="width: 140px;">Title &amp; Date</th>
          <th style="width: 90px;">Mode</th>
          <th>Summary &amp; Key Discoveries</th>
        </tr>
      </thead>
      <tbody>
        ${
          kb.meetingsChronology.length > 0
            ? kb.meetingsChronology
                .map(
                  (m) => `
          <tr>
            <td><strong>#${m.meetingNumber}</strong></td>
            <td><strong>${escapeHtml(m.title)}</strong><br/><span style="color:#64748b; font-size:11px;">${m.date}</span></td>
            <td><span class="badge ${m.mode === 'autonomous' ? 'stable' : 'updated'}">${escapeHtml(m.mode)}</span></td>
            <td>${escapeHtml(m.summaryText || 'Requirement elicitation and discussion')}</td>
          </tr>`
                )
                .join('')
            : '<tr><td colspan="4">No discovery meetings recorded yet.</td></tr>'
        }
      </tbody>
    </table>

    <div class="page-break"></div>

    <!-- Section 2: Requirement Evolution & Diffs -->
    <h2 class="section-heading"><span class="num">2</span> Requirement Evolution &amp; Mutation Audit Trail</h2>
    <p>This section maintains audit traceability for all requirement modifications across meeting sessions, preserving superseded text with strikethrough styling.</p>

    ${
      kb.evolutionMatrix.filter((e) => e.evolutionType === 'UPDATED' || e.evolutionType === 'REMOVED' || e.evolutionType === 'NEW').length > 0
        ? kb.evolutionMatrix
            .filter((e) => e.evolutionType === 'UPDATED' || e.evolutionType === 'REMOVED' || e.evolutionType === 'NEW')
            .map((item) => {
              if (item.evolutionType === 'UPDATED') {
                return `
        <div class="diff-card" style="margin-bottom: 14px; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; background: #fffdf5;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-family: monospace; font-weight: 700; font-size: 12px; color: #92400e;">${escapeHtml(item.id)}</span>
            <span class="badge updated">↻ UPDATED in Meeting #${item.originMeetingNumber || 1}</span>
          </div>
          <div class="diff-box">
            ${item.previousText ? `<div class="diff-old"><strong>Previous:</strong> "${escapeHtml(item.previousText)}"</div>` : ''}
            <div class="diff-new"><strong>Updated Specification:</strong> "${escapeHtml(item.currentText)}"</div>
            ${item.changeRationale ? `<div class="diff-rationale"><strong>Rationale:</strong> ${escapeHtml(item.changeRationale)}</div>` : ''}
          </div>
        </div>`;
              } else if (item.evolutionType === 'REMOVED') {
                return `
        <div class="diff-card" style="margin-bottom: 14px; border: 1px solid #fecdd3; border-radius: 8px; padding: 12px; background: #fff5f5;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-family: monospace; font-weight: 700; font-size: 12px; color: #9f1239;">${escapeHtml(item.id)}</span>
            <span class="badge removed">- REMOVED / OUT OF SCOPE</span>
          </div>
          <p style="text-decoration: line-through; color: #9f1239; margin: 4px 0;">"${escapeHtml(item.currentText)}"</p>
          <div style="font-size: 11px; color: #be123c; font-style: italic;">Note: ${escapeHtml(item.changeRationale || 'Marked out of scope')}</div>
        </div>`;
              } else {
                return `
        <div class="diff-card" style="margin-bottom: 14px; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; background: #f0fdf4;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-family: monospace; font-weight: 700; font-size: 12px; color: #065f46;">${escapeHtml(item.id)}</span>
            <span class="badge new">+ NEW in Meeting #${item.originMeetingNumber || 1}</span>
          </div>
          <p style="color: #065f46; font-weight: 600; margin: 4px 0;">"${escapeHtml(item.currentText)}"</p>
        </div>`;
              }
            })
            .join('')
        : '<p style="color: #64748b; font-style: italic;">Baseline requirements are completely stable with zero mutations recorded.</p>'
    }

    <!-- Section 3: Functional Requirements -->
    <h2 class="section-heading"><span class="num">3</span> Functional Requirements (FR) Specification</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 80px;">Req ID</th>
          <th style="width: 100px;">Evolution</th>
          <th>Requirement Specification</th>
          <th style="width: 75px;">Priority</th>
          <th style="width: 85px;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${
          functional.length > 0
            ? functional
                .map((r) => {
                  let evBadge = '';
                  if (r.evolutionType === 'NEW') evBadge = `<span class="badge new">+ NEW</span>`;
                  else if (r.evolutionType === 'UPDATED') evBadge = `<span class="badge updated">↻ UPDATED</span>`;
                  else if (r.evolutionType === 'REMOVED') evBadge = `<span class="badge removed">- REMOVED</span>`;
                  else evBadge = `<span class="badge stable">✓ STABLE</span>`;

                  const priClass = r.priority === 'critical' ? 'crit' : r.priority === 'high' ? 'high' : 'med';

                  return `
          <tr>
            <td><code style="font-weight: 700;">${escapeHtml(r.id)}</code></td>
            <td>${evBadge}</td>
            <td>
              ${r.evolutionType === 'REMOVED' ? `<span style="text-decoration: line-through; color: #9f1239;">${escapeHtml(r.currentText)}</span>` : `<strong>${escapeHtml(r.currentText)}</strong>`}
              ${r.previousText && r.evolutionType === 'UPDATED' ? `<br/><span style="font-size: 11px; color: #64748b; text-decoration: line-through;">Superseded: "${escapeHtml(r.previousText)}"</span>` : ''}
            </td>
            <td><span class="badge ${priClass}">${escapeHtml(r.priority)}</span></td>
            <td><strong>${escapeHtml(r.status)}</strong></td>
          </tr>`;
                })
                .join('')
            : '<tr><td colspan="5">No functional requirements recorded yet.</td></tr>'
        }
      </tbody>
    </table>

    <div class="page-break"></div>

    <!-- Section 4: Non-Functional & Security Requirements -->
    <h2 class="section-heading"><span class="num">4</span> Non-Functional &amp; Quality Attributes (NFR)</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 90px;">Req ID</th>
          <th style="width: 90px;">Category</th>
          <th>Specification &amp; Quality Attribute</th>
          <th style="width: 75px;">Priority</th>
          <th style="width: 85px;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${
          nonFunctional.length > 0
            ? nonFunctional
                .map((r) => {
                  const priClass = r.priority === 'critical' ? 'crit' : r.priority === 'high' ? 'high' : 'med';
                  return `
          <tr>
            <td><code style="font-weight: 700;">${escapeHtml(r.id)}</code></td>
            <td><span class="badge med">${escapeHtml(r.category)}</span></td>
            <td>${escapeHtml(r.currentText)}</td>
            <td><span class="badge ${priClass}">${escapeHtml(r.priority)}</span></td>
            <td><strong>${escapeHtml(r.status)}</strong></td>
          </tr>`;
                })
                .join('')
            : `
          <tr>
            <td><code>REQ-SEC-001</code></td>
            <td><span class="badge med">SECURITY</span></td>
            <td>Authentication and role-based access control must be strictly enforced across all client APIs.</td>
            <td><span class="badge crit">CRITICAL</span></td>
            <td><strong>APPROVED</strong></td>
          </tr>`
        }
      </tbody>
    </table>

    <!-- Section 5: Architectural Decisions -->
    <h2 class="section-heading"><span class="num">5</span> Confirmed Architectural Decisions Across All Meetings</h2>
    ${
      kb.allDecisions.length > 0
        ? kb.allDecisions
            .map(
              (d, i) => `
      <div class="decision-item">
        <strong>${i + 1}. ${escapeHtml(d.topic)}:</strong> ${escapeHtml(d.decision)}
        <div class="meta">&bull; Confirmed by: <strong>${escapeHtml(d.confirmedBy)}</strong> in session <code>${escapeHtml(d.meetingId)}</code></div>
      </div>`
            )
            .join('')
        : '<p style="color: #64748b; font-style: italic;">No formal architectural decisions recorded yet.</p>'
    }

    <!-- Official Sign-off Box -->
    <div class="signoff-box">
      <div style="font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a;">
        Formal Engineering &amp; Client Baseline Sign-Off
      </div>
      <p style="font-size: 12px; color: #475569; margin: 4px 0 16px 0;">
        By signing below, the lead requirement engineer and client stakeholder certify that the requirements documented herein accurately represent the agreed product scope for version <strong>${escapeHtml(kb.currentBaselineVersion)}</strong>.
      </p>

      <div class="signoff-grid">
        <div class="signoff-field">
          <strong>Lead Requirement Engineer Signature:</strong>
          <div style="height: 35px;"></div>
          <span>Date: ________________________</span>
        </div>
        <div class="signoff-field">
          <strong>Client Stakeholder (${escapeHtml(kb.clientName)}):</strong>
          <div style="height: 35px;"></div>
          <span>Date: ________________________</span>
        </div>
      </div>
    </div>

  </div>

</body>
</html>`;
}

function escapeHtml(str: string = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
