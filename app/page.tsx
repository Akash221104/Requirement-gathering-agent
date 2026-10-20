'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Project } from '@/types/project';
import {
  LayersIcon,
  PlusIcon,
  BuildingIcon,
  UserIcon,
  MailIcon,
  CalendarIcon,
  ArrowRightIcon,
  Trash2Icon,
  Loader2Icon,
  CheckCircle2Icon,
  SearchIcon,
  FolderPlusIcon,
  ShieldCheckIcon,
  FileCheck2Icon,
  GitBranchIcon,
  MicIcon,
  SlidersHorizontalIcon,
  ExternalLinkIcon,
  HelpCircleIcon,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [description, setDescription] = useState('');

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (e) {
      console.warn('Failed to fetch projects:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !clientName.trim()) {
      alert('Please fill in both Project Name and Client Name');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          clientName: clientName.trim(),
          clientContact: clientContact.trim(),
          clientEmail: clientEmail.trim(),
          description: description.trim(),
        }),
      });

      if (res.ok) {
        const createdProject = await res.json();
        setIsCreateModalOpen(false);
        setProjectName('');
        setClientName('');
        setClientContact('');
        setClientEmail('');
        setDescription('');
        await loadProjects();
        router.push(`/meetings?projectId=${createdProject.id}`);
      } else {
        const errData = await res.json();
        alert(`Failed to create project: ${errData.error || 'Unknown error'}`);
      }
    } catch {
      alert('Network error creating project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete project "${projectId}" and all associated discovery data?`)) {
      return;
    }

    setDeletingId(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } else {
        alert('Failed to delete project');
      }
    } catch {
      alert('Network error deleting project');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-slate-200 selection:text-slate-900">
      
      {/* 1. TOP APP BAR */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 px-4 sm:px-8 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <LayersIcon className="size-4.5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-slate-900">
                SpecPilot
              </span>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">
                Requirements Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/calendar">
              <Button
                variant="outline"
                className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs h-8.5 gap-1.5 shadow-2xs"
              >
                <CalendarIcon className="size-3.5 text-slate-500" />
                <span>Calendar</span>
              </Button>
            </Link>

            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs h-8.5 gap-1.5 shadow-xs"
            >
              <PlusIcon className="size-3.5" />
              <span>New Project</span>
            </Button>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-8 space-y-8">
        
        {/* Page Title & Context */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>Organization Workspace</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Active Engagements</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Requirements &amp; Discovery Workspaces
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl">
              Conduct stakeholder discovery sessions, review candidate requirements with human verification, and maintain an audit-ready Living Software Requirements Specification (SRS).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-semibold">
              <CheckCircle2Icon className="size-3.5 text-emerald-600" />
              <span>Multi-Meeting Memory Synchronized</span>
            </span>
          </div>
        </div>

        {/* Executive Metrics Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Projects</span>
            <div className="text-2xl font-extrabold text-slate-900">{projects.length}</div>
            <span className="text-[11px] text-slate-500 font-medium">Enterprise client workspaces</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Discovery Sessions</span>
            <div className="text-2xl font-extrabold text-slate-900">14</div>
            <span className="text-[11px] text-slate-500 font-medium">Recorded with audio transcript</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Verified Baselines</span>
            <div className="text-2xl font-extrabold text-emerald-700">v2.0</div>
            <span className="text-[11px] text-emerald-700 font-medium">Human engineer signed off</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Specification Health</span>
            <div className="text-2xl font-extrabold text-slate-900">100%</div>
            <span className="text-[11px] text-slate-500 font-medium">Zero unresolved ambiguity defects</span>
          </div>
        </div>

        {/* 3. PROJECT LIST SECTION */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Projects Portfolio
              </h2>
              <span className="text-xs font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
                {filteredProjects.length}
              </span>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by project or client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8.5 pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 shadow-2xs"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="h-8.5 gap-1.5 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs shrink-0"
              >
                <PlusIcon className="size-3.5" />
                <span>Add Project</span>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
              <Loader2Icon className="size-5 animate-spin text-slate-600" />
              <span className="text-xs font-medium">Loading project registry...</span>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3 shadow-2xs">
              <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mx-auto">
                <FolderPlusIcon className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">No Projects Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {searchQuery ? 'No client workspaces match your search filter.' : 'Initialize your first project to conduct discovery meetings and build living specifications.'}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs h-8.5 gap-1.5 shadow-xs"
              >
                <PlusIcon className="size-3.5" />
                <span>Create New Project</span>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => {
                const isDeleting = deletingId === project.id;
                return (
                  <div
                    key={project.id}
                    onClick={() => router.push(`/meetings?projectId=${project.id}`)}
                    className="cursor-pointer bg-white rounded-xl border border-slate-200/90 hover:border-slate-400/80 hover:shadow-xs transition-all flex flex-col justify-between group p-5 space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-slate-100 text-slate-700 border border-slate-200/80 font-mono text-[10px] font-semibold px-2 py-0.5">
                              {project.status || 'ACTIVE'}
                            </Badge>
                            <span className="text-[11px] font-mono text-slate-400">
                              {project.id}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-slate-700 transition-colors">
                            {project.name}
                          </h3>
                        </div>

                        <button
                          onClick={(e) => handleDeleteProject(project.id, e)}
                          disabled={isDeleting}
                          title="Delete project"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100"
                        >
                          {isDeleting ? (
                            <Loader2Icon className="size-3.5 animate-spin text-rose-600" />
                          ) : (
                            <Trash2Icon className="size-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                        <BuildingIcon className="size-3.5 text-slate-400" />
                        <span>Client: <strong className="text-slate-800">{project.clientName}</strong></span>
                      </div>

                      {project.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {project.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      {(project.clientContact || project.clientEmail) && (
                        <div className="text-[11px] text-slate-500 space-y-0.5">
                          {project.clientContact && (
                            <div className="flex items-center gap-1.5">
                              <UserIcon className="size-3 text-slate-400" />
                              <span>{project.clientContact}</span>
                            </div>
                          )}
                          {project.clientEmail && (
                            <div className="flex items-center gap-1.5">
                              <MailIcon className="size-3 text-slate-400" />
                              <span>{project.clientEmail}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          v2.0 Verified Baseline
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all">
                          <span>Enter Workspace</span>
                          <ArrowRightIcon className="size-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 4. TECHNICAL SYSTEM ARCHITECTURE BLUEPRINT (PROFESSIONAL ENGINEERING DOCS STYLE) */}
        <section className="bg-white rounded-xl border border-slate-200/90 p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <GitBranchIcon className="size-4 text-slate-600" />
                <span>System Architecture &amp; Specification Pipeline</span>
              </h2>
              <p className="text-xs text-slate-500">
                How SpecPilot maintains continuous requirement integrity across multi-session discovery lifecycles.
              </p>
            </div>
            <span className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded">
              ISO/IEC/IEEE 29148 Compliant
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-slate-50/70 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <span className="size-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-mono">1</span>
                <span>Context Ingestion</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Before each discovery meeting, the prior baseline AST is reconstructed. Transcripts are ingested via WebRTC and streamed into the multi-turn session buffer.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50/70 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <span className="size-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-mono">2</span>
                <span>Active Elicitation</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                The agent parses dialogue to extract functional requirements, non-functional constraints, and security standards, prompting clarification when statements lack testability.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50/70 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <span className="size-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-mono">3</span>
                <span>Differential Mutation</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Modifications to prior scope are computed semantically. Changes are tagged as Added, Modified, or Deprecated, retaining full audit history and change rationale.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50/70 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <span className="size-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-mono">4</span>
                <span>Human Approval Gate</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Lead Requirement Engineers perform granular per-item sign-off. Approved items compile into the Master Living SRS with exportable IEEE-format PDF documentation.
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* 5. CREATE PROJECT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Create Client Project Workspace</h3>
                <p className="text-xs text-slate-500">Initialize continuous elicitation workspace</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-mono px-2"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-700 font-semibold">
                  Project Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., OmniChannel Retail E-Commerce Portal"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-semibold">
                    Client Organization <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Acme Retail Group"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-semibold">Client Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Sarah Connor"
                    value={clientContact}
                    onChange={(e) => setClientContact(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-semibold">Client Email</label>
                <input
                  type="email"
                  placeholder="e.g., stakeholder@acme.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-semibold">Scope &amp; Background</label>
                <textarea
                  rows={3}
                  placeholder="Briefly describe the business goals, target users, and key architectural scope..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-500 font-sans"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-8 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold gap-1.5 shadow-xs"
                >
                  {submitting ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2Icon className="size-3.5" />
                  )}
                  <span>Create Workspace</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
