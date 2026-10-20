import fs from 'fs/promises';
import path from 'path';
import type { RequirementDecisionItem, RequirementChangeItem, MeetingDocumentBundle } from '@/types/documentation';
import { getProjectsDir } from './data-dir';

function getMeetingsDir(projectId: string = 'project-001'): string {
  return path.join(getProjectsDir(), projectId, 'meetings');
}

export class DecisionStore {
  /**
   * Save confirmed decisions for a meeting.
   */
  public async saveDecisions(meetingId: string, decisions: RequirementDecisionItem[], projectId: string = 'project-001'): Promise<void> {
    const dir = getMeetingsDir(projectId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `meeting-${meetingId}-decisions.json`);
    await fs.writeFile(filePath, JSON.stringify(decisions, null, 2), 'utf-8');
  }

  /**
   * Get confirmed decisions for a meeting.
   */
  public async getDecisions(meetingId: string, projectId: string = 'project-001'): Promise<RequirementDecisionItem[]> {
    const filePath = path.join(getMeetingsDir(projectId), `meeting-${meetingId}-decisions.json`);
    try {
      const data = await fs.readFile(/*turbopackIgnore: true*/ filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Save detected requirement changes for a meeting.
   */
  public async saveChanges(meetingId: string, changes: RequirementChangeItem[], projectId: string = 'project-001'): Promise<void> {
    const dir = getMeetingsDir(projectId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `meeting-${meetingId}-changes.json`);
    await fs.writeFile(filePath, JSON.stringify(changes, null, 2), 'utf-8');
  }

  /**
   * Get detected requirement changes for a meeting.
   */
  public async getChanges(meetingId: string, projectId: string = 'project-001'): Promise<RequirementChangeItem[]> {
    const filePath = path.join(getMeetingsDir(projectId), `meeting-${meetingId}-changes.json`);
    try {
      const data = await fs.readFile(/*turbopackIgnore: true*/ filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Save meeting summary JSON.
   */
  public async saveSummary(
    meetingId: string,
    summary: {
      meetingId: string;
      title: string;
      summary: string;
      completedAt: string;
      keyDecisionsCount: number;
      candidateRequirementsCount: number;
      unresolvedQuestionsCount: number;
    },
    projectId: string = 'project-001'
  ): Promise<void> {
    const dir = getMeetingsDir(projectId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `meeting-${meetingId}-summary.json`);
    await fs.writeFile(filePath, JSON.stringify(summary, null, 2), 'utf-8');
  }

  /**
   * Get meeting summary JSON.
   */
  public async getSummary(meetingId: string, projectId: string = 'project-001'): Promise<MeetingDocumentBundle | null> {
    const filePath = path.join(getMeetingsDir(projectId), `meeting-${meetingId}-summary.json`);
    try {
      const data = await fs.readFile(/*turbopackIgnore: true*/ filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}

export const decisionStore = new DecisionStore();
