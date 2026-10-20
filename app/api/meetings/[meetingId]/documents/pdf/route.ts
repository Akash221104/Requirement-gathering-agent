import { NextRequest, NextResponse } from 'next/server';
import { meetingDocumentService } from '@/features/requirements/services/meeting-document-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const projectId = req.nextUrl.searchParams.get('projectId') || 'project-001';

    const { bundle, versions, meeting } = await meetingDocumentService.getOrGenerateDocuments(meetingId, projectId);
    const html = meetingDocumentService.generatePdfHtmlReport(bundle, meeting, versions);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate PDF report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
