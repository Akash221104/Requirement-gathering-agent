import { NextRequest, NextResponse } from 'next/server';
import { projectStore } from '@/lib/storage/project-store';
import type { Project } from '@/types/project';

export async function GET() {
  try {
    const projects = await projectStore.getProjects();
    return NextResponse.json(projects);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list projects';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name || !body.clientName) {
      return NextResponse.json(
        { error: 'Project name and Client name are required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const id = body.id || `proj-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const newProject: Project = {
      id,
      name: body.name.trim(),
      clientName: body.clientName.trim(),
      clientContact: body.clientContact?.trim() || '',
      clientEmail: body.clientEmail?.trim() || '',
      description: body.description?.trim() || '',
      status: 'DISCOVERY',
      currentVersion: 'v1.0-Draft',
      createdAt: now,
      updatedAt: now,
    };

    await projectStore.saveProject(newProject);
    return NextResponse.json(newProject, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
