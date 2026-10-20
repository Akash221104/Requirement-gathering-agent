import fs from 'fs/promises';
import path from 'path';
import type {
  CandidateRequirement,
  ClarificationQuestion,
  MeetingIntelligenceState,
  RequirementQualityIssue,
} from '@/types/requirement';
import type { IIntelligenceStore } from './types';

const DATA_DIR = path.join(process.cwd(), 'data', 'projects');

export class FileIntelligenceStore implements IIntelligenceStore {
  private getMeetingDirPath(projectId: string): string {
    return path.join(DATA_DIR, projectId, 'meetings');
  }

  private getIntelligenceFilePath(projectId: string, meetingId: string): string {
    const filename = meetingId.startsWith('meeting-')
      ? `${meetingId}-intelligence.json`
      : `meeting-${meetingId}-intelligence.json`;
    return path.join(this.getMeetingDirPath(projectId), filename);
  }

  async getIntelligence(
    meetingId: string,
    projectId: string = 'project-001'
  ): Promise<MeetingIntelligenceState | null> {
    const specificPath = this.getIntelligenceFilePath(projectId, meetingId);
    try {
      const content = await fs.readFile(specificPath, 'utf-8');
      return JSON.parse(content) as MeetingIntelligenceState;
    } catch {
      // Fallback search across all projects if needed
      try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const projects = await fs.readdir(DATA_DIR);
        for (const proj of projects) {
          const candidatePath = this.getIntelligenceFilePath(proj, meetingId);
          try {
            const content = await fs.readFile(candidatePath, 'utf-8');
            return JSON.parse(content) as MeetingIntelligenceState;
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

  async saveIntelligence(data: MeetingIntelligenceState): Promise<void> {
    const projectId = data.projectId || 'project-001';
    const dir = this.getMeetingDirPath(projectId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = this.getIntelligenceFilePath(projectId, data.meetingId);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async appendCandidate(
    meetingId: string,
    candidate: CandidateRequirement,
    projectId: string = 'project-001'
  ): Promise<void> {
    let state = await this.getIntelligence(meetingId, projectId);
    if (!state) {
      state = {
        meetingId,
        projectId,
        candidateRequirements: [],
        issues: [],
        clarificationQuestions: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    const idx = state.candidateRequirements.findIndex((c) => c.id === candidate.id);
    if (idx >= 0) {
      state.candidateRequirements[idx] = candidate;
    } else {
      state.candidateRequirements.push(candidate);
    }
    state.lastUpdated = new Date().toISOString();
    await this.saveIntelligence(state);
  }

  async appendIssue(
    meetingId: string,
    issue: RequirementQualityIssue,
    projectId: string = 'project-001'
  ): Promise<void> {
    let state = await this.getIntelligence(meetingId, projectId);
    if (!state) {
      state = {
        meetingId,
        projectId,
        candidateRequirements: [],
        issues: [],
        clarificationQuestions: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    const idx = state.issues.findIndex((i) => i.id === issue.id);
    if (idx >= 0) {
      state.issues[idx] = issue;
    } else {
      state.issues.push(issue);
    }
    state.lastUpdated = new Date().toISOString();
    await this.saveIntelligence(state);
  }

  async appendQuestion(
    meetingId: string,
    question: ClarificationQuestion,
    projectId: string = 'project-001'
  ): Promise<void> {
    let state = await this.getIntelligence(meetingId, projectId);
    if (!state) {
      state = {
        meetingId,
        projectId,
        candidateRequirements: [],
        issues: [],
        clarificationQuestions: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    const idx = state.clarificationQuestions.findIndex((q) => q.id === question.id);
    if (idx >= 0) {
      state.clarificationQuestions[idx] = question;
    } else {
      state.clarificationQuestions.push(question);
    }
    state.lastUpdated = new Date().toISOString();
    await this.saveIntelligence(state);
  }
}

export const intelligenceStore = new FileIntelligenceStore();
