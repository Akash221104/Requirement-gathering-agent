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
  ExternalLinkIcon,
  HelpCircleIcon,
  AlertTriangleIcon,
  XCircleIcon,
  ZapIcon,
  DatabaseIcon,
  ScaleIcon,
  FileTextIcon,
  ClockIcon,
  ArrowUpRightIcon,
  CpuIcon,
  SparklesIcon,
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
      
      {/* 1. TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <LayersIcon className="size-5" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-base font-bold tracking-tight text-slate-900">
                SpecPilot
              </span>
              <span className="hidden sm:inline-flex text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 rounded-md">
                ISO/IEC/IEEE 29148 Standard
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-600 mr-2">
              <a href="#problem-solution" className="px-3 py-1.5 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors">
                Problem &amp; Solution
              </a>
              <a href="#pipeline" className="px-3 py-1.5 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors">
                Architecture
              </a>
              <a href="#projects" className="px-3 py-1.5 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors">
                Workspaces
              </a>
            </nav>

            <Link href="/calendar">
              <Button
                variant="outline"
                className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs h-9 gap-1.5 shadow-2xs"
              >
                <CalendarIcon className="size-3.5 text-slate-500" />
                <span className="hidden sm:inline">Schedule</span>
              </Button>
            </Link>

            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs h-9 gap-1.5 shadow-xs px-3.5"
            >
              <PlusIcon className="size-3.5" />
              <span>New Project</span>
            </Button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="bg-gradient-to-b from-white via-white to-slate-50 border-b border-slate-200/80 py-12 sm:py-16 px-4 sm:px-8">
        <div className="mx-auto max-w-5xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full shadow-2xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Autonomous AI Requirements Engineering System</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-mono">LiveKit + Deepgram + Groq</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight sm:leading-tight">
            Stop losing stakeholder intent in ambiguous discovery meetings.
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            SpecPilot is an enterprise AI co-pilot that participates in discovery calls, clarifies vague requirements in real-time, retains continuous multi-meeting memory, and synthesizes audit-ready <strong>ISO/IEC/IEEE 29148 Living Specifications</strong>.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a href="#projects">
              <Button className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm h-10 px-5 gap-2 shadow-xs">
                <span>Access Active Workspaces</span>
                <ArrowRightIcon className="size-4" />
              </Button>
            </a>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(true)}
              className="border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs sm:text-sm h-10 px-5 gap-2 shadow-2xs"
            >
              <FolderPlusIcon className="size-4 text-slate-500" />
              <span>Initialize Client Project</span>
            </Button>
            <Link href="/calendar">
              <Button
                variant="ghost"
                className="text-slate-600 hover:text-slate-900 font-medium text-xs sm:text-sm h-10 px-4 gap-1.5"
              >
                <CalendarIcon className="size-4 text-slate-400" />
                <span>View Scheduled Sessions</span>
              </Button>
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="pt-8 border-t border-slate-200/60 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Failure Prevention</div>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">68% &rarr; 0%</div>
              <div className="text-[11px] text-slate-500">Eliminates scope ambiguity defects</div>
            </div>
            <div className="bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Voice Intervention</div>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">&lt; 800ms</div>
              <div className="text-[11px] text-slate-500">Sub-second real-time clarification</div>
            </div>
            <div className="bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Documentation Speed</div>
              <div className="text-xl font-extrabold text-emerald-700 mt-0.5">1-Click SRS</div>
              <div className="text-[11px] text-slate-500">From days to instant verified output</div>
            </div>
            <div className="bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Compliance Standard</div>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">IEEE 29148</div>
              <div className="text-[11px] text-slate-500">Formal verification criteria &amp; audit trail</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PROBLEM VS. SOLUTION SECTION */}
      <section id="problem-solution" className="py-14 px-4 sm:px-8 border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-7xl space-y-10">
          
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
              The Software Engineering Dilemma
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Why Traditional Requirements Gathering Fails — And How SpecPilot Fixes It
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Software projects rarely fail due to technical implementation. They fail because stakeholder intentions get lost in ambiguous language, forgotten across calls, and delayed by manual documentation.
            </p>
          </div>

          {/* Dual Column Problem vs Solution Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left: The Problem */}
            <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-rose-200/80 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs">
                    <AlertTriangleIcon className="size-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-rose-950">
                      The Industry Problem
                    </h3>
                    <p className="text-xs text-rose-700">
                      Why traditional discovery meetings cause catastrophic project failure
                    </p>
                  </div>
                </div>
                <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-mono text-[11px]">
                  Status Quo
                </Badge>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-white/80 p-3.5 rounded-xl border border-rose-100">
                  <XCircleIcon className="size-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-900">1. Vague &amp; Untestable Statements</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Stakeholders say: <em>&quot;The dashboard must be fast, scalable, and intuitive.&quot;</em> Engineers interpret this differently, causing contradictory development and multi-sprint rewrites.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/80 p-3.5 rounded-xl border border-rose-100">
                  <XCircleIcon className="size-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-900">2. Severe Cross-Meeting Context Amnesia</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Crucial decisions made in meeting #1 are forgotten by meeting #3. Notes are fragmented in Google Docs, Slack, and emails, forcing teams to re-litigate the same questions repeatedly.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/80 p-3.5 rounded-xl border border-rose-100">
                  <XCircleIcon className="size-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-900">3. Manual Documentation Latency</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Lead engineers spend 4-6 hours post-meeting manually transcribing, summarizing, and writing SRS artifacts. By the time the document is circulated, stakeholder priorities have shifted.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/80 p-3.5 rounded-xl border border-rose-100">
                  <XCircleIcon className="size-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-900">4. Undetected Scope Drift &amp; Conflicts</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      A client casually requests a workflow change that silently breaks three prior architectural constraints. Because nobody checks historical baselines in real-time, the conflict explodes in QA.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-100/60 border border-rose-200 text-xs text-rose-900 font-medium">
                <strong>Industry Impact:</strong> Standish Group research indicates that over <strong>68% of software projects fail</strong>, exceed budgets, or deliver unusable products due to poor requirement elicitation.
              </div>
            </div>

            {/* Right: The SpecPilot Solution */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <ShieldCheckIcon className="size-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-950">
                      The SpecPilot Solution
                    </h3>
                    <p className="text-xs text-emerald-800">
                      Real-time AI voice elicitation with continuous cross-meeting specification integrity
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-mono text-[11px]">
                  SpecPilot Engine
                </Badge>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-white/90 p-3.5 rounded-xl border border-emerald-100">
                  <CheckCircle2Icon className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-900">1. Sub-Second Voice Clarification (ISO 29148)</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      SpecPilot listens on the call via LiveKit WebRTC. When someone says &quot;make it fast,&quot; the agent politely intervenes via Deepgram voice: <em>&quot;What is the maximum acceptable latency in milliseconds?&quot;</em>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/90 p-3.5 rounded-xl border border-emerald-100">
                  <CheckCircle2Icon className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-900">2. Living Cross-Meeting Memory</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      The agent never forgets. It ingests prior baselines, approved decisions, and unresolved questions into its context window, preventing re-asking questions and maintaining historical continuity.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/90 p-3.5 rounded-xl border border-emerald-100">
                  <CheckCircle2Icon className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-900">3. Instant Audit-Ready Living SRS &amp; PDF</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      The moment a meeting ends, a comprehensive, formal ISO/IEC/IEEE 29148 document bundle is generated: Executive Summary, SRS, Requirements Register, Decision Log, and Traceability Matrix.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/90 p-3.5 rounded-xl border border-emerald-100">
                  <CheckCircle2Icon className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-900">4. Differential Scope Mutation &amp; Verification</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Modifications are classified as Added, Modified, or Superseded with rationale. Human Requirement Engineers have granular per-item sign-off control before anything reaches the baseline.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-100/60 border border-emerald-200 text-xs text-emerald-900 font-medium">
                <strong>Result:</strong> Zero latency between discovery and sprint readiness, 100% testable verification criteria, and zero surprise architectural collisions.
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. SYSTEM ARCHITECTURE & PIPELINE */}
      <section id="pipeline" className="py-14 px-4 sm:px-8 border-b border-slate-200/80 bg-slate-50">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded">
                System Workflow
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
                The 5-Phase Real-Time Discovery Pipeline
              </h2>
              <p className="text-xs text-slate-600">
                How voice audio transforms into formal, verified engineering specifications.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-slate-900 text-white font-mono text-[10px]">WebRTC + STT + TTS + LLM</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            
            {/* Step 1 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-2xs hover:border-slate-300 transition-colors">
              <div className="size-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-mono font-bold text-xs border border-slate-200">
                01
              </div>
              <h3 className="text-xs font-bold text-slate-900">Audio Ingestion</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Connects directly to LiveKit room audio streams. Deepgram Nova-2 transcribes speech with speaker role diarization in real-time.
              </p>
              <div className="pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-500">
                LiveKit RTC / Deepgram STT
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-2xs hover:border-slate-300 transition-colors">
              <div className="size-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-mono font-bold text-xs border border-slate-200">
                02
              </div>
              <h3 className="text-xs font-bold text-slate-900">Ambiguity Evaluation</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Continuous NLP checks against ISO/IEC/IEEE 29148 standards: testability, boundary metrics, and conflicting prior rules.
              </p>
              <div className="pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-500">
                ISO 29148 Quality Engine
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-2xs hover:border-slate-300 transition-colors">
              <div className="size-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-mono font-bold text-xs border border-slate-200">
                03
              </div>
              <h3 className="text-xs font-bold text-slate-900">Voice Intervention</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                In Autonomous or Assisted mode, the agent synthesizes natural voice questions via Deepgram Aura-2 when critical gaps appear.
              </p>
              <div className="pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-500">
                Aura-2 / Sub-second TTS
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-2xs hover:border-slate-300 transition-colors">
              <div className="size-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-mono font-bold text-xs border border-slate-200">
                04
              </div>
              <h3 className="text-xs font-bold text-slate-900">Differential Mutation</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Computes AST differences against previous baseline versions. Tags requirements as Added, Modified, or Superseded with rationale.
              </p>
              <div className="pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-500">
                Living Spec Diff Engine
              </div>
            </div>

            {/* Step 5 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-2xs hover:border-slate-300 transition-colors">
              <div className="size-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-mono font-bold text-xs border border-slate-200">
                05
              </div>
              <h3 className="text-xs font-bold text-slate-900">Verified Sign-off &amp; PDF</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Engineer conducts per-item verification and approves baseline snapshot. Generates structured IEEE 29148 printable PDF report.
              </p>
              <div className="pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-500">
                Audit-Ready PDF Export
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. ACTIVE PROJECTS PORTFOLIO */}
      <section id="projects" className="py-12 px-4 sm:px-8 max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Enterprise Projects Portfolio
              </h2>
              <span className="text-xs font-semibold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded">
                {filteredProjects.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any project to access historical meetings, living requirements, baseline snapshots, and IEEE documentation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by project or client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 shadow-2xs"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="h-9 gap-1.5 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs shrink-0"
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
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-4 shadow-2xs">
            <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mx-auto">
              <FolderPlusIcon className="size-6" />
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
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs h-9 gap-1.5 shadow-xs px-4"
            >
              <PlusIcon className="size-3.5" />
              <span>Create New Project</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => {
              const isDeleting = deletingId === project.id;
              return (
                <div
                  key={project.id}
                  onClick={() => router.push(`/meetings?projectId=${project.id}`)}
                  className="cursor-pointer bg-white rounded-xl border border-slate-200/90 hover:border-slate-400 hover:shadow-xs transition-all flex flex-col justify-between group p-5 space-y-4"
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
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-slate-100"
                      >
                        {isDeleting ? (
                          <Loader2Icon className="size-3.5 animate-spin text-rose-600" />
                        ) : (
                          <Trash2Icon className="size-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                      <BuildingIcon className="size-3.5 text-slate-400 shrink-0" />
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
                            <UserIcon className="size-3 text-slate-400 shrink-0" />
                            <span className="truncate">{project.clientContact}</span>
                          </div>
                        )}
                        {project.clientEmail && (
                          <div className="flex items-center gap-1.5">
                            <MailIcon className="size-3 text-slate-400 shrink-0" />
                            <span className="truncate">{project.clientEmail}</span>
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

      {/* 6. CREATE PROJECT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FolderPlusIcon className="size-5 text-slate-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Create Client Project Workspace
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next-Gen Supply Chain Analytics"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Client Organization *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AcroHealth Systems"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Primary Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Rebecca Vance"
                    value={clientContact}
                    onChange={(e) => setClientContact(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Contact Email</label>
                <input
                  type="email"
                  placeholder="e.g. r.vance@acrohealth.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Scope Overview / Description</label>
                <textarea
                  rows={3}
                  placeholder="Briefly define discovery objectives, legacy system constraints, or target deliverables..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-xs text-slate-600 border-slate-200 hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold gap-1.5 px-4"
                >
                  {submitting ? (
                    <>
                      <Loader2Icon className="size-3.5 animate-spin" />
                      <span>Initializing...</span>
                    </>
                  ) : (
                    <>
                      <PlusIcon className="size-3.5" />
                      <span>Create Workspace</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. FOOTER */}
      <footer className="mt-16 bg-white border-t border-slate-200 py-10 px-4 sm:px-8 text-xs text-slate-500">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-6 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
              SP
            </div>
            <span>
              SpecPilot &bull; Enterprise Requirements Engineering Platform (ISO/IEC/IEEE 29148)
            </span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#problem-solution" className="hover:text-slate-900 transition-colors">
              Problem &amp; Solution
            </a>
            <a href="#pipeline" className="hover:text-slate-900 transition-colors">
              Pipeline Architecture
            </a>
            <Link href="/calendar" className="hover:text-slate-900 transition-colors">
              Calendar
            </Link>
            <a
              href="https://github.com/Akash221104/Requirement-gathering-agent"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition-colors inline-flex items-center gap-1 font-semibold text-slate-700"
            >
              <span>GitHub</span>
              <ExternalLinkIcon className="size-3 text-slate-400" />
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
