import fs from 'fs/promises';
import path from 'path';
import type { Project } from '@/types/project';
import type { IProjectStore } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');

async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(PROJECTS_DIR, { recursive: true });
  } catch {}
}

export class FileProjectStore implements IProjectStore {
  async getProjects(): Promise<Project[]> {
    await ensureDataDir();
    try {
      const data = await fs.readFile(PROJECTS_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) {
        return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      return [];
    } catch {
      // Check subdirectories if file doesn't exist yet
      try {
        const dirs = await fs.readdir(PROJECTS_DIR);
        const projects: Project[] = [];
        for (const d of dirs) {
          try {
            const pData = await fs.readFile(path.join(PROJECTS_DIR, d, 'project.json'), 'utf-8');
            projects.push(JSON.parse(pData));
          } catch {}
        }
        return projects;
      } catch {
        return [];
      }
    }
  }

  async getProject(id: string): Promise<Project | null> {
    const list = await this.getProjects();
    const found = list.find((p) => p.id === id);
    if (found) return found;

    // Check project directory
    try {
      const pData = await fs.readFile(path.join(PROJECTS_DIR, id, 'project.json'), 'utf-8');
      return JSON.parse(pData) as Project;
    } catch {
      return null;
    }
  }

  async saveProject(project: Project): Promise<void> {
    await ensureDataDir();
    const list = await this.getProjects();
    const existingIdx = list.findIndex((p) => p.id === project.id);

    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...project, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(project);
    }

    // Save consolidated projects list
    await fs.writeFile(PROJECTS_FILE, JSON.stringify(list, null, 2), 'utf-8');

    // Also save in project folder
    const projDir = path.join(PROJECTS_DIR, project.id);
    await fs.mkdir(projDir, { recursive: true });
    await fs.writeFile(path.join(projDir, 'project.json'), JSON.stringify(project, null, 2), 'utf-8');
  }

  async deleteProject(id: string): Promise<boolean> {
    await ensureDataDir();
    const list = await this.getProjects();
    const filtered = list.filter((p) => p.id !== id);
    if (filtered.length === list.length) return false;

    await fs.writeFile(PROJECTS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');

    // Also remove project folder
    try {
      await fs.rm(path.join(PROJECTS_DIR, id), { recursive: true, force: true });
    } catch {}

    return true;
  }
}

export const projectStore = new FileProjectStore();
