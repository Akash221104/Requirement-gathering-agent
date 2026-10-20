import { NextRequest, NextResponse } from 'next/server';
import { calendarStore } from '@/lib/storage/calendar-store';
import { buildGoogleCalendarUrl } from '@/lib/calendar/ics-generator';

export async function GET(req: NextRequest) {
  try {
    const meetingId = req.nextUrl.searchParams.get('meetingId');
    if (meetingId) {
      const events = await calendarStore.getEventsByMeetingId(meetingId);
      return NextResponse.json(events);
    }
    const events = await calendarStore.getEvents();
    return NextResponse.json(events);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch calendar events';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = await calendarStore.createEvent(body);
    const googleCalendarUrl = buildGoogleCalendarUrl(event);

    return NextResponse.json(
      {
        event,
        googleCalendarUrl,
        icsDownloadUrl: `/api/calendar/${event.id}/ics`,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create calendar event';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
