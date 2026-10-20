import fs from 'fs/promises';
import path from 'path';
import type { Meeting } from '@/types/meeting';
import type { IMeetingStore } from './types';
import { getProjectsDir } from './data-dir';

export class FileMeetingStore implements IMeetingStore {
  private getMeetingDirPath(projectId: string): string {
    return path.join(getProjectsDir(), projectId, 'meetings');
  }

  private getMeetingFilePath(projectId: string, meetingId: string): string {
    const cleanId = meetingId.startsWith('meeting-') ? meetingId : `meeting-${meetingId}`;
    return path.join(this.getMeetingDirPath(projectId), `${cleanId}.json`);
  }

  async getMeetings(projectId: string = 'project-001'): Promise<Meeting[]> {
    const dir = this.getMeetingDirPath(projectId);
    try {
      await fs.mkdir(dir, { recursive: true });
      const files = await fs.readdir(dir);
      const meetingFiles = files.filter(
        (f) =>
          f.startsWith('meeting-') &&
          f.endsWith('.json') &&
          !f.endsWith('-transcript.json') &&
          !f.endsWith('-intelligence.json') &&
          !f.endsWith('-summary.json') &&
          !f.endsWith('-decisions.json') &&
          !f.endsWith('-documents.json') &&
          !f.endsWith('-autonomous.json')
      );

      const meetings: Meeting[] = [];
      for (const file of meetingFiles) {
        try {
          const content = await fs.readFile(path.join(dir, file), 'utf-8');
          const parsed = JSON.parse(content) as Meeting;
          if (parsed && parsed.id && typeof parsed.id === 'string' && parsed.id !== 'undefined') {
            meetings.push(parsed);
          }
        } catch {
          // Skip corrupt or locked files
        }
      }

      // Sort newest first
      return meetings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }

  async getMeeting(id: string, projectId: string = 'project-001'): Promise<Meeting | null> {
    const cleanId = id.startsWith('meeting-') ? id : `meeting-${id}`;
    // Check specific project path first (both clean and legacy)
    const candidates = [
      path.join(this.getMeetingDirPath(projectId), `${cleanId}.json`),
      path.join(this.getMeetingDirPath(projectId), `meeting-${cleanId}.json`),
    ];

    for (const p of candidates) {
      try {
        const content = await fs.readFile(/*turbopackIgnore: true*/ p, 'utf-8');
        return JSON.parse(content) as Meeting;
      } catch {
        // try next
      }
    }

    // Search across all projects if not found in primary
    try {
      const projectsDir = getProjectsDir();
      await fs.mkdir(projectsDir, { recursive: true });
      const projects = await fs.readdir(projectsDir);
      for (const proj of projects) {
        const projCandidates = [
          path.join(projectsDir, proj, 'meetings', `${cleanId}.json`),
          path.join(projectsDir, proj, 'meetings', `meeting-${cleanId}.json`),
        ];
        for (const p of projCandidates) {
          try {
            const content = await fs.readFile(/*turbopackIgnore: true*/ p, 'utf-8');
            return JSON.parse(content) as Meeting;
          } catch {
            continue;
          }
        }
      }
    } catch {
      // Fall through
    }
    return null;
  }

  async saveMeeting(meeting: Meeting): Promise<void> {
    const projectId = meeting.projectId || 'project-001';
    const dir = this.getMeetingDirPath(projectId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = this.getMeetingFilePath(projectId, meeting.id);
    await fs.writeFile(filePath, JSON.stringify(meeting, null, 2), 'utf-8');
  }

  async deleteMeeting(id: string, projectId: string = 'project-001'): Promise<boolean> {
    const cleanId = id.startsWith('meeting-') ? id : `meeting-${id}`;
    const dir = this.getMeetingDirPath(projectId);
    let deleted = false;

    // Direct files and variants
    const filePatterns = [
      `${cleanId}.json`,
      `meeting-${cleanId}.json`,
      `${id}.json`,
      `${cleanId}-transcript.json`,
      `meeting-${cleanId}-transcript.json`,
      `${id}-transcript.json`,
      `${cleanId}-intelligence.json`,
      `meeting-${cleanId}-intelligence.json`,
      `${id}-intelligence.json`,
      `${cleanId}-summary.json`,
      `meeting-${cleanId}-summary.json`,
      `${id}-summary.json`,
      `${cleanId}-decisions.json`,
      `meeting-${cleanId}-decisions.json`,
      `${id}-decisions.json`,
      `${cleanId}-documents.json`,
      `meeting-${cleanId}-documents.json`,
      `${id}-documents.json`,
      `${cleanId}-autonomous.json`,
      `meeting-${cleanId}-autonomous.json`,
      `${id}-autonomous.json`,
    ];

    for (const f of filePatterns) {
      try {
        await fs.unlink(path.join(dir, f));
        deleted = true;
      } catch {
        // file not present
      }
    }

    // Also remove document subfolder
    try {
      const docFolder1 = path.join(getProjectsDir(), projectId, 'documents', cleanId);
      const docFolder2 = path.join(getProjectsDir(), projectId, 'documents', `meeting-${cleanId}`);
      await fs.rm(docFolder1, { recursive: true, force: true });
      await fs.rm(docFolder2, { recursive: true, force: true });
    } catch {}

    // Clean up calendar events
    try {
      const { calendarStore } = await import('@/lib/storage/calendar-store');
      const events = await calendarStore.getEvents();
      for (const ev of events) {
        if (ev.meetingId === cleanId || ev.linkedMeetingId === cleanId || ev.meetingId === id) {
          await calendarStore.deleteEvent(ev.id);
        }
      }
    } catch {}

    return deleted;
  }
}

export const meetingStore = new FileMeetingStore();
