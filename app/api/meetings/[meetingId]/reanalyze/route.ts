import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { meetingDocumentService } from '@/features/requirements/services/meeting-document-service';
import { requirementIntelligenceEngine } from '@/features/requirements/services/requirement-intelligence';

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
    const projectId = req.nextUrl.searchParams.get('projectId') || 'project-001';

    console.log(`[Reanalyze] Starting forced re-analysis for meeting ${meetingId} in project ${projectId}`);

    const bundle = await meetingDocumentService.generateDocumentsForMeeting(
      meetingId,
      projectId,
      true // forceReanalyze = true
    );

    // Read the intelligence file to get exact count of extracted requirements
    let reqCount = 0;
    let freshState: any = null;
    try {
      const cleanId = meetingId.replace(/^meeting-/, '');
      const intelPath = path.join(
        process.cwd(), 'data', 'projects', projectId, 'meetings',
        `meeting-${cleanId}-intelligence.json`
      );
      freshState = JSON.parse(await fs.readFile(intelPath, 'utf-8'));
      reqCount = (freshState.candidateRequirements || []).length;
    } catch {}

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
