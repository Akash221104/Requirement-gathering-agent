import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { meetingDocumentService } from '@/features/requirements/services/meeting-document-service';
import { requirementIntelligenceEngine } from '@/features/requirements/services/requirement-intelligence';
import { meetingStore } from '@/lib/storage/meeting-store';
import { getProjectsDir } from '@/lib/storage/data-dir';

/**
 * POST /api/meetings/[meetingId]/reanalyze
 * Forces a fresh transcript synthesis + document generation pass for an existing meeting.
 * Useful for meetings that completed before the transcript synthesizer was available,
 * or when re-running after fixing LLM provider issues.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const requestedProjectId = req.nextUrl.searchParams.get('projectId') || 'project-001';

    // Resolve true projectId from meeting record if possible
    const meeting = await meetingStore.getMeeting(meetingId, requestedProjectId);
    const projectId = meeting?.projectId || requestedProjectId;

    console.log(`[Reanalyze] Starting forced re-analysis for meeting ${meetingId} in project ${projectId}`);

    const bundle = await meetingDocumentService.generateDocumentsForMeeting(
      meetingId,
      projectId,
      true // forceReanalyze = true
    );

    // Read the intelligence file to get exact count of extracted requirements
    let reqCount = 0;
    let freshState: any = null;
    const cleanId = meetingId.replace(/^meeting-/, '');
    const intelCandidates = [
      path.join(getProjectsDir(), projectId, 'meetings', `meeting-${cleanId}-intelligence.json`),
      path.join(getProjectsDir(), projectId, 'meetings', `${cleanId}-intelligence.json`),
      path.join(getProjectsDir(), projectId, 'meetings', `${meetingId}-intelligence.json`),
    ];

    for (const intelPath of intelCandidates) {
      try {
        const raw = await fs.readFile(/*turbopackIgnore: true*/ intelPath, 'utf-8');
        freshState = JSON.parse(raw);
        if (freshState && Array.isArray(freshState.candidateRequirements)) {
          reqCount = freshState.candidateRequirements.length;
          break;
        }
      } catch {}
    }

    // Invalidate the in-memory activeStates cache so next GET /intelligence reads fresh data
    if (freshState) {
      requirementIntelligenceEngine.invalidateCache(meetingId, freshState);
    }

    console.log(`[Reanalyze] Complete — ${reqCount} requirements extracted for meeting ${meetingId}`);

    return NextResponse.json(
      {
        success: true,
        meetingId,
        projectId,
        requirementsExtracted: reqCount,
        generatedAt: bundle.generatedAt,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Reanalysis failed';
    console.error('[Reanalyze] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
