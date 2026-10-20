import { NextRequest, NextResponse } from 'next/server';
import { intelligenceStore } from '@/lib/storage/intelligence-store';
import { requirementIntelligenceEngine } from '@/features/requirements/services/requirement-intelligence';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const projectId = req.nextUrl.searchParams.get('projectId') || 'project-001';

    // 1. Get persisted intelligence directly from disk
    const persisted = await intelligenceStore.getIntelligence(meetingId, projectId);

    // 2. Fallback to in-memory active state if meeting is live
    let state = persisted;
    if (!state || (state.candidateRequirements?.length === 0)) {
      const memoryState = await requirementIntelligenceEngine.getIntelligenceState(meetingId, projectId);
      if (memoryState && (memoryState.candidateRequirements?.length || 0) > (state?.candidateRequirements?.length || 0)) {
        state = memoryState;
      }
    }

    if (!state) {
      state = {
        meetingId,
        projectId,
        candidateRequirements: [],
        issues: [],
        clarificationQuestions: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    return NextResponse.json(state, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch meeting intelligence';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
