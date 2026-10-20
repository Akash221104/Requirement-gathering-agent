import fs from 'fs/promises';
import path from 'path';
import type { Requirement, RequirementVersion, ChangeProposal } from '@/types/requirement';
import type { IRequirementStore } from './types';
import { getProjectsDir } from './data-dir';

export class FileRequirementStore implements IRequirementStore {
  private getProjectDir(projectId: string): string {
    return path.join(getProjectsDir(), projectId);
  }

  private getRequirementsPath(projectId: string): string {
    return path.join(this.getProjectDir(projectId), 'requirements.json');
  }

  private getChangesPath(projectId: string): string {
    return path.join(this.getProjectDir(projectId), 'changes.json');
  }

  async getRequirements(projectId: string = 'project-001'): Promise<Requirement[]> {
    try {
      const filePath = this.getRequirementsPath(projectId);
      const content = await fs.readFile(/*turbopackIgnore: true*/ filePath, 'utf-8');
      const data = JSON.parse(content);
      return Array.isArray(data) ? (data as Requirement[]) : [];
    } catch {
      // Gracefully return empty baseline if file does not exist
      return [];
    }
  }

  async getRequirement(id: string, projectId: string = 'project-001'): Promise<Requirement | null> {
    const list = await this.getRequirements(projectId);
    return list.find((r) => r.id === id) || null;
  }

  async saveRequirement(requirement: Requirement): Promise<void> {
    const projectId = requirement.projectId || 'project-001';
    const dir = this.getProjectDir(projectId);
    await fs.mkdir(dir, { recursive: true });

    const requirements = await this.getRequirements(projectId);
    const existingIndex = requirements.findIndex((r) => r.id === requirement.id);
    if (existingIndex >= 0) {
      requirements[existingIndex] = requirement;
    } else {
      requirements.push(requirement);
    }

    await fs.writeFile(
      this.getRequirementsPath(projectId),
      JSON.stringify(requirements, null, 2),
      'utf-8'
    );
  }

  async getVersions(requirementId: string, projectId: string = 'project-001'): Promise<RequirementVersion[]> {
    try {
      const filePath = path.join(this.getProjectDir(projectId), `req-${requirementId}-versions.json`);
      const content = await fs.readFile(/*turbopackIgnore: true*/ filePath, 'utf-8');
      return JSON.parse(content) as RequirementVersion[];
    } catch {
      return [];
    }
  }

  async saveVersion(version: RequirementVersion, projectId: string = 'project-001'): Promise<void> {
    const dir = this.getProjectDir(projectId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `req-${version.requirementId}-versions.json`);
    const versions = await this.getVersions(version.requirementId, projectId);
    versions.push(version);
    await fs.writeFile(filePath, JSON.stringify(versions, null, 2), 'utf-8');
  }

  async getChangeProposals(projectId: string = 'project-001'): Promise<ChangeProposal[]> {
    try {
      const content = await fs.readFile(/*turbopackIgnore: true*/ this.getChangesPath(projectId), 'utf-8');
      return JSON.parse(content) as ChangeProposal[];
    } catch {
      return [];
    }
  }

  async saveChangeProposal(proposal: ChangeProposal, projectId: string = 'project-001'): Promise<void> {
    const dir = this.getProjectDir(projectId);
    await fs.mkdir(dir, { recursive: true });
    const proposals = await this.getChangeProposals(projectId);
    const existingIndex = proposals.findIndex((p) => p.id === proposal.id);
    if (existingIndex >= 0) {
      proposals[existingIndex] = proposal;
    } else {
      proposals.push(proposal);
    }
    await fs.writeFile(this.getChangesPath(projectId), JSON.stringify(proposals, null, 2), 'utf-8');
  }
}

export const requirementStore = new FileRequirementStore();
