import { NextRequest, NextResponse } from 'next/server';
import { meetingStore } from '@/lib/storage/meeting-store';
import type { Meeting, MeetingMode } from '@/types/meeting';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId') || 'project-001';
  const meetings = await meetingStore.getMeetings(projectId);
  return NextResponse.json(meetings);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, mode, projectId = 'project-001' } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const meetingMode: MeetingMode = mode === 'autonomous' ? 'autonomous' : 'assisted';
    const meetingId = `meeting-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const newMeeting: Meeting = {
      id: meetingId,
      projectId,
      title: title.trim(),
      mode: meetingMode,
      meetingMode,
      speakingMode: meetingMode === 'assisted' ? 'SUGGEST' : undefined,
      status: 'scheduled',
      participants: [],
      agenda: [],
      createdAt: new Date().toISOString(),
    };

    await meetingStore.saveMeeting(newMeeting);
    return NextResponse.json(newMeeting, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create meeting';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
