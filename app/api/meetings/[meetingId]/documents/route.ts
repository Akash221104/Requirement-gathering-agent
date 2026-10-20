import { NextRequest, NextResponse } from 'next/server';
import { meetingDocumentService } from '@/features/requirements/services/meeting-document-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const projectId = req.nextUrl.searchParams.get('projectId') || 'project-001';

    const result = await meetingDocumentService.getOrGenerateDocuments(meetingId, projectId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve documents';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const projectId = req.nextUrl.searchParams.get('projectId') || 'project-001';

    const bundle = await meetingDocumentService.generateDocumentsForMeeting(meetingId, projectId);
    return NextResponse.json(bundle, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate documents';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
