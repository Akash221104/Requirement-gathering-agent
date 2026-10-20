import type { CalendarEvent } from '@/types/calendar';

/**
 * Format date and time into UTC string for iCalendar (YYYYMMDDTHHmmssZ).
 */
function formatUtcTimestamp(dateStr: string, timeStr: string): string {
  try {
    const [hours, minutes] = timeStr.split(':').map((s) => parseInt(s, 10));
    const d = new Date(`${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00Z`);
    if (isNaN(d.getTime())) {
      const now = new Date();
      return now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  } catch {
    const now = new Date();
    return now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }
}

/**
 * Escape text for standard RFC 5545 .ics representation.
 */
function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generate standard RFC 5545 iCalendar (.ics) string.
 */
export function generateIcsContent(event: CalendarEvent): string {
  const dtStart = formatUtcTimestamp(event.date, event.startTime);
  const dtEnd = formatUtcTimestamp(event.date, event.endTime);
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const summary = escapeIcsText(event.title);
  const description = escapeIcsText(
    `${event.description || 'Requirement Engineering Meeting with SpecPilot AI'}\n\n` +
      `Meeting Mode: ${event.meetingMode.toUpperCase()}\n` +
      (event.agenda.length > 0 ? `Agenda:\n- ${event.agenda.join('\n- ')}\n\n` : '') +
      `Meeting ID: ${event.meetingId}`
  );

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SpecPilot//Requirement Engineering Co-Pilot//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@specpilot.ai`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `STATUS:${event.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

/**
 * Generate a pre-filled Google Calendar event URL.
 * Allows users to add the event directly without OAuth.
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const dtStart = formatUtcTimestamp(event.date, event.startTime);
  const dtEnd = formatUtcTimestamp(event.date, event.endTime);

  const text = encodeURIComponent(event.title);
  const details = encodeURIComponent(
    `${event.description || 'Requirement Engineering Meeting with SpecPilot AI'}\n\n` +
      `Meeting Mode: ${event.meetingMode.toUpperCase()}\n` +
      (event.agenda.length > 0 ? `Agenda:\n${event.agenda.map((a) => `• ${a}`).join('\n')}\n\n` : '') +
      `Meeting Room: /meetings/${event.meetingId}`
  );

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dtStart}/${dtEnd}&details=${details}`;
}

export const buildGoogleCalendarUrl = generateGoogleCalendarUrl;
