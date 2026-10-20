import { NextRequest, NextResponse } from 'next/server';
import { conversationManager } from '@/features/meeting/conversation/conversation-manager';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const projectId = req.nextUrl.searchParams.get('projectId') || 'project-001';

    // Get current segments (committed final + active interim)
    let segments = conversationManager.getSegments(meetingId, projectId);

    // If memory is empty (e.g. server restart), load from disk
    if (segments.length === 0) {
      const persisted = await conversationManager.getPersistedTranscript(meetingId, projectId);
      if (persisted && persisted.segments) {
        segments = persisted.segments;
      }
    }

    return NextResponse.json({
      meetingId,
      projectId,
      segments,
      count: segments.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch transcript';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
