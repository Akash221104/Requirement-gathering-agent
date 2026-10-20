import { NextRequest, NextResponse } from 'next/server';
import { calendarStore } from '@/lib/storage/calendar-store';
import { generateIcsContent } from '@/lib/calendar/ics-generator';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const event = await calendarStore.getEventById(eventId);

    if (!event) {
      return NextResponse.json({ error: 'Calendar event not found' }, { status: 404 });
    }

    const icsContent = generateIcsContent(event);
    const filename = `meeting-${event.id}.ics`;

    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export ICS file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
