import { NextRequest, NextResponse } from 'next/server';
import { meetingDocumentService } from '@/features/requirements/services/meeting-document-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const projectId = req.nextUrl.searchParams.get('projectId') || 'project-001';
    const body = await req.json().catch(() => ({}));
    const approvedBy = body.approvedBy || 'Lead Requirement Engineer';

    const result = await meetingDocumentService.signOffMeetingBaseline(meetingId, projectId, approvedBy);

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to approve baseline';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
