import fs from 'fs/promises';
import path from 'path';
import type { MeetingDocumentBundle } from '@/types/documentation';
import { getProjectsDir } from './data-dir';

function getCleanMeetingId(id: string): string {
  return id.replace(/^meeting-/, '');
}

function getDocumentsDir(projectId: string, meetingId: string): string {
  return path.join(getProjectsDir(), projectId, 'documents', `meeting-${getCleanMeetingId(meetingId)}`);
}

function getMeetingsDir(projectId: string): string {
  return path.join(getProjectsDir(), projectId, 'meetings');
}

export class DocumentStore {
  /**
   * Save all generated markdown documents and JSON bundle.
   */
  public async saveDocuments(bundle: MeetingDocumentBundle): Promise<void> {
    const docDir = getDocumentsDir(bundle.projectId, bundle.meetingId);
    await fs.mkdir(docDir, { recursive: true });

    // Save individual markdown files
    await fs.writeFile(path.join(docDir, 'summary.md'), bundle.summary, 'utf-8');
    await fs.writeFile(path.join(docDir, 'requirements.md'), bundle.requirements, 'utf-8');
    await fs.writeFile(path.join(docDir, 'decisions.md'), bundle.decisions, 'utf-8');
    await fs.writeFile(path.join(docDir, 'changes.md'), bundle.changes, 'utf-8');
    await fs.writeFile(path.join(docDir, 'traceability.md'), bundle.traceability, 'utf-8');
    await fs.writeFile(path.join(docDir, 'srs.md'), bundle.srs, 'utf-8');

    // Save consolidated JSON bundle in meetings folder
    const cleanId = getCleanMeetingId(bundle.meetingId);
    const meetingsDir = getMeetingsDir(bundle.projectId);
    await fs.mkdir(meetingsDir, { recursive: true });
    await fs.writeFile(
      path.join(meetingsDir, `meeting-${cleanId}-documents.json`),
      JSON.stringify(bundle, null, 2),
      'utf-8'
    );
  }

  /**
   * Retrieve document bundle for a meeting.
   */
  public async getDocuments(meetingId: string, projectId: string = 'project-001'): Promise<MeetingDocumentBundle | null> {
    const cleanId = getCleanMeetingId(meetingId);
    // Try consolidated JSON first
    const bundlePath = path.join(getMeetingsDir(projectId), `meeting-${cleanId}-documents.json`);
    try {
      const data = await fs.readFile(/*turbopackIgnore: true*/ bundlePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      // Fallback: read individual markdown files
      const docDir = getDocumentsDir(projectId, meetingId);
      try {
        const [summary, srs, requirements, decisions, changes, traceability] = await Promise.all([
          fs.readFile(path.join(docDir, 'summary.md'), 'utf-8').catch(() => ''),
          fs.readFile(path.join(docDir, 'srs.md'), 'utf-8').catch(() => ''),
          fs.readFile(path.join(docDir, 'requirements.md'), 'utf-8').catch(() => ''),
          fs.readFile(path.join(docDir, 'decisions.md'), 'utf-8').catch(() => ''),
          fs.readFile(path.join(docDir, 'changes.md'), 'utf-8').catch(() => ''),
          fs.readFile(path.join(docDir, 'traceability.md'), 'utf-8').catch(() => ''),
        ]);

        if (!summary && !srs) return null;

        return {
          meetingId,
          projectId,
          meetingTitle: `Meeting ${cleanId}`,
          summary,
          srs,
          requirements,
          decisions,
          changes,
          traceability,
          openQuestions: [],
          actionItems: [],
          impactAnalysis: '',
          generatedAt: new Date().toISOString(),
        };
      } catch {
        return null;
      }
    }
  }
}

export const documentStore = new DocumentStore();
