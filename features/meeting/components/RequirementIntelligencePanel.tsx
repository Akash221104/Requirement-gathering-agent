'use client';

import React, { useState } from 'react';
import type {
  CandidateRequirement,
  ClarificationQuestion,
  MeetingIntelligenceState,
  RequirementQualityIssue,
} from '@/types/requirement';
import type { VoiceSuggestionMessage } from '@/types/meeting';
import { Badge } from '@/components/ui/badge';
import {
  SparklesIcon,
  HelpCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  CopyIcon,
  CheckIcon,
  XIcon,
  LightbulbIcon,
  FileCheck2Icon,
  VolumeXIcon,
} from 'lucide-react';

interface RequirementIntelligencePanelProps {
  intelligenceState: MeetingIntelligenceState | null;
  isOpen: boolean;
  onClose: () => void;
  voiceSuggestions?: VoiceSuggestionMessage[];
}

export function RequirementIntelligencePanel({
  intelligenceState,
  isOpen,
  onClose,
  voiceSuggestions = [],
}: RequirementIntelligencePanelProps) {
  const [activeTab, setActiveTab] = useState<'candidates' | 'issues' | 'questions'>('candidates');
  const [copiedQuestionId, setCopiedQuestionId] = useState<string | null>(null);

  if (!isOpen) return null;

  const candidates = intelligenceState?.candidateRequirements || [];
  const issues = intelligenceState?.issues || [];
  const questions = intelligenceState?.clarificationQuestions || [];

  const handleCopyQuestion = (id: string, text: string) => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedQuestionId(id);
      setTimeout(() => setCopiedQuestionId(null), 2000);
    }
  };

  const getCategoryBadge = (type: string) => {
    switch (type) {
      case 'SECURITY':
        return <Badge className="bg-red-950/80 text-red-300 border-red-800 text-[10px]">Security</Badge>;
      case 'PERFORMANCE':
        return <Badge className="bg-amber-950/80 text-amber-300 border-amber-800 text-[10px]">Performance</Badge>;
      case 'FUNCTIONAL':
        return <Badge className="bg-blue-950/80 text-blue-300 border-blue-800 text-[10px]">Functional</Badge>;
      case 'NON_FUNCTIONAL':
        return <Badge className="bg-purple-950/80 text-purple-300 border-purple-800 text-[10px]">Non-Functional</Badge>;
      case 'UI_UX':
        return <Badge className="bg-pink-950/80 text-pink-300 border-pink-800 text-[10px]">UI/UX</Badge>;
      case 'BUSINESS':
        return <Badge className="bg-emerald-950/80 text-emerald-300 border-emerald-800 text-[10px]">Business</Badge>;
      default:
        return <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px]">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEEDS_CLARIFICATION':
        return (
          <Badge className="bg-amber-950/80 text-amber-300 border-amber-800/80 text-[10px] flex items-center gap-1">
            <HelpCircleIcon className="size-2.5" />
            Needs Clarification
          </Badge>
        );
      case 'CONFLICT':
        return (
          <Badge className="bg-red-950/80 text-red-300 border-red-800/80 text-[10px] flex items-center gap-1">
            <AlertTriangleIcon className="size-2.5" />
            Conflict
          </Badge>
        );
      case 'PROPOSED':
      default:
        return (
          <Badge className="bg-indigo-950/80 text-indigo-300 border-indigo-800/80 text-[10px] flex items-center gap-1">
            <CheckCircle2Icon className="size-2.5" />
            Proposed
          </Badge>
        );
    }
  };

  const getIssueSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge className="bg-red-950 text-red-300 border-red-800 text-[9px] uppercase">High Risk</Badge>;
      case 'medium':
        return <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[9px] uppercase">Medium</Badge>;
      default:
        return <Badge className="bg-blue-950 text-blue-300 border-blue-800 text-[9px] uppercase">Low</Badge>;
    }
  };

  const totalCount = candidates.length + issues.length + questions.length + voiceSuggestions.length;

  return (
    <aside className="w-84 sm:w-96 flex flex-col h-full border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-2xl transition-all duration-200 z-20">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-400">
            <SparklesIcon className="size-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-1.5">
              SpecPilot Intelligence
              <span className="size-1.5 rounded-full bg-indigo-400 animate-pulse" />
            </h2>
            <p className="text-[10px] text-zinc-400">Live Requirement Co-Pilot</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          title="Close Intelligence Panel"
          type="button"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800/80 bg-zinc-900/40 p-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('candidates')}
          className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'candidates'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <FileCheck2Icon className="size-3.5 text-indigo-400" />
          <span>Requirements</span>
          {candidates.length > 0 && (
            <span className="rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-[10px] px-1.5 py-0">
              {candidates.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('issues')}
          className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'issues'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <AlertTriangleIcon className="size-3.5 text-amber-400" />
          <span>Issues</span>
          {issues.length > 0 && (
            <span className="rounded-full bg-amber-950/80 border border-amber-700/60 text-amber-300 text-[10px] px-1.5 py-0">
              {issues.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'questions'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <LightbulbIcon className="size-3.5 text-emerald-400" />
          <span>Suggestions</span>
          {questions.length + voiceSuggestions.length > 0 && (
            <span className="rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[10px] px-1.5 py-0">
              {questions.length + voiceSuggestions.length}
            </span>
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {totalCount === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
            <SparklesIcon className="size-8 stroke-[1.5] text-zinc-600" />
            <p className="text-xs font-medium text-zinc-400">Listening to conversation...</p>
            <p className="text-[11px] leading-relaxed max-w-[220px]">
              SpecPilot will continuously analyze speech chunks, extract candidate requirements, flag ambiguities, and suggest clarification questions.
            </p>
          </div>
        ) : (
          <>
            {/* Tab 1: Candidate Requirements */}
            {activeTab === 'candidates' && (
              <div className="space-y-3">
                {candidates.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-8">No candidate requirements detected yet.</p>
                ) : (
                  candidates.map((cand: CandidateRequirement) => (
                    <div
                      key={cand.id}
                      className="rounded-lg border border-zinc-800/90 bg-zinc-900/60 p-3.5 space-y-2.5 transition-all hover:border-zinc-700"
                    >
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          {getCategoryBadge(cand.type)}
                          {getStatusBadge(cand.status)}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {Math.round(cand.confidence * 100)}% conf
                        </span>
                      </div>

                      <p className="text-xs font-medium text-zinc-100 leading-snug">
                        &quot;{cand.requirementText}&quot;
                      </p>

                      <div className="flex items-center justify-between border-t border-zinc-800/60 pt-2 text-[10px] text-zinc-500">
                        <span>Source: {cand.sourceSpeakerName} ({cand.sourceSpeakerRole})</span>
                        <span className="font-mono">
                          {cand.timestamp ? new Date(cand.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: Quality Issues */}
            {activeTab === 'issues' && (
              <div className="space-y-3">
                {issues.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-8">No requirement defects or ambiguities detected.</p>
                ) : (
                  issues.map((issue: RequirementQualityIssue) => (
                    <div
                      key={issue.id}
                      className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3.5 space-y-2 transition-all"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <Badge className="bg-amber-900/60 text-amber-300 border-amber-800/80 text-[10px]">
                          {issue.issueType.replace('_', ' ')}
                        </Badge>
                        {getIssueSeverityBadge(issue.severity)}
                      </div>

                      <h4 className="text-xs font-semibold text-amber-200">
                        {issue.description}
                      </h4>

                      <p className="text-[11px] text-zinc-300 leading-relaxed bg-zinc-950/40 p-2 rounded border border-zinc-800/50">
                        <span className="text-zinc-400 font-medium">Why it matters:</span> {issue.explanation}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Clarification Questions & Voice Suggestions */}
            {activeTab === 'questions' && (
              <div className="space-y-3">
                {questions.length === 0 && voiceSuggestions.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-8">No clarification questions or suggestions currently.</p>
                ) : (
                  <>
                    {/* Real-time Voice Suggestions (Silent Mode) */}
                    {voiceSuggestions.map((vs, idx) => (
                      <div
                        key={`vs-${vs.timestamp}-${idx}`}
                        className="rounded-lg border border-violet-900/40 bg-violet-950/20 p-3.5 space-y-2.5 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-semibold text-violet-400 tracking-wider flex items-center gap-1">
                            <VolumeXIcon className="size-3" />
                            Voice Suggestion (Silent Mode)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyQuestion(`vs-${idx}`, vs.text)}
                            className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
                            title="Copy Suggestion"
                          >
                            {copiedQuestionId === `vs-${idx}` ? (
                              <>
                                <CheckIcon className="size-3" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <CopyIcon className="size-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-xs font-semibold text-zinc-100 bg-zinc-950/60 p-2.5 rounded-md border border-violet-900/30">
                          &quot;{vs.text}&quot;
                        </p>

                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          <span className="text-zinc-300 font-medium">Rationale:</span> {vs.rationale}
                        </p>
                      </div>
                    ))}

                    {/* Clarification Questions */}
                    {questions.map((q: ClarificationQuestion) => (
                      <div
                        key={q.id}
                        className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3.5 space-y-2.5 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-semibold text-emerald-400 tracking-wider">
                            Suggested to Engineer
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyQuestion(q.id, q.question)}
                            className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
                            title="Copy Question"
                          >
                            {copiedQuestionId === q.id ? (
                              <>
                                <CheckIcon className="size-3" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <CopyIcon className="size-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-xs font-semibold text-zinc-100 bg-zinc-950/60 p-2.5 rounded-md border border-emerald-900/30">
                          &quot;{q.question}&quot;
                        </p>

                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          <span className="text-zinc-300 font-medium">Rationale:</span> {q.rationale}
                        </p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
