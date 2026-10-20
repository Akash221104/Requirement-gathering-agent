import fs from 'fs/promises';
import path from 'path';
import type { MeetingTranscriptData, TranscriptSegment } from '@/types/meeting';
import type { ITranscriptStore } from './types';
import { getProjectsDir } from './data-dir';

export class FileTranscriptStore implements ITranscriptStore {
  private getMeetingDirPath(projectId: string): string {
    return path.join(getProjectsDir(), projectId, 'meetings');
  }

  private getTranscriptCandidates(projectId: string, meetingId: string): string[] {
    const cleanId = meetingId.replace(/^meeting-/, '');
    const dir = this.getMeetingDirPath(projectId);
    return [
      path.join(dir, `meeting-${cleanId}-transcript.json`),
      path.join(dir, `${cleanId}-transcript.json`),
      path.join(dir, `${meetingId}-transcript.json`),
    ];
  }

  async getTranscript(meetingId: string, projectId: string = 'project-001'): Promise<MeetingTranscriptData | null> {
    const candidates = this.getTranscriptCandidates(projectId, meetingId);
    for (const p of candidates) {
      try {
        const content = await fs.readFile(/*turbopackIgnore: true*/ p, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed) {
          if (Array.isArray(parsed)) {
            return {
              meetingId,
              projectId,
              segments: parsed,
              lastUpdated: new Date().toISOString(),
            };
          }
          return parsed as MeetingTranscriptData;
        }
      } catch {
        // try next candidate
      }
    }

    // Fallback search across all projects if needed
    try {
      const cleanId = meetingId.replace(/^meeting-/, '');
      const projectsDir = getProjectsDir();
      await fs.mkdir(projectsDir, { recursive: true });
      const projects = await fs.readdir(projectsDir);
      for (const proj of projects) {
        const projCandidates = [
          path.join(projectsDir, proj, 'meetings', `meeting-${cleanId}-transcript.json`),
          path.join(projectsDir, proj, 'meetings', `${cleanId}-transcript.json`),
          path.join(projectsDir, proj, 'meetings', `${meetingId}-transcript.json`),
        ];
        for (const candidatePath of projCandidates) {
          try {
            const content = await fs.readFile(/*turbopackIgnore: true*/ candidatePath, 'utf-8');
            const parsed = JSON.parse(content);
            if (parsed) {
              if (Array.isArray(parsed)) {
                return {
                  meetingId,
                  projectId: proj,
                  segments: parsed,
                  lastUpdated: new Date().toISOString(),
                };
              }
              return parsed as MeetingTranscriptData;
            }
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

  async saveTranscript(data: MeetingTranscriptData): Promise<void> {
    const projectId = data.projectId || 'project-001';
    const cleanId = data.meetingId.replace(/^meeting-/, '');
    const dir = this.getMeetingDirPath(projectId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `meeting-${cleanId}-transcript.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async appendSegment(meetingId: string, segment: TranscriptSegment, projectId: string = 'project-001'): Promise<void> {
    let transcript = await this.getTranscript(meetingId, projectId);
    if (!transcript) {
      transcript = {
        meetingId,
        projectId,
        segments: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    // Append only final segments or update if existing ID exists
    const existingIndex = transcript.segments.findIndex((s) => s.id === segment.id);
    if (existingIndex >= 0) {
      transcript.segments[existingIndex] = segment;
    } else {
      transcript.segments.push(segment);
    }

    transcript.lastUpdated = new Date().toISOString();
    await this.saveTranscript(transcript);
  }
}

export const transcriptStore = new FileTranscriptStore();
