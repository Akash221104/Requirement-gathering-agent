import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { requirementVersionService } from '@/features/requirements/services/requirement-version-service';
import { meetingStore } from '@/lib/storage/meeting-store';
import { calendarStore } from '@/lib/storage/calendar-store';
import { decisionStore } from '@/lib/storage/decision-store';
import type { RequirementQualityIssue, ClarificationQuestion, CandidateRequirement } from '@/types/requirement';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const cleanProjectId = projectId || 'project-001';

    // 1. Fetch all approved requirements and version history
    const approvedRequirements = await requirementVersionService.getBaseline(cleanProjectId);
    const versionHistory = await requirementVersionService.getVersionHistory(cleanProjectId);

    // 2. Fetch all meetings for this project (sorted oldest to newest for timeline)
    const allMeetings = await meetingStore.getMeetings(cleanProjectId);
    const sortedMeetings = [...allMeetings].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // 3. Fetch all calendar events (past and scheduled)
    const allEvents = await calendarStore.getEvents();
    const projectEvents = allEvents.filter(
      (e) => !e.projectId || e.projectId === cleanProjectId
    );

    // 4. Gather intelligence, candidate requirements, quality issues, and follow-up questions
    const meetingsDir = path.join(process.cwd(), 'data', 'projects', cleanProjectId, 'meetings');
    let allIssues: RequirementQualityIssue[] = [];
    let allQuestions: ClarificationQuestion[] = [];
    let allCandidates: CandidateRequirement[] = [];

    try {
      const files = await fs.readdir(meetingsDir);
      for (const file of files) {
        if (file.endsWith('-intelligence.json')) {
          try {
            const raw = await fs.readFile(path.join(meetingsDir, file), 'utf-8');
            const data = JSON.parse(raw);
            if (Array.isArray(data.issues)) allIssues.push(...data.issues);
            if (Array.isArray(data.clarificationQuestions)) allQuestions.push(...data.clarificationQuestions);
            if (Array.isArray(data.candidateRequirements)) allCandidates.push(...data.candidateRequirements);
          } catch {}
        }
      }
    } catch {}

    // Deduplicate issues by description
    const uniqueIssuesMap = new Map<string, RequirementQualityIssue>();
    for (const issue of allIssues) {
      if (!uniqueIssuesMap.has(issue.description)) {
        uniqueIssuesMap.set(issue.description, issue);
      }
    }

    // Deduplicate questions by question string
    const uniqueQuestionsMap = new Map<string, ClarificationQuestion>();
    for (const q of allQuestions) {
      if (!uniqueQuestionsMap.has(q.question)) {
        uniqueQuestionsMap.set(q.question, q);
      }
    }

    // 5. Gather knowledge base, evolution matrix, and living master SRS
    const { projectKnowledgeService } = await import('@/features/requirements/services/project-knowledge-service');
    const kb = await projectKnowledgeService.getProjectKnowledgeBase(cleanProjectId);
    const masterSrs = await projectKnowledgeService.generateMasterLivingSpecificationMarkdown(cleanProjectId);

    const latestVersion = kb.currentBaselineVersion || versionHistory[0]?.versionLabel || 'v1.0';

    return NextResponse.json({
      projectId: cleanProjectId,
      projectName: kb.projectName || 'Enterprise Requirement Elicitation Workspace',
      clientName: kb.clientName,
      clientContact: kb.clientContact,
      currentVersion: latestVersion,
      versions: versionHistory,
      approvedRequirements,
      candidateRequirements: allCandidates.length > 0 ? allCandidates : kb.allCandidateRequirements,
      qualityIssues: Array.from(uniqueIssuesMap.values()),
      followUpQuestions: Array.from(uniqueQuestionsMap.values()),
      timelineMeetings: sortedMeetings,
      calendarEvents: projectEvents,
      decisions: kb.allDecisions,
      changes: kb.allChanges,
      masterSrs,
      evolutionMatrix: kb.evolutionMatrix,
      meetingsChronology: kb.meetingsChronology,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve project details';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const cleanProjectId = projectId || 'project-001';
    const body = await req.json().catch(() => ({}));
    const approvedBy = body.approvedBy || 'Lead Requirement Engineer';
    const note = body.note || 'Official Human Engineer Baseline Approval for Project';

    const snapshot = await requirementVersionService.signOffBaseline(cleanProjectId, approvedBy, note);

    return NextResponse.json({
      success: true,
      versionLabel: snapshot.versionLabel,
      approvedCount: snapshot.requirements.length,
      snapshot,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sign off project baseline';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { projectStore } = await import('@/lib/storage/project-store');
    const deleted = await projectStore.deleteProject(projectId);
    return NextResponse.json({ success: true, deleted, projectId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


