import { NextRequest, NextResponse } from 'next/server';
import { meetingStore } from '@/lib/storage/meeting-store';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;
  const meeting = await meetingStore.getMeeting(meetingId);

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  return NextResponse.json(meeting);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const meeting = await meetingStore.getMeeting(meetingId);

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const updates = await req.json();
    const updatedMeeting = {
      ...meeting,
      ...updates,
      id: meeting.id, // Immutable ID
    };

    await meetingStore.saveMeeting(updatedMeeting);

    // Automatically generate documentation, baseline version, and follow-up when completed
    if (updates.status === 'completed') {
      import('@/features/requirements/services/meeting-document-service')
        .then(({ meetingDocumentService }) => {
          meetingDocumentService.generateDocumentsForMeeting(meetingId, updatedMeeting.projectId).catch((err) => {
            console.warn('[MeetingRoute] Auto document generation notice:', err);
          });
        })
        .catch(() => {});
    }

    return NextResponse.json(updatedMeeting);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update meeting';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const projectId = req.nextUrl.searchParams.get('projectId') || 'project-001';

    const deleted = await meetingStore.deleteMeeting(meetingId, projectId);
    return NextResponse.json({ success: true, deleted, meetingId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete meeting';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

