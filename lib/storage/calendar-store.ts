import fs from 'fs/promises';
import path from 'path';
import type { CalendarEvent } from '@/types/calendar';
import { CalendarEventSchema } from '@/types/calendar';

const CALENDAR_DIR = path.join(process.cwd(), 'data', 'calendar');
const EVENTS_FILE = path.join(CALENDAR_DIR, 'events.json');

async function ensureCalendarDir(): Promise<void> {
  try {
    await fs.mkdir(CALENDAR_DIR, { recursive: true });
  } catch {
    // Already exists
  }
}

export class CalendarStore {
  /**
   * Get all calendar events.
   */
  public async getEvents(): Promise<CalendarEvent[]> {
    await ensureCalendarDir();
    try {
      const data = await fs.readFile(EVENTS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => {
          const dtA = `${a.date}T${a.startTime}`;
          const dtB = `${b.date}T${b.startTime}`;
          return dtA.localeCompare(dtB);
        });
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Get event by ID.
   */
  public async getEventById(id: string): Promise<CalendarEvent | null> {
    const events = await this.getEvents();
    return events.find((e) => e.id === id) || null;
  }

  /**
   * Get events linked to a meetingId.
   */
  public async getEventsByMeetingId(meetingId: string): Promise<CalendarEvent[]> {
    const events = await this.getEvents();
    return events.filter((e) => e.meetingId === meetingId || e.linkedMeetingId === meetingId);
  }

  /**
   * Save a new calendar event.
   */
  public async createEvent(eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<CalendarEvent> {
    await ensureCalendarDir();
    const events = await this.getEvents();

    const now = new Date().toISOString();

    // Check if an existing event for this linked meeting and date already exists
    const existingIndex = events.findIndex(
      (e) =>
        (e.linkedMeetingId && e.linkedMeetingId === eventData.linkedMeetingId && e.date === eventData.date) ||
        (e.meetingId === eventData.meetingId && e.date === eventData.date)
    );

    if (existingIndex >= 0) {
      const existing = events[existingIndex];
      const updated: CalendarEvent = {
        ...existing,
        ...eventData,
        id: existing.id,
        updatedAt: now,
      };
      CalendarEventSchema.parse(updated);
      events[existingIndex] = updated;
      await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf-8');
      return updated;
    }

    const id = eventData.id || `cal-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const newEvent: CalendarEvent = {
      ...eventData,
      id,
      projectId: eventData.projectId || 'project-001',
      description: eventData.description || '',
      timezone: eventData.timezone || 'UTC',
      agenda: eventData.agenda || [],
      status: eventData.status || 'SCHEDULED',
      createdAt: now,
      updatedAt: now,
    };

    // Validate with Zod
    CalendarEventSchema.parse(newEvent);

    events.push(newEvent);
    await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf-8');
    return newEvent;
  }

  /**
   * Update an existing event.
   */
  public async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | null> {
    await ensureCalendarDir();
    const events = await this.getEvents();
    const index = events.findIndex((e) => e.id === id);
    if (index === -1) return null;

    const updated: CalendarEvent = {
      ...events[index],
      ...updates,
      id, // Preserve ID
      updatedAt: new Date().toISOString(),
    };

    CalendarEventSchema.parse(updated);
    events[index] = updated;

    await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf-8');
    return updated;
  }

  /**
   * Delete an event.
   */
  public async deleteEvent(id: string): Promise<boolean> {
    await ensureCalendarDir();
    const events = await this.getEvents();
    const filtered = events.filter((e) => e.id !== id);
    if (filtered.length === events.length) return false;

    await fs.writeFile(EVENTS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
  }
}

export const calendarStore = new CalendarStore();
