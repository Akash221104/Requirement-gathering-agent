import fs from 'fs/promises';
import path from 'path';
import type { MeetingTranscriptData, TranscriptSegment } from '@/types/meeting';
import type { ITranscriptStore } from './types';

const DATA_DIR = path.join(process.cwd(), 'data', 'projects');

export class FileTranscriptStore implements ITranscriptStore {
  private getMeetingDirPath(projectId: string): string {
    return path.join(DATA_DIR, projectId, 'meetings');
  }

  private getTranscriptFilePath(projectId: string, meetingId: string): string {
    const filename = meetingId.startsWith('meeting-')
      ? `${meetingId}-transcript.json`
      : `meeting-${meetingId}-transcript.json`;
    return path.join(this.getMeetingDirPath(projectId), filename);
  }

  async getTranscript(meetingId: string, projectId: string = 'project-001'): Promise<MeetingTranscriptData | null> {
    const specificPath = this.getTranscriptFilePath(projectId, meetingId);
    try {
      const content = await fs.readFile(specificPath, 'utf-8');
      return JSON.parse(content) as MeetingTranscriptData;
    } catch {
      // Fallback search across all projects if needed
      try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const projects = await fs.readdir(DATA_DIR);
        for (const proj of projects) {
          const candidatePath = path.join(DATA_DIR, proj, 'meetings', `meeting-${meetingId}-transcript.json`);
          try {
            const content = await fs.readFile(candidatePath, 'utf-8');
            return JSON.parse(content) as MeetingTranscriptData;
          } catch {
            continue;
          }
        }
      } catch {
        // Fall through
      }
      return null;
    }
  }

  async saveTranscript(data: MeetingTranscriptData): Promise<void> {
    const projectId = data.projectId || 'project-001';
    const dir = this.getMeetingDirPath(projectId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = this.getTranscriptFilePath(projectId, data.meetingId);
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
