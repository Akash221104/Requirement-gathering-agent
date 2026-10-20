import fs from 'fs/promises';
import path from 'path';
import type { Requirement, RequirementCategory } from '@/types/requirement';
import type { RequirementBaselineVersion, RequirementChangeItem, MeetingDocumentBundle } from '@/types/documentation';

function getProjectDir(projectId: string = 'project-001'): string {
  return path.join(process.cwd(), 'data', 'projects', projectId);
}

function getVersionsDir(projectId: string = 'project-001'): string {
  return path.join(getProjectDir(projectId), 'requirements', 'versions');
}

export class RequirementVersionService {
  /**
   * Get current approved baseline requirements for a project.
   */
  public async getBaseline(projectId: string = 'project-001'): Promise<Requirement[]> {
    const filePath = path.join(getProjectDir(projectId), 'requirements.json');
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Get all baseline version snapshots.
   */
  public async getVersionHistory(projectId: string = 'project-001'): Promise<RequirementBaselineVersion[]> {
    const dir = getVersionsDir(projectId);
    try {
      await fs.mkdir(dir, { recursive: true });
      const files = await fs.readdir(dir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const versions: RequirementBaselineVersion[] = [];
      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(dir, file), 'utf-8');
          versions.push(JSON.parse(content));
        } catch {
          // ignore corrupted files
        }
      }

      return versions.sort((a, b) => b.versionNumber - a.versionNumber);
    } catch {
      return [];
    }
  }

  /**
   * Approve a candidate requirement into the official baseline.
   */
  public async approveCandidateRequirement(
    candidateId: string,
    requirementText: string,
    category: string,
    projectId: string = 'project-001',
    approvedBy: string = 'Requirement Engineer'
  ): Promise<{ requirement: Requirement; newVersion: RequirementBaselineVersion }> {
    const baseline = await this.getBaseline(projectId);
    const versions = await this.getVersionHistory(projectId);

    const nextVersionNum = (versions[0]?.versionNumber || 1) + 1;
    const now = new Date().toISOString();

    const formattedId = candidateId.startsWith('REQ-') ? candidateId : `REQ-${Date.now().toString(36).toUpperCase()}`;

    const cat = (category.toLowerCase() as RequirementCategory);
      const formattedCategory = cat || 'functional';
      const newReq: Requirement = {
        id: formattedId,
        projectId,
        title: requirementText.slice(0, 60).trim(),
        description: requirementText,
        category: formattedCategory,
      status: 'approved',
      priority: 'high',
      currentVersion: 1,
      createdAt: now,
      updatedAt: now,
    };

    baseline.push(newReq);

    // Write updated baseline
    await this.saveBaseline(baseline, projectId);

    // Create immutable version snapshot
    const snapshot: RequirementBaselineVersion = {
      versionNumber: nextVersionNum,
      versionLabel: `v1.${nextVersionNum - 1}`,
      projectId,
      approvedBy,
      timestamp: now,
      changeSummary: `Approved new requirement ${newReq.id}: "${newReq.title}"`,
      requirements: baseline.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        status: r.status,
        priority: r.priority,
        version: r.currentVersion,
        updatedAt: r.updatedAt,
      })),
    };

    await this.saveVersionSnapshot(snapshot, projectId);
    return { requirement: newReq, newVersion: snapshot };
  }

  /**
   * Approve a proposed change to an existing requirement.
   */
  public async approveRequirementChange(
    change: RequirementChangeItem,
    projectId: string = 'project-001',
    approvedBy: string = 'Requirement Engineer'
  ): Promise<{ updatedRequirement?: Requirement; newVersion: RequirementBaselineVersion }> {
    const baseline = await this.getBaseline(projectId);
    const versions = await this.getVersionHistory(projectId);
    const nextVersionNum = (versions[0]?.versionNumber || 1) + 1;
    const now = new Date().toISOString();

    let updatedReq: Requirement | undefined;

    if (change.requirementId) {
      const index = baseline.findIndex((r) => r.id === change.requirementId);
      if (index !== -1) {
        baseline[index] = {
          ...baseline[index],
          description: change.newText,
          currentVersion: baseline[index].currentVersion + 1,
          updatedAt: now,
        };
        updatedReq = baseline[index];
      }
    }

    if (!updatedReq) {
      // Treat as new requirement if requirementId was not found
      updatedReq = {
        id: `REQ-${Date.now().toString(36).toUpperCase()}`,
        projectId,
        title: change.newText.slice(0, 60).trim(),
        description: change.newText,
        category: 'functional',
        status: 'approved',
        priority: 'high',
        currentVersion: 1,
        createdAt: now,
        updatedAt: now,
      };
      baseline.push(updatedReq);
    }

    await this.saveBaseline(baseline, projectId);

    const snapshot: RequirementBaselineVersion = {
      versionNumber: nextVersionNum,
      versionLabel: `v1.${nextVersionNum - 1}`,
      projectId,
      approvedBy,
      timestamp: now,
      changeSummary: `Approved change: "${change.impactSummary || change.newText.slice(0, 50)}"`,
      requirements: baseline.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        status: r.status,
        priority: r.priority,
        version: r.currentVersion,
        updatedAt: r.updatedAt,
      })),
    };

    await this.saveVersionSnapshot(snapshot, projectId);
    return { updatedRequirement: updatedReq, newVersion: snapshot };
  }

  /**
   * Officially sign off and stamp a project baseline with human engineer approval.
   */
  public async signOffBaseline(
    projectId: string = 'project-001',
    approvedBy: string = 'Lead Requirement Engineer',
    note: string = 'Official Human Engineer Baseline Approval'
  ): Promise<RequirementBaselineVersion> {
    const baseline = await this.getBaseline(projectId);
    const versions = await this.getVersionHistory(projectId);
    const nextVersionNum = (versions[0]?.versionNumber || 1) + 1;
    const now = new Date().toISOString();

    const snapshot: RequirementBaselineVersion = {
      versionNumber: nextVersionNum,
      versionLabel: `v${Math.floor(nextVersionNum / 10) + 1}.0-Approved`,
      projectId,
      approvedBy,
      timestamp: now,
      changeSummary: note,
      requirements: baseline.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        status: 'approved',
        priority: r.priority,
        version: r.currentVersion,
        updatedAt: now,
      })),
    };

    await this.saveVersionSnapshot(snapshot, projectId);
    return snapshot;
  }

  private async saveBaseline(baseline: Requirement[], projectId: string): Promise<void> {
    const filePath = path.join(getProjectDir(projectId), 'requirements.json');
    await fs.writeFile(filePath, JSON.stringify(baseline, null, 2), 'utf-8');
  }

  private async saveVersionSnapshot(version: RequirementBaselineVersion, projectId: string): Promise<void> {
    const dir = getVersionsDir(projectId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `baseline-v${version.versionNumber}.json`);
    await fs.writeFile(filePath, JSON.stringify(version, null, 2), 'utf-8');
  }
}

export const requirementVersionService = new RequirementVersionService();
