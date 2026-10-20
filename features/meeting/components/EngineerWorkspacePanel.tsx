'use client';

import React, { useState, useEffect, useRef } from 'react';
import type {
  CandidateRequirement,
  MeetingIntelligenceState,
} from '@/types/requirement';
import type { TranscriptSegment, SpecPilotStatus, VoiceSuggestionMessage } from '@/types/meeting';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  SparklesIcon,
  HelpCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  CopyIcon,
  CheckIcon,
  XIcon,
  FileTextIcon,
  RadioIcon,
  LightbulbIcon,
  MessageSquareQuoteIcon,
  EyeIcon,
  BotIcon,
} from 'lucide-react';

interface EngineerWorkspacePanelProps {
  intelligenceState: MeetingIntelligenceState | null;
  segments: TranscriptSegment[];
  specPilotStatus: SpecPilotStatus;
  voiceSuggestions?: VoiceSuggestionMessage[];
  isOpen: boolean;
  onClose: () => void;
  activeTab?: 'requirements' | 'issues' | 'suggestions' | 'transcript';
  onTabChange?: (tab: 'requirements' | 'issues' | 'suggestions' | 'transcript') => void;
}

export function EngineerWorkspacePanel({
  intelligenceState,
  segments,
  specPilotStatus,
  voiceSuggestions = [],
  isOpen,
  onClose,
  activeTab: controlledTab,
  onTabChange,
}: EngineerWorkspacePanelProps) {
  const [internalTab, setInternalTab] = useState<'requirements' | 'issues' | 'suggestions' | 'transcript'>('requirements');
  const currentTab = controlledTab ?? internalTab;
  const setTab = (tab: 'requirements' | 'issues' | 'suggestions' | 'transcript') => {
    if (onTabChange) onTabChange(tab);
    setInternalTab(tab);
  };

  // Feedback states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<Set<string>>(new Set());
  const [reviewItem, setReviewItem] = useState<CandidateRequirement | null>(null);

  // Transcript scroll awareness
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);

  const candidates = intelligenceState?.candidateRequirements || [];
  const issues = intelligenceState?.issues || [];
  const questions = intelligenceState?.clarificationQuestions || [];

  // Filter out dismissed suggestions
  const visibleQuestions = questions.filter((q) => !dismissedSuggestionIds.has(q.id));
  const visibleVoiceSuggestions = voiceSuggestions.filter(
    (s, idx) => !dismissedSuggestionIds.has(`voice-sug-${s.timestamp || idx}`)
  );
  const totalSuggestionsCount = visibleQuestions.length + visibleVoiceSuggestions.length;

  // Track user scroll position in transcript
  const handleTranscriptScroll = () => {
    if (!transcriptScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = transcriptScrollRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  // Auto-scroll transcript only if user was near bottom
  useEffect(() => {
    if (currentTab === 'transcript' && transcriptScrollRef.current && isNearBottomRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [segments, currentTab]);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDismissSuggestion = (id: string) => {
    setDismissedSuggestionIds((prev) => new Set(prev).add(id));
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatCandidateId = (rawId: string, index: number) => {
    if (rawId.startsWith('FR-') || rawId.startsWith('NFR-') || rawId.startsWith('BR-')) {
      return rawId;
    }
    return `FR-${(index + 1).toString().padStart(3, '0')}`;
  };

  const getCategoryBadge = (type: string) => {
    switch (type.toUpperCase()) {
      case 'SECURITY':
        return <Badge className="bg-rose-50 text-rose-800 border-rose-200 text-[10px] font-semibold">Security</Badge>;
      case 'PERFORMANCE':
        return <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-semibold">Performance</Badge>;
      case 'FUNCTIONAL':
        return <Badge className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-semibold">Functional</Badge>;
      case 'NON_FUNCTIONAL':
        return <Badge className="bg-purple-50 text-purple-800 border-purple-200 text-[10px] font-semibold">Non-Functional</Badge>;
      case 'UI_UX':
        return <Badge className="bg-pink-50 text-pink-800 border-pink-200 text-[10px] font-semibold">UI/UX</Badge>;
      case 'BUSINESS':
        return <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold">Business</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-semibold">{type}</Badge>;
    }
  };

  const getCandidateStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'NEEDS_CLARIFICATION':
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] flex items-center gap-1 font-semibold">
            <HelpCircleIcon className="size-2.5" />
            Needs Clarification
          </Badge>
        );
      case 'CONFLICT':
        return (
          <Badge className="bg-rose-50 text-rose-800 border-rose-300 text-[10px] flex items-center gap-1 font-semibold">
            <AlertTriangleIcon className="size-2.5" />
            Conflict
          </Badge>
        );
      case 'APPROVED':
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] flex items-center gap-1 font-semibold">
            <CheckCircle2Icon className="size-2.5" />
            Approved
          </Badge>
        );
      case 'PROPOSED':
      default:
        return (
          <Badge className="bg-blue-50 text-blue-800 border-blue-300 text-[10px] flex items-center gap-1 font-semibold">
            <CheckCircle2Icon className="size-2.5" />
            Proposed
          </Badge>
        );
    }
  };

  const getIssueSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'high':
        return (
          <Badge className="bg-rose-100 text-rose-900 border-rose-300 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0">
            {severity.toUpperCase() === 'CRITICAL' ? 'CRITICAL' : 'HIGH'}
          </Badge>
        );
      case 'medium':
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0">
            MEDIUM
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-100 text-blue-900 border-blue-300 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0">
            LOW
          </Badge>
        );
    }
  };

  const getTranscriptRoleBadge = (role: string) => {
    const r = role.toUpperCase();
    if (r.includes('ENGINEER')) {
      return (
        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-semibold px-1.5 py-0">
          REQUIREMENT ENGINEER
        </Badge>
      );
    }
    if (r.includes('PILOT') || r.includes('AGENT')) {
      return (
        <Badge className="bg-purple-50 text-purple-800 border-purple-300 text-[10px] font-semibold px-1.5 py-0">
          SPEC PILOT
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-50 text-blue-800 border-blue-300 text-[10px] font-semibold px-1.5 py-0">
        CUSTOMER
      </Badge>
    );
  };

  const getStatusIndicator = () => {
    if (specPilotStatus === 'speaking') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-purple-700 font-semibold">
          <span className="size-2 rounded-full bg-purple-500 animate-ping" />
          <span>Speaking</span>
        </div>
      );
    }
    if (specPilotStatus === 'listening' || specPilotStatus === 'transcribing') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Active</span>
        </div>
      );
    }
    if (specPilotStatus === 'connecting') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold">
          <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Connecting</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        <span className="size-2 rounded-full bg-slate-400" />
        <span>Standby</span>
      </div>
    );
  };

  return (
    <aside className="w-full sm:w-[380px] lg:w-[420px] xl:w-[450px] flex flex-col h-full border-l border-slate-200 bg-white shadow-xl transition-all duration-200 z-20 overflow-hidden text-slate-900 font-sans">
      {/* Workspace Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
            <SparklesIcon className="size-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                SPEC PILOT
              </h2>
              <span className="text-slate-300">•</span>
              {getStatusIndicator()}
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Requirement Co-Pilot Workspace</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-800 transition-colors"
          title="Collapse Co-Pilot Workspace"
          type="button"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50/50 text-xs font-medium">
        <button
          type="button"
          onClick={() => setTab('requirements')}
          className={`py-2.5 px-1 text-center transition-all border-b-2 flex flex-col items-center gap-0.5 ${currentTab === 'requirements'
              ? 'border-emerald-600 text-emerald-800 font-bold bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
        >
          <span className="text-[11px] truncate">Requirements</span>
          {candidates.length > 0 && (
            <span className="rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] px-1.5 py-0 font-mono font-bold">
              {candidates.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab('issues')}
          className={`py-2.5 px-1 text-center transition-all border-b-2 flex flex-col items-center gap-0.5 ${currentTab === 'issues'
              ? 'border-rose-600 text-rose-800 font-bold bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
        >
          <span className="text-[11px] truncate">Issues</span>
          {issues.length > 0 && (
            <span className="rounded-full bg-rose-100 border border-rose-300 text-rose-800 text-[9px] px-1.5 py-0 font-mono font-bold">
              {issues.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab('suggestions')}
          className={`py-2.5 px-1 text-center transition-all border-b-2 flex flex-col items-center gap-0.5 ${currentTab === 'suggestions'
              ? 'border-purple-600 text-purple-800 font-bold bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
        >
          <span className="text-[11px] truncate">Suggestions</span>
          {totalSuggestionsCount > 0 && (
            <span className="rounded-full bg-purple-100 border border-purple-300 text-purple-800 text-[9px] px-1.5 py-0 font-mono font-bold">
              {totalSuggestionsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab('transcript')}
          className={`py-2.5 px-1 text-center transition-all border-b-2 flex flex-col items-center gap-0.5 ${currentTab === 'transcript'
              ? 'border-blue-600 text-blue-800 font-bold bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
        >
          <span className="text-[11px] truncate">Transcript</span>
          <span className="rounded-full bg-slate-200 text-slate-700 text-[9px] px-1.5 py-0 font-mono font-semibold">
            {segments.filter((s) => s.isFinal).length}
          </span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/50">
        {/* TAB 1: REQUIREMENTS */}
        {currentTab === 'requirements' && (
          <div className="space-y-3">
            {candidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2.5 border border-dashed border-slate-200 rounded-xl bg-white shadow-xs">
                <div className="flex size-10 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-slate-600">
                  <SparklesIcon className="size-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    SpecPilot Intelligence
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-1 font-medium">Analyzing the conversation...</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 max-w-[220px]">
                    Candidate requirements will appear as discussion unfolds.
                  </p>
                </div>
              </div>
            ) : (
              candidates.map((req, idx) => {
                const confidencePct = Math.round(
                  req.confidence <= 1 ? req.confidence * 100 : req.confidence
                );
                const reqId = formatCandidateId(req.id, idx);

                return (
                  <div
                    key={req.id || `req-${idx}`}
                    className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-slate-300 transition-all space-y-2.5"
                  >
                    {/* Card Top: ID + Category + Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          {reqId}
                        </span>
                        {getCategoryBadge(req.type)}
                      </div>
                      {getCandidateStatusBadge(req.status)}
                    </div>

                    {/* Card Content */}
                    <p className="text-xs font-semibold text-slate-900 leading-relaxed font-sans">
                      &quot;{req.requirementText}&quot;
                    </p>

                    {/* Card Footer: Confidence + Source + Review Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                      <div className="flex items-center gap-3 text-slate-500">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Confidence</span>
                          <span className="font-bold text-emerald-700 font-mono">
                            {confidencePct}%
                          </span>
                        </div>
                        <span className="text-slate-300">•</span>
                        <div className="text-[10px] text-slate-600 font-medium truncate max-w-[130px]">
                          {req.sourceSpeakerName || 'Customer'}
                          {req.timestamp ? ` • ${formatTimestamp(req.timestamp)}` : ''}
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[11px] px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 gap-1 font-semibold shadow-xs"
                        onClick={() => setReviewItem(req)}
                      >
                        <EyeIcon className="size-3" />
                        <span>Review</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: ISSUES */}
        {currentTab === 'issues' && (
          <div className="space-y-3">
            {issues.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2.5 border border-dashed border-slate-200 rounded-xl bg-white shadow-xs">
                <CheckCircle2Icon className="size-8 text-emerald-600" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900">No Requirement Defects</h3>
                  <p className="text-[11px] text-slate-600 mt-1 max-w-[220px]">
                    SpecPilot is continuously monitoring conversation completeness, constraints, and ambiguities.
                  </p>
                </div>
              </div>
            ) : (
              issues.map((issue, idx) => {
                const matchingQuestion = questions.find((q) => q.issueId === issue.id || q.requirementId === issue.requirementId);

                return (
                  <div
                    key={issue.id || `issue-${idx}`}
                    className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5 shadow-xs space-y-2.5"
                  >
                    {/* Issue Header: Severity & Issue Type */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {getIssueSeverityBadge(issue.severity)}
                        <span className="text-[10px] font-mono text-slate-600 font-bold uppercase tracking-wider">
                          {issue.issueType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {formatTimestamp(issue.timestamp)}
                      </span>
                    </div>

                    {/* Defect Description */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {issue.description}
                      </h4>
                    </div>

                    {/* Why It Matters */}
                    {issue.explanation && (
                      <div className="rounded-lg bg-white border border-rose-200 p-2.5 text-[11px] space-y-0.5 shadow-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">
                          Why it matters:
                        </span>
                        <p className="text-slate-700 leading-relaxed font-sans">{issue.explanation}</p>
                      </div>
                    )}

                    {/* Suggested Clarification */}
                    {matchingQuestion && (
                      <div className="rounded-lg bg-purple-50 border border-purple-200 p-2.5 text-[11px] space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                            Suggested Clarification:
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(matchingQuestion.id, matchingQuestion.question)}
                            className="text-purple-700 hover:text-purple-900 transition-colors p-0.5"
                            title="Copy Clarification Question"
                          >
                            {copiedId === matchingQuestion.id ? (
                              <CheckIcon className="size-3 text-emerald-600" />
                            ) : (
                              <CopyIcon className="size-3" />
                            )}
                          </button>
                        </div>
                        <p className="text-purple-950 italic font-medium leading-relaxed">
                          &quot;{matchingQuestion.question}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: SUGGESTIONS */}
        {currentTab === 'suggestions' && (
          <div className="space-y-3">
            {totalSuggestionsCount === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2.5 border border-dashed border-slate-200 rounded-xl bg-white shadow-xs">
                <LightbulbIcon className="size-8 text-amber-500" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900">No Suggestions Pending</h3>
                  <p className="text-[11px] text-slate-600 mt-1 max-w-[220px]">
                    SpecPilot will propose targeted clarification questions when gaps or ambiguities arise.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Voice Suggestions */}
                {visibleVoiceSuggestions.map((sug, idx) => {
                  const sugKey = `voice-sug-${sug.timestamp || idx}`;
                  return (
                    <div
                      key={sugKey}
                      className="rounded-xl border border-purple-200 bg-white p-3.5 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-purple-800 text-[11px] font-bold">
                          <BotIcon className="size-3.5 text-purple-600" />
                          <span>Clarification suggested</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {formatTimestamp(sug.timestamp)}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                          Ask customer:
                        </span>
                        <p className="text-xs font-medium text-slate-900 italic bg-purple-50/70 p-2.5 rounded-lg border border-purple-200 leading-relaxed font-sans">
                          &quot;{sug.text}&quot;
                        </p>
                      </div>

                      {sug.rationale && (
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          <span className="font-semibold text-slate-700">Context:</span> {sug.rationale}
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold"
                          onClick={() => handleDismissSuggestion(sugKey)}
                        >
                          Dismiss
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white gap-1.5 shadow-xs"
                          onClick={() => handleCopy(sugKey, sug.text)}
                        >
                          {copiedId === sugKey ? (
                            <>
                              <CheckIcon className="size-3 text-emerald-300" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <MessageSquareQuoteIcon className="size-3" />
                              <span>Use Question</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Intelligence Clarification Questions */}
                {visibleQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-xl border border-purple-200 bg-white p-3.5 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-purple-800 text-[11px] font-bold">
                        <SparklesIcon className="size-3.5 text-purple-600" />
                        <span>Clarification suggested</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {formatTimestamp(q.timestamp)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Ask customer:
                      </span>
                      <p className="text-xs font-medium text-slate-900 italic bg-purple-50/70 p-2.5 rounded-lg border border-purple-200 leading-relaxed font-sans">
                        &quot;{q.question}&quot;
                      </p>
                    </div>

                    {q.rationale && (
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        <span className="font-semibold text-slate-700">Rationale:</span> {q.rationale}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold"
                        onClick={() => handleDismissSuggestion(q.id)}
                      >
                        Dismiss
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white gap-1.5 shadow-xs"
                        onClick={() => handleCopy(q.id, q.question)}
                      >
                        {copiedId === q.id ? (
                          <>
                            <CheckIcon className="size-3 text-emerald-300" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <MessageSquareQuoteIcon className="size-3" />
                            <span>Use Question</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* TAB 4: TRANSCRIPT */}
        {currentTab === 'transcript' && (
          <div
            ref={transcriptScrollRef}
            onScroll={handleTranscriptScroll}
            className="h-full overflow-y-auto space-y-3 pr-1"
          >
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <FileTextIcon className="size-3.5 text-slate-500" />
                <span>Live Transcript</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-mono font-bold">
                <RadioIcon className="size-3 animate-pulse text-emerald-600" />
                <span>Live</span>
              </div>
            </div>

            {segments.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2 border border-dashed border-slate-200 rounded-xl bg-white shadow-xs">
                <FileTextIcon className="size-8 stroke-[1.5] text-slate-400" />
                <p className="text-xs font-bold text-slate-900">Conversation transcript will appear here.</p>
                <p className="text-[11px] text-slate-500 max-w-[200px]">
                  Real-time speech from Customer and Engineer will be captured.
                </p>
              </div>
            ) : (
              segments.map((segment) => (
                <div
                  key={segment.id}
                  className={`rounded-xl border p-3 transition-all shadow-xs ${segment.isFinal
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-200 bg-slate-100/60 opacity-80'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {getTranscriptRoleBadge(segment.speakerRole)}
                      <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]">
                        {segment.speakerName}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {formatTimestamp(segment.timestamp)}
                    </span>
                  </div>

                  <p
                    className={`text-xs leading-relaxed font-sans ${segment.isFinal ? 'text-slate-800' : 'text-slate-600 italic'
                      }`}
                  >
                    {segment.text}
                    {!segment.isFinal && (
                      <span className="inline-block ml-1 animate-pulse text-emerald-600 font-bold">
                        ...
                      </span>
                    )}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Candidate Requirement Review Dialog */}
      <Dialog open={!!reviewItem} onOpenChange={(open) => !open && setReviewItem(null)}>
        <DialogContent className="sm:max-w-md bg-white border border-slate-200 text-slate-900 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              {reviewItem && getCategoryBadge(reviewItem.type)}
              {reviewItem && getCandidateStatusBadge(reviewItem.status)}
            </div>
            <DialogTitle className="text-base text-slate-900 font-bold">
              Requirement Review
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Verified candidate requirement extracted by SpecPilot.
            </DialogDescription>
          </DialogHeader>

          {reviewItem && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Requirement Statement
                </span>
                <p className="text-xs font-semibold text-slate-900 leading-relaxed font-sans">
                  &quot;{reviewItem.requirementText}&quot;
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 shadow-xs">
                  <span className="text-[10px] text-slate-500 font-semibold block uppercase">Confidence</span>
                  <span className="text-sm font-bold text-emerald-700 font-mono">
                    {Math.round(
                      reviewItem.confidence <= 1 ? reviewItem.confidence * 100 : reviewItem.confidence
                    )}
                    %
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 shadow-xs">
                  <span className="text-[10px] text-slate-500 font-semibold block uppercase">Source</span>
                  <span className="text-xs font-bold text-slate-900">
                    {reviewItem.sourceSpeakerName || 'Customer'}
                  </span>
                </div>
              </div>

              {reviewItem.sourceTurnRef && (
                <div className="text-[11px] text-slate-600 font-mono">
                  <span className="text-slate-400">Source Reference:</span> {reviewItem.sourceTurnRef}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold shadow-xs"
              onClick={() => setReviewItem(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
