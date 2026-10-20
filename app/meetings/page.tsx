'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { marked } from 'marked';
import type { Meeting, TranscriptSegment } from '@/types/meeting';
import type { MeetingDocumentBundle, RequirementBaselineVersion } from '@/types/documentation';
import type { CalendarEvent } from '@/types/calendar';
import type {
  Requirement,
  RequirementQualityIssue,
  ClarificationQuestion,
  CandidateRequirement,
  CandidateRequirementType,
  RequirementPriority,
} from '@/types/requirement';
import type { Project } from '@/types/project';
import {
  VideoIcon,
  PlusIcon,
  CalendarIcon,
  ArrowRightIcon,
  LayersIcon,
  Loader2Icon,
  FileTextIcon,
  PrinterIcon,
  DownloadIcon,
  SparklesIcon,
  CheckCircle2Icon,
  Trash2Icon,
  AlertTriangleIcon,
  HelpCircleIcon,
  CheckIcon,
  ClockIcon,
  GitCommitIcon,
  ExternalLinkIcon,
  ShieldCheckIcon,
  FileCheck2Icon,
  Edit3Icon,
  TagIcon,
  XIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BuildingIcon,
  HomeIcon,
  MessageSquareTextIcon,
  SearchIcon,
  RefreshCwIcon,
  GitBranchIcon,
  UserIcon,
  BotIcon,
  MinusCircleIcon,
  InfoIcon,
  ListChecksIcon,
  UsersIcon,
} from 'lucide-react';

export interface RequirementEvolutionItem {
  id: string;
  currentText: string;
  previousText?: string;
  category: string;
  priority: string;
  status: string;
  evolutionType: 'NEW' | 'UPDATED' | 'REMOVED' | 'STABLE';
  originMeetingId: string;
  originMeetingNumber: number;
  lastUpdatedMeetingId?: string;
  lastUpdatedMeetingNumber?: number;
  changeRationale?: string;
  confidence: number;
  version: string;
}

interface ProjectDetails {
  projectId: string;
  projectName: string;
  clientName?: string;
  clientContact?: string;
  currentVersion: string;
  versions: RequirementBaselineVersion[];
  approvedRequirements: Requirement[];
  candidateRequirements: CandidateRequirement[];
  qualityIssues: RequirementQualityIssue[];
  followUpQuestions: ClarificationQuestion[];
  timelineMeetings: Meeting[];
  calendarEvents: CalendarEvent[];
  masterSrs: string;
  evolutionMatrix?: RequirementEvolutionItem[];
  meetingsChronology?: Array<{
    meetingId: string;
    meetingNumber: number;
    title: string;
    date: string;
    mode: string;
    summaryText: string;
  }>;
}

function MarkdownView({ content }: { content: string }) {
  if (!content) return <div className="text-slate-400 italic p-4">No documentation content generated yet.</div>;
  const rawHtml = marked.parse(content) as string;
  return (
    <div
      className="prose prose-slate max-w-none text-xs sm:text-sm font-sans leading-relaxed text-slate-800
      [&_h1]:text-xl [&_h1]:font-extrabold [&_h1]:text-slate-900 [&_h1]:border-b [&_h1]:border-slate-200 [&_h1]:pb-2 [&_h1]:mb-3 [&_h1]:mt-4
      [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-emerald-700 [&_h2]:border-b [&_h2]:border-slate-200 [&_h2]:pb-1.5 [&_h2]:mb-2 [&_h2]:mt-4
      [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mb-2 [&_h3]:mt-3
      [&_p]:mb-2.5 [&_p]:text-slate-700 [&_p]:leading-relaxed
      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1.5 [&_li]:text-slate-700
      [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:space-y-1.5 [&_li]:text-slate-700
      [&_strong]:font-bold [&_strong]:text-slate-900
      [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-600 [&_blockquote]:bg-emerald-50/60 [&_blockquote]:pl-3.5 [&_blockquote]:py-1.5 [&_blockquote]:my-2.5 [&_blockquote]:italic [&_blockquote]:text-slate-700
      [&_table]:w-full [&_table]:border-collapse [&_table]:my-3.5 [&_table]:text-xs [&_table]:border [&_table]:border-slate-300
      [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:p-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-900
      [&_td]:border [&_td]:border-slate-300 [&_td]:p-2.5 [&_td]:text-slate-800 [&_td]:bg-white
      [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:border [&_code]:border-slate-300 [&_code]:font-mono [&_code]:text-emerald-700 [&_code]:font-semibold"
      dangerouslySetInnerHTML={{ __html: rawHtml }}
    />
  );
}

function TranscriptView({
  segments,
  meetingId,
}: {
  segments: TranscriptSegment[];
  meetingId: string;
}) {
  const [filter, setFilter] = useState<'ALL' | 'CUSTOMER' | 'REQUIREMENT_ENGINEER' | 'SPEC_PILOT'>('ALL');
  const [search, setSearch] = useState('');

  const filtered = segments.filter((s) => {
    if (filter !== 'ALL' && s.speakerRole !== filter) return false;
    if (
      search &&
      !s.text?.toLowerCase().includes(search.toLowerCase()) &&
      !s.speakerName?.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const customerTurns = segments.filter((s) => s.speakerRole === 'CUSTOMER').length;
  const engineerTurns = segments.filter((s) => s.speakerRole === 'REQUIREMENT_ENGINEER').length;
  const pilotTurns = segments.filter((s) => s.speakerRole === 'SPEC_PILOT' || s.speakerId?.includes('pilot')).length;

  const downloadTranscript = () => {
    const textContent = segments
      .map(
        (s) =>
          `[${s.timestamp ? new Date(s.timestamp).toLocaleTimeString() : '00:00'}] ${s.speakerName} (${s.speakerRole}):\n${s.text}\n`
      )
      .join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meetingId}-transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Telemetry bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-800">Turns:</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-medium">
            Total: <strong>{segments.length}</strong>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
            Customer: <strong>{customerTurns}</strong>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-medium">
            Engineer: <strong>{engineerTurns}</strong>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-800 font-medium">
            SpecPilot AI: <strong>{pilotTurns}</strong>
          </span>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={downloadTranscript}
          className="h-7 text-xs border-slate-300 bg-white hover:bg-slate-50 text-slate-700 gap-1.5 shadow-2xs font-semibold"
        >
          <DownloadIcon className="size-3" />
          <span>Export .txt</span>
        </Button>
      </div>

      {/* Filter and search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs shadow-2xs">
          {(['ALL', 'CUSTOMER', 'REQUIREMENT_ENGINEER', 'SPEC_PILOT'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                filter === f
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {f === 'ALL'
                ? 'All Speakers'
                : f === 'CUSTOMER'
                ? 'Customer'
                : f === 'REQUIREMENT_ENGINEER'
                ? 'Engineer'
                : 'SpecPilot AI'}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[180px] relative">
          <SearchIcon className="size-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search spoken words or questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Transcript speech bubbles */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
          No spoken turns found matching current filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((seg, idx) => {
            const isPilot = seg.speakerRole === 'SPEC_PILOT' || seg.speakerId?.includes('pilot');
            const isCustomer = seg.speakerRole === 'CUSTOMER';

            return (
              <div
                key={seg.id || `turn-${idx}`}
                className={`p-3.5 rounded-xl border transition-all ${
                  isPilot
                    ? 'bg-purple-50/70 border-purple-200 text-purple-950 shadow-2xs'
                    : isCustomer
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-900 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        isPilot
                          ? 'bg-purple-100 text-purple-800 border-purple-300'
                          : isCustomer
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-blue-100 text-blue-800 border-blue-300'
                      }`}
                    >
                      {seg.speakerName}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-mono font-semibold">
                      {seg.speakerRole}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {seg.timestamp ? new Date(seg.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed pl-1 font-medium">
                  &ldquo;{seg.text}&rdquo;
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CalendarDayCell {
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

function InteractiveCalendarBox({
  events = [],
  onScheduleClick,
}: {
  events: CalendarEvent[];
  onScheduleClick: () => void;
}) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [hoveredDayCell, setHoveredDayCell] = useState<{
    dateStr: string;
    events: CalendarEvent[];
    x: number;
    y: number;
  } | null>(null);

  // Deduplicate events by date + title
  const uniqueEvents = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    for (const ev of events) {
      const key = `${ev.date}-${(ev.title || '').toLowerCase().trim()}`;
      if (!map.has(key)) {
        map.set(key, ev);
      }
    }
    return Array.from(map.values());
  }, [events]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const jumpToday = () => setCurrentDate(new Date());

  // Generate calendar grid (6 rows of 7 days)
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const todayStr = new Date().toISOString().split('T')[0];

  const cells: CalendarDayCell[] = [];

  // Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevDate = new Date(year, month - 1, d);
    const dateStr = prevDate.toISOString().split('T')[0];
    const dayEvents = uniqueEvents.filter((e: CalendarEvent) => e.date === dateStr);
    cells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      events: dayEvents,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const curDate = new Date(year, month, d);
    const dateStr = curDate.toISOString().split('T')[0];
    const dayEvents = uniqueEvents.filter((e: CalendarEvent) => e.date === dateStr);
    cells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      events: dayEvents,
    });
  }

  // Next month leading days to complete grid
  const remaining = 35 - cells.length > 0 ? 35 - cells.length : 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextDate = new Date(year, month + 1, d);
    const dateStr = nextDate.toISOString().split('T')[0];
    const dayEvents = uniqueEvents.filter((e: CalendarEvent) => e.date === dateStr);
    cells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      events: dayEvents,
    });
  }

  // Color generator based on mode / follow-up type
  const getEventBadgeColor = (ev: CalendarEvent) => {
    if (ev.linkedMeetingId || ev.title.toLowerCase().includes('follow-up') || ev.title.toLowerCase().includes('reschedul')) {
      return 'bg-purple-100 text-purple-800 border-purple-300 shadow-2xs font-semibold';
    }
    if (ev.meetingMode === 'autonomous') {
      return 'bg-cyan-100 text-cyan-800 border-cyan-300 shadow-2xs font-semibold';
    }
    return 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-2xs font-semibold';
  };

  return (
    <div className="space-y-3 font-sans relative">
      {/* Month Navigator Bar */}
      <div className="flex items-center justify-between bg-slate-100 p-2 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-900">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={jumpToday}
            className="text-[10px] px-2 py-0.5 rounded bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-200 shadow-2xs transition-colors"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="size-6 flex items-center justify-center rounded hover:bg-white text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors border border-transparent hover:border-slate-200"
            title="Previous Month"
          >
            &larr;
          </button>
          <button
            onClick={nextMonth}
            className="size-6 flex items-center justify-center rounded hover:bg-white text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors border border-transparent hover:border-slate-200"
            title="Next Month"
          >
            &rarr;
          </button>
        </div>
      </div>

      {/* Weekday Header */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar 7xN Grid */}
      <div className="grid grid-cols-7 gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
        {cells.map((cell, idx) => {
          const hasEvents = cell.events.length > 0;
          const hasReschedule = cell.events.some(
            (e) => e.linkedMeetingId || e.title.toLowerCase().includes('follow-up') || e.title.toLowerCase().includes('reschedul')
          );
          const hasAutonomous = cell.events.some((e) => e.meetingMode === 'autonomous');

          // Determine distinct cell highlight color
          let cellStyle = 'border-transparent bg-slate-100/50 text-slate-400';
          if (cell.isToday) {
            cellStyle = 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/40 font-bold';
          } else if (hasReschedule) {
            cellStyle = 'border-purple-300 bg-purple-50/80 text-purple-900 shadow-2xs ring-1 ring-purple-300 hover:bg-purple-100 cursor-pointer';
          } else if (hasAutonomous) {
            cellStyle = 'border-cyan-300 bg-cyan-50/80 text-cyan-900 shadow-2xs ring-1 ring-cyan-300 hover:bg-cyan-100 cursor-pointer';
          } else if (hasEvents) {
            cellStyle = 'border-emerald-300 bg-emerald-50/80 text-emerald-900 shadow-2xs ring-1 ring-emerald-300 hover:bg-emerald-100 cursor-pointer';
          } else if (cell.isCurrentMonth) {
            cellStyle = 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-800';
          }

          return (
            <div
              key={`${cell.dateStr}-${idx}`}
              onMouseEnter={(e) => {
                if (hasEvents) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredDayCell({
                    dateStr: cell.dateStr,
                    events: cell.events,
                    x: Math.min(rect.left + rect.width / 2, typeof window !== 'undefined' ? window.innerWidth - 180 : rect.left),
                    y: rect.bottom + 6,
                  });
                }
              }}
              onMouseLeave={() => setHoveredDayCell(null)}
              className={`min-h-[56px] p-1.5 rounded-lg border transition-all flex flex-col justify-between ${cellStyle}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-mono leading-none ${
                    cell.isToday
                      ? 'font-bold text-emerald-700'
                      : hasReschedule
                      ? 'font-bold text-purple-800'
                      : hasEvents
                      ? 'font-bold text-slate-900'
                      : cell.isCurrentMonth
                      ? 'text-slate-700 font-semibold'
                      : 'text-slate-400'
                  }`}
                >
                  {cell.dayNum}
                </span>

                {hasEvents && (
                  <span
                    className={`size-2 rounded-full ${
                      hasReschedule ? 'bg-purple-600' : hasAutonomous ? 'bg-cyan-600' : 'bg-emerald-600'
                    }`}
                    title={`${cell.events.length} meeting(s)`}
                  />
                )}
              </div>

              {/* Event pills inside date cell */}
              <div className="space-y-0.5 mt-1 overflow-hidden">
                {cell.events.slice(0, 2).map((ev) => (
                  <div
                    key={ev.id}
                    className={`text-[9px] px-1 py-0.5 rounded truncate border font-medium flex items-center gap-1 ${getEventBadgeColor(
                      ev
                    )}`}
                  >
                    <span className="flex items-center shrink-0">
                      {ev.linkedMeetingId || ev.title.toLowerCase().includes('follow-up') ? (
                        <RefreshCwIcon className="size-2.5 text-purple-600" />
                      ) : (
                        <CalendarIcon className="size-2.5 text-slate-500" />
                      )}
                    </span>
                    <span className="truncate">{ev.title}</span>
                  </div>
                ))}
                {cell.events.length > 2 && (
                  <div className="text-[8px] font-mono text-slate-500 font-semibold text-center">
                    +{cell.events.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend & Quick Schedule */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-slate-600">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5">
            <RefreshCwIcon className="size-3 text-purple-600" />
            <span className="text-purple-800 font-medium">Rescheduled</span>
          </span>
          <span className="flex items-center gap-1.5">
            <BotIcon className="size-3 text-cyan-600" />
            <span className="text-cyan-800 font-medium">Autonomous</span>
          </span>
          <span className="flex items-center gap-1.5">
            <UsersIcon className="size-3 text-emerald-600" />
            <span className="text-emerald-800 font-medium">Assisted</span>
          </span>
        </div>

        <button
          onClick={onScheduleClick}
          className="text-emerald-700 hover:text-emerald-800 font-bold underline text-[11px]"
        >
          + Add Session
        </button>
      </div>

      {/* Hover Floating Details Card on Date Cell */}
      {hoveredDayCell && (
        <div
          className="fixed z-50 w-80 rounded-xl bg-white border border-slate-200 p-3.5 shadow-2xl space-y-3 pointer-events-none transform -translate-x-1/2 transition-opacity duration-150 animate-in fade-in zoom-in-95"
          style={{ top: hoveredDayCell.y, left: hoveredDayCell.x }}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <CalendarIcon className="size-3.5 text-slate-500" />
              <span>
                {new Date(hoveredDayCell.dateStr + 'T00:00:00').toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </span>
            <Badge className="bg-slate-100 text-slate-700 text-[10px] font-mono border-slate-200">
              {hoveredDayCell.events.length} {hoveredDayCell.events.length === 1 ? 'Meeting' : 'Meetings'}
            </Badge>
          </div>

          <div className="space-y-2.5 max-h-64 overflow-y-auto">
            {hoveredDayCell.events.map((ev) => {
              const isReschedule =
                ev.linkedMeetingId ||
                ev.title.toLowerCase().includes('follow-up') ||
                ev.title.toLowerCase().includes('reschedul');

              return (
                <div
                  key={ev.id}
                  className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${
                    isReschedule
                      ? 'bg-purple-50 border-purple-200'
                      : ev.meetingMode === 'autonomous'
                      ? 'bg-cyan-50 border-cyan-200'
                      : 'bg-emerald-50 border-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1 ${
                        isReschedule
                          ? 'bg-purple-100 text-purple-800'
                          : ev.meetingMode === 'autonomous'
                          ? 'bg-cyan-100 text-cyan-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isReschedule ? (
                        <>
                          <RefreshCwIcon className="size-2.5" />
                          <span>Rescheduled Follow-Up</span>
                        </>
                      ) : (
                        <span>{ev.meetingMode} Meeting</span>
                      )}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 font-semibold flex items-center gap-1">
                      <ClockIcon className="size-2.5 text-slate-400" />
                      <span>{ev.startTime} - {ev.endTime}</span>
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 leading-snug">
                    {ev.title}
                  </h4>

                  {ev.description && (
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {ev.description}
                    </p>
                  )}

                  {ev.agenda && ev.agenda.length > 0 && (
                    <div className="pt-1 border-t border-slate-200/80 space-y-0.5">
                      <span className="text-[9px] font-bold uppercase text-slate-500">Planned Agenda:</span>
                      {ev.agenda.slice(0, 3).map((item, i) => (
                        <div key={i} className="text-[10px] text-slate-700 flex items-start gap-1">
                          <span className="text-emerald-600">&bull;</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MeetingsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 gap-2">
          <Loader2Icon className="size-6 animate-spin text-emerald-500" />
          <span>Loading project workspace...</span>
        </div>
      }
    >
      <MeetingsPageContent />
    </Suspense>
  );
}

function MeetingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedProjectId = searchParams.get('projectId');

  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projectData, setProjectData] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  // Per-meeting Intelligence & Candidate Requirements state (keyed by meetingId)
  const [meetingIntelMap, setMeetingIntelMap] = useState<
    Record<string, { candidateRequirements: CandidateRequirement[]; expanded: boolean }>
  >({});

  // Editing state for inline feature edits
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingType, setEditingType] = useState<CandidateRequirementType>('FUNCTIONAL');
  const [editingPriority, setEditingPriority] = useState<RequirementPriority>('high');
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  // New feature input state (keyed by meetingId)
  const [newFeatureText, setNewFeatureText] = useState<Record<string, string>>({});
  const [newFeatureType, setNewFeatureType] = useState<Record<string, CandidateRequirementType>>({});

  // Per-meeting Documents Modal state
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [selectedDocTab, setSelectedDocTab] = useState<'srs' | 'summary' | 'requirements' | 'decisions' | 'traceability' | 'versions' | 'transcript'>('summary');
  const [docBundle, setDocBundle] = useState<MeetingDocumentBundle | null>(null);
  const [docVersions, setDocVersions] = useState<RequirementBaselineVersion[]>([]);
  const [meetingTranscript, setMeetingTranscript] = useState<TranscriptSegment[]>([]);
  const [docLoading, setDocLoading] = useState(false);
  const [addingFeatureMeetingId, setAddingFeatureMeetingId] = useState<string | null>(null);

  // In-card Tab switcher ('requirements' | 'transcript') and direct card transcript storage
  const [cardTab, setCardTab] = useState<Record<string, 'requirements' | 'transcript'>>({});
  const [cardTranscripts, setCardTranscripts] = useState<Record<string, TranscriptSegment[]>>({});
  const [loadingCardTranscriptId, setLoadingCardTranscriptId] = useState<string | null>(null);

  const loadTranscriptForMeetingCard = async (meetingId: string) => {
    if (cardTranscripts[meetingId]) return;
    setLoadingCardTranscriptId(meetingId);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/transcript?projectId=${activeProjectId}`);
      if (res.ok) {
        const data = await res.json();
        const segs = Array.isArray(data) ? data : data?.segments || [];
        setCardTranscripts((prev) => ({ ...prev, [meetingId]: segs }));
      }
    } catch (e) {
      console.warn('Failed to fetch card transcript:', e);
    } finally {
      setLoadingCardTranscriptId(null);
    }
  };

  // Master Living Document Modal state
  const [isMasterDocOpen, setIsMasterDocOpen] = useState(false);
  const [masterDocTab, setMasterDocTab] = useState<'srs' | 'evolution' | 'requirements' | 'issues' | 'versions'>('srs');
  const [evolutionFilter, setEvolutionFilter] = useState<'ALL' | 'NEW' | 'UPDATED' | 'REMOVED' | 'STABLE'>('ALL');

  // Follow-up scheduling modal state inside Project Box
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('14:00');
  const [scheduleMode, setScheduleMode] = useState<'assisted' | 'autonomous'>('assisted');
  const [scheduleAgenda, setScheduleAgenda] = useState('');
  const [scheduling, setScheduling] = useState(false);

  // 1. Initial Load: Fetch Projects list
  useEffect(() => {
    async function initProjects() {
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const list: Project[] = await res.json();
          setAllProjects(list);
          if (list.length > 0) {
            const matched = requestedProjectId
              ? list.find((p) => p.id === requestedProjectId) || list[0]
              : list[0];
            setActiveProjectId(matched.id);
            setActiveProject(matched);
          }
        }
      } catch (e) {
        console.warn('Failed to load projects list:', e);
      }
    }
    initProjects();
  }, [requestedProjectId]);

  // 2. Fetch Project Data & Meeting Timeline whenever activeProjectId changes
  const refreshProjectData = useCallback(async () => {
    if (!activeProjectId) {
      setLoading(false);
      return;
    }
    try {
      const [meetingsRes, projectRes] = await Promise.all([
        fetch(`/api/meetings?projectId=${activeProjectId}`),
        fetch(`/api/projects/${activeProjectId}`),
      ]);

      let mList: Meeting[] = [];
      if (meetingsRes.ok) {
        mList = await meetingsRes.json();
        setMeetings(mList);
      }

      if (projectRes.ok) {
        const pData: ProjectDetails = await projectRes.json();
        setProjectData(pData);
      }

      // Fetch intelligence / features for each meeting
      const intelEntries: Record<string, { candidateRequirements: CandidateRequirement[]; expanded: boolean }> = {};
      for (const m of mList) {
        try {
          const iRes = await fetch(`/api/meetings/${m.id}/intelligence?projectId=${activeProjectId}`);
          if (iRes.ok) {
            const iData = await iRes.json();
            intelEntries[m.id] = {
              candidateRequirements: iData?.candidateRequirements || [],
              expanded: true, // expanded by default for easy review
            };
          }
        } catch {}
      }
      setMeetingIntelMap(intelEntries);
    } catch (e) {
      console.warn('Failed to refresh project data:', e);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (activeProjectId) {
      setLoading(true);
      refreshProjectData();
    }
  }, [activeProjectId, refreshProjectData]);

  // Project switcher change
  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    const p = allProjects.find((x) => x.id === projectId) || null;
    setActiveProject(p);
    router.push(`/meetings?projectId=${projectId}`);
  };

  // Toggle Meeting Features expansion
  const toggleMeetingFeatures = (meetingId: string) => {
    setMeetingIntelMap((prev) => ({
      ...prev,
      [meetingId]: {
        candidateRequirements: prev[meetingId]?.candidateRequirements || [],
        expanded: !prev[meetingId]?.expanded,
      },
    }));
  };

  // Delete Meeting
  const handleDeleteMeeting = async (meetingId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete meeting "${meetingId}" and all its transcripts, intelligence, and generated documents?`)) {
      return;
    }
    setDeletingId(meetingId);
    try {
      const res = await fetch(`/api/meetings/${meetingId}?projectId=${activeProjectId}`, { method: 'DELETE' });
      if (res.ok) {
        setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
        if (selectedMeetingId === meetingId) setSelectedMeetingId(null);
        await refreshProjectData();
      } else {
        alert('Failed to delete meeting');
      }
    } catch {
      alert('Network error deleting meeting');
    } finally {
      setDeletingId(null);
    }
  };

  // Granular Engineer Feature Actions: Approve, Edit, Tag to Ask in Next Meet
  const handleReviewFeature = async (
    meetingId: string,
    reqItem: CandidateRequirement,
    action: 'APPROVE' | 'TAG_NEXT_MEET' | 'REJECT' | 'SAVE_EDIT'
  ) => {
    setUpdatingItemId(reqItem.id);
    try {
      let payload: Record<string, any> = { id: reqItem.id };

      if (action === 'APPROVE') {
        payload.status = 'APPROVED';
        payload.notes = 'Approved by Lead Requirement Engineer';
      } else if (action === 'TAG_NEXT_MEET') {
        payload.status = 'TAGGED_FOR_NEXT_MEETING';
        payload.taggedForNextMeeting = true;
        payload.notes = 'Flagged by Requirement Engineer to clarify with customer in next meeting';
      } else if (action === 'REJECT') {
        payload.status = 'REJECTED';
        payload.notes = 'Marked out of scope / rejected';
      } else if (action === 'SAVE_EDIT') {
        payload.requirementText = editingText;
        payload.type = editingType;
        payload.priority = editingPriority;
      }

      const projId = meetings.find((m) => m.id === meetingId)?.projectId || activeProjectId;
      const res = await fetch(`/api/meetings/${meetingId}/review-item?projectId=${projId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const { item: updatedItem } = await res.json();
        setMeetingIntelMap((prev) => {
          const currentList = prev[meetingId]?.candidateRequirements || [];
          const updatedList = currentList.map((r) => (r.id === reqItem.id ? updatedItem : r));
          return {
            ...prev,
            [meetingId]: {
              ...prev[meetingId],
              candidateRequirements: updatedList,
            },
          };
        });
        setEditingItemId(null);
        await refreshProjectData();
      } else {
        alert('Failed to update feature');
      }
    } catch (e: unknown) {
      alert('Error updating feature');
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Add a new feature manually to a meeting
  const handleAddFeatureManually = async (meetingId: string) => {
    const text = newFeatureText[meetingId]?.trim();
    if (!text) return;
    const type = newFeatureType[meetingId] || 'FUNCTIONAL';
    const newId = `CR-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    const targetMeeting = meetings.find((m) => m.id === meetingId);
    const projId = targetMeeting?.projectId || activeProjectId;

    setAddingFeatureMeetingId(meetingId);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/review-item?projectId=${projId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId,
          requirementText: text,
          type,
          status: 'PROPOSED',
          priority: 'high',
        }),
      });

      if (res.ok) {
        const { item: newItem } = await res.json();
        setMeetingIntelMap((prev) => ({
          ...prev,
          [meetingId]: {
            ...prev[meetingId],
            candidateRequirements: [...(prev[meetingId]?.candidateRequirements || []), newItem],
          },
        }));
        setNewFeatureText((prev) => ({ ...prev, [meetingId]: '' }));
        await refreshProjectData();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(`Failed to add feature: ${errJson.error || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Error adding feature: ${err?.message || 'Network error'}`);
    } finally {
      setAddingFeatureMeetingId(null);
    }
  };

  // Bulk Approve All Items in a meeting
  const handleBulkApproveMeetingItems = async (meetingId: string) => {
    setApproving(true);
    const targetMeeting = meetings.find((m) => m.id === meetingId);
    const projId = targetMeeting?.projectId || activeProjectId;
    try {
      const res = await fetch(`/api/meetings/${meetingId}/review-item?projectId=${projId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approveAll: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setMeetingIntelMap((prev) => ({
          ...prev,
          [meetingId]: {
            ...prev[meetingId],
            candidateRequirements: data.candidateRequirements || [],
          },
        }));
        await refreshProjectData();
        const docRes = await fetch(`/api/meetings/${meetingId}/documents?projectId=${projId}`);
        if (docRes.ok) {
          const docData = await docRes.json();
          setDocBundle(docData.bundle);
          setDocVersions(docData.versions || []);
        }
      } else {
        alert('Failed to approve all items');
      }
    } catch {
      alert('Error during bulk approval');
    } finally {
      setApproving(false);
    }
  };

  // Human Engineer Baseline Approval & Sign-Off (Project or Meeting)
  const handleApproveBaseline = async (meetingId?: string) => {
    setApproving(true);
    try {
      const targetMeeting = meetingId ? meetings.find((m) => m.id === meetingId) : null;
      const projId = targetMeeting?.projectId || activeProjectId;
      const url = meetingId
        ? `/api/meetings/${meetingId}/approve?projectId=${projId}`
        : `/api/projects/${activeProjectId}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'Lead Requirement Engineer' }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✓ Official Baseline Approved and Stamped as ${data.versionLabel}!`);
        await refreshProjectData();
        if (selectedMeetingId) {
          openDocumentsModal(selectedMeetingId);
        }
      } else {
        alert(`Approval error: ${data.error || 'Server error'}`);
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'Approval failed';
      alert(`Approval failed: ${err}`);
    } finally {
      setApproving(false);
    }
  };

  // Force re-analyze transcript for an existing meeting
  const handleReanalyzeTranscript = async (meetingId: string) => {
    if (!meetingId) return;
    const targetMeeting = meetings.find((m) => m.id === meetingId);
    const projId = targetMeeting?.projectId || activeProjectId;
    setReanalyzing(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/reanalyze?projectId=${projId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh intelligence and documents
        await refreshProjectData();
        // Reload doc modal
        const docRes = await fetch(`/api/meetings/${meetingId}/documents?projectId=${projId}`);
        if (docRes.ok) {
          const docData = await docRes.json();
          setDocBundle(docData.bundle);
          setDocVersions(docData.versions || []);
        }
        // Refresh transcript
        const txRes = await fetch(`/api/meetings/${meetingId}/transcript?projectId=${projId}`);
        if (txRes.ok) {
          const txData = await txRes.json();
          setMeetingTranscript(txData.segments || txData || []);
        }
        alert(`Re-analysis complete. Extracted ${data.requirementsExtracted || 0} candidate requirements from transcript.`);
      } else {
        alert(`Re-analysis failed: ${data.error || 'Server error'}`);
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'Network error';
      alert(`Re-analysis error: ${err}`);
    } finally {
      setReanalyzing(false);
    }
  };

  // Open Documents Modal for a meeting (optionally open directly to a specific tab)
  const openDocumentsModal = async (meetingId: string, initialTab: 'srs' | 'summary' | 'requirements' | 'decisions' | 'traceability' | 'versions' | 'transcript' = 'summary') => {
    setSelectedMeetingId(meetingId);
    setSelectedDocTab(initialTab);
    setDocLoading(true);

    const targetMeeting = meetings.find((m) => m.id === meetingId);
    const projId = targetMeeting?.projectId || activeProjectId;

    try {
      const [docRes, transcriptRes] = await Promise.all([
        fetch(`/api/meetings/${meetingId}/documents?projectId=${projId}`),
        fetch(`/api/meetings/${meetingId}/transcript?projectId=${projId}`).catch(() => null),
      ]);

      if (docRes.ok) {
        const data = await docRes.json();
        setDocBundle(data.bundle);
        setDocVersions(data.versions || []);
      }

      if (transcriptRes && transcriptRes.ok) {
        const transcriptData = await transcriptRes.json();
        setMeetingTranscript(Array.isArray(transcriptData) ? transcriptData : transcriptData?.segments || []);
      } else {
        setMeetingTranscript([]);
      }
    } catch (e) {
      console.warn('Failed to fetch meeting documents or transcript:', e);
    } finally {
      setDocLoading(false);
    }
  };

  // Open Schedule Follow-Up Modal with pre-filled items tagged for next meet
  const openScheduleFollowUpModal = () => {
    // Gather all items tagged for next meet across meetings
    const taggedItems: string[] = [];
    Object.values(meetingIntelMap).forEach((intel) => {
      intel.candidateRequirements.forEach((r) => {
        if (r.status === 'TAGGED_FOR_NEXT_MEETING' || r.taggedForNextMeeting) {
          taggedItems.push(`Clarify requirement: "${r.requirementText}"`);
        }
      });
    });

    setScheduleTitle(
      taggedItems.length > 0
        ? `Clarification Follow-Up: ${taggedItems.length} Tagged Requirements`
        : 'Requirement Clarification & Architecture Follow-Up'
    );
    setScheduleAgenda(taggedItems.join('\n'));
    setIsScheduleModalOpen(true);
  };

  // Create Follow-Up in Calendar
  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleDate || !scheduleTitle) {
      alert('Please provide a meeting title and date');
      return;
    }
    setScheduling(true);
    try {
      const newMeetingId = `meeting-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: newMeetingId,
          projectId: activeProjectId,
          title: scheduleTitle,
          date: scheduleDate,
          startTime: scheduleTime,
          endTime: '14:45',
          meetingMode: scheduleMode,
          description: `Follow-up session to resolve tagged requirements and open ambiguities with ${activeProject?.clientName || 'Client'}.`,
          agenda: scheduleAgenda.split('\n').filter(Boolean),
          participants: [
            { name: 'Lead Requirement Engineer', role: 'REQUIREMENT_ENGINEER' },
            { name: activeProject?.clientContact || 'Customer Stakeholder', role: 'CUSTOMER' },
          ],
        }),
      });

      if (res.ok) {
        setIsScheduleModalOpen(false);
        setScheduleTitle('');
        setScheduleDate('');
        setScheduleAgenda('');
        await refreshProjectData();
      } else {
        alert('Failed to schedule event');
      }
    } catch {
      alert('Network error scheduling event');
    } finally {
      setScheduling(false);
    }
  };

  const downloadMarkdown = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const timelineMeetings = projectData?.timelineMeetings || meetings;

  // Session candidate requirement stats
  let totalSessionCandidates = 0;
  let totalSessionApproved = 0;
  let totalSessionPending = 0;
  let totalTaggedForNextMeet = 0;

  Object.values(meetingIntelMap).forEach((intel) => {
    (intel.candidateRequirements || []).forEach((r) => {
      totalSessionCandidates++;
      if (r.status === 'APPROVED') {
        totalSessionApproved++;
      } else if (r.status === 'TAGGED_FOR_NEXT_MEETING' || r.taggedForNextMeeting) {
        totalTaggedForNextMeet++;
      } else {
        totalSessionPending++;
      }
    });
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 font-medium transition-colors">
                <HomeIcon className="size-4 text-emerald-600" />
                <span className="text-xs font-mono uppercase tracking-wider font-bold">Home Dashboard</span>
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-xs text-slate-600 font-medium">Projects</span>
              <span className="text-slate-300">/</span>
              <span className="text-xs text-emerald-700 font-mono font-extrabold">
                {activeProject?.name || activeProjectId || 'Active Project'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex flex-wrap items-center gap-3">
              <span>{activeProject?.name || 'Requirement Project Workspace'}</span>
              {activeProject?.clientName && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-800 flex items-center gap-1.5 shadow-2xs">
                  <BuildingIcon className="size-3 text-emerald-600" />
                  <span>Client: {activeProject.clientName}</span>
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-600">
              Autonomous meeting timeline, per-feature engineer review, living SRS specification, and calendar coordination.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Project Switcher Dropdown */}
            {allProjects.length > 1 && (
              <select
                value={activeProjectId}
                onChange={(e) => handleSelectProject(e.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 font-semibold shadow-2xs"
              >
                {allProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.clientName})
                  </option>
                ))}
              </select>
            )}

            <Button
              variant="outline"
              onClick={() => setIsMasterDocOpen(true)}
              className="border-slate-300 bg-white hover:bg-slate-50 text-slate-800 gap-2 font-bold text-xs h-9 shadow-2xs"
            >
              <FileCheck2Icon className="size-4 text-emerald-600" />
              <span>Master Living SRS</span>
            </Button>

            <Button
              onClick={() => handleApproveBaseline()}
              disabled={approving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold text-xs h-9 shadow-sm shadow-emerald-600/20"
            >
              {approving ? <Loader2Icon className="size-4 animate-spin" /> : <ShieldCheckIcon className="size-4" />}
              <span>Approve Baseline</span>
            </Button>

            <Link href={`/meetings/new?projectId=${activeProjectId}`}>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-bold text-xs h-9 shadow-sm shadow-indigo-600/20">
                <PlusIcon className="size-4" />
                <span>New Discovery Meet</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* PROJECT OVERVIEW BOX */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 md:p-6 shadow-sm space-y-6">
          {/* Project Box Banner */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-xs font-bold px-2.5 py-0.5">
                  {projectData?.currentVersion || activeProject?.currentVersion || 'v1.0-Draft'}
                </Badge>
                <span className="text-xs font-mono text-slate-500 font-medium">ID: {activeProjectId}</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2Icon className="size-3.5" />
                  <span>Interactive RE Review Enabled</span>
                </span>
              </div>
              <p className="text-xs text-slate-600 max-w-2xl font-medium">
                {activeProject?.description || 'Autonomous requirement gathering session and continuous living baseline for client discovery.'}
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center shadow-2xs">
                <div className="text-slate-500 uppercase text-[10px] font-bold">Meetings</div>
                <div className="text-lg font-extrabold text-slate-900 mt-0.5">{timelineMeetings.length}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Recorded sessions</div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center shadow-2xs">
                <div className="text-slate-500 uppercase text-[10px] font-bold">Session Captured</div>
                <div className="text-lg font-extrabold text-blue-700 mt-0.5">{totalSessionCandidates}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">From transcripts</div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-center shadow-2xs">
                <div className="text-emerald-800 uppercase text-[10px] font-bold">Approved By You</div>
                <div className="text-lg font-extrabold text-emerald-700 mt-0.5">
                  {totalSessionApproved} <span className="text-xs font-normal text-emerald-600">/ {totalSessionCandidates}</span>
                </div>
                <div className="text-[10px] text-emerald-700 font-medium mt-0.5">Engineer reviewed</div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-center shadow-2xs">
                <div className="text-amber-800 uppercase text-[10px] font-bold">Pending Review</div>
                <div className="text-lg font-extrabold text-amber-700 mt-0.5">{totalSessionPending}</div>
                <div className="text-[10px] text-amber-700 font-medium mt-0.5">Awaiting signoff</div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center col-span-2 sm:col-span-1 shadow-2xs">
                <div className="text-slate-600 uppercase text-[10px] font-bold">Global Baseline</div>
                <div className="text-lg font-extrabold text-slate-900 mt-0.5">{projectData?.approvedRequirements.length || 0}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">v1.0 Specifications</div>
              </div>
            </div>
          </div>

          {/* TWO-COLUMN PROJECT WORKSPACE: TIMELINE ON LEFT, CALENDAR & ANALYSIS ON RIGHT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT: MEETING TIMELINE JOURNEY & PER-FEATURE REVIEW (7 COLS) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitCommitIcon className="size-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Meeting Journey &amp; Feature Review Timeline
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-mono font-semibold">
                  {timelineMeetings.length} Recorded Sessions
                </span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
                  <Loader2Icon className="size-5 animate-spin text-emerald-600" />
                  <span className="text-xs font-medium">Loading meeting journey...</span>
                </div>
              ) : timelineMeetings.length === 0 ? (
                <Card className="border-dashed border-slate-300 bg-white shadow-xs text-center py-12">
                  <CardHeader className="space-y-2">
                    <VideoIcon className="size-8 text-slate-400 mx-auto" />
                    <CardTitle className="text-sm font-bold text-slate-800">No Meetings In Journey</CardTitle>
                    <CardDescription className="text-xs text-slate-500 max-w-sm mx-auto">
                      Schedule your first discovery session with {activeProject?.clientName || 'the client'} to gather and review requirements.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Link href={`/meetings/new?projectId=${activeProjectId}`}>
                      <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 gap-2 shadow-xs">
                        <PlusIcon className="size-3.5" />
                        <span>Launch First Meeting</span>
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                  {timelineMeetings.map((m, idx) => {
                    const isAutonomous = m.mode === 'autonomous';
                    const meetDate = m.createdAt ? new Date(m.createdAt).toLocaleString() : 'Recently';
                    const isDeleting = deletingId === m.id;
                    const intel = meetingIntelMap[m.id];
                    const candidates = intel?.candidateRequirements || [];
                    const isExpanded = intel?.expanded ?? true;

                    return (
                      <div key={m.id || idx} className="relative group">
                        {/* Timeline Node Dot */}
                        <div className="absolute -left-6 top-4 flex size-5 items-center justify-center rounded-full bg-white border-2 border-emerald-600 text-[10px] font-extrabold text-emerald-700 shadow-sm">
                          {idx + 1}
                        </div>

                        {/* Meeting Card */}
                        <div className="rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all p-5 space-y-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  className={`text-[10px] font-bold uppercase px-2 py-0.5 border ${
                                    isAutonomous
                                      ? 'border-purple-300 bg-purple-50 text-purple-800'
                                      : 'border-blue-300 bg-blue-50 text-blue-800'
                                  }`}
                                >
                                  {isAutonomous ? 'Autonomous Follow-Up' : 'Engineer-Assisted'}
                                </Badge>
                                <span className="text-xs font-bold text-emerald-700 font-mono">
                                  Meeting #{idx + 1}
                                </span>
                                <span className="text-[11px] font-mono text-slate-500 font-medium">
                                  {m.id}
                                </span>
                              </div>
                              <h4 className="text-base font-bold text-slate-900">
                                {m.title && !m.title.includes('undefined') ? m.title : `Requirement Discovery #${idx + 1}`}
                              </h4>
                            </div>

                            {/* Delete Meeting Button */}
                            <button
                              onClick={(e) => handleDeleteMeeting(m.id, e)}
                              disabled={isDeleting}
                              title="Delete meeting and all assets"
                              className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              {isDeleting ? (
                                <Loader2Icon className="size-4 animate-spin text-red-600" />
                              ) : (
                                <Trash2Icon className="size-4" />
                              )}
                            </button>
                          </div>

                          {/* Meeting Date & Meta */}
                          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                            <span className="flex items-center gap-1 text-[11px]">
                              <ClockIcon className="size-3 text-slate-400" />
                              <span>{meetDate}</span>
                            </span>
                            <span className="text-slate-300">&bull;</span>
                            <button
                              onClick={() => toggleMeetingFeatures(m.id)}
                              className="text-emerald-700 hover:text-emerald-800 text-xs font-bold flex items-center gap-1"
                            >
                              <span>{candidates.length} Features Elicited</span>
                              {isExpanded ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
                            </button>
                          </div>

                          {/* GRANULAR FEATURE REVIEW & APPROVAL LIST */}
                          {isExpanded && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
                              {/* Sub-tab Navigation */}
                              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setCardTab((prev) => ({ ...prev, [m.id]: 'requirements' }))}
                                    className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                                      (cardTab[m.id] || 'requirements') === 'requirements'
                                        ? 'bg-white text-emerald-800 border border-slate-200 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                    }`}
                                  >
                                    <ListChecksIcon className="size-3.5 text-emerald-700" />
                                    <span>Elicited Features ({candidates.length})</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCardTab((prev) => ({ ...prev, [m.id]: 'transcript' }));
                                      loadTranscriptForMeetingCard(m.id);
                                    }}
                                    className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                                      cardTab[m.id] === 'transcript'
                                        ? 'bg-white text-purple-800 border border-slate-200 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                    }`}
                                  >
                                    <MessageSquareTextIcon className="size-3 text-purple-600" />
                                    <span>Full Transcript</span>
                                  </button>
                                </div>

                                {candidates.filter((c) => c.status !== 'APPROVED').length > 0 && (cardTab[m.id] || 'requirements') === 'requirements' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleBulkApproveMeetingItems(m.id)}
                                    disabled={approving}
                                    className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 shadow-xs gap-1"
                                  >
                                    <CheckIcon className="size-3.5" />
                                    <span>Approve All ({candidates.filter((c) => c.status !== 'APPROVED').length})</span>
                                  </Button>
                                )}
                              </div>

                              {cardTab[m.id] === 'transcript' ? (
                                <div className="space-y-2 max-h-80 overflow-y-auto pr-1 font-sans">
                                  {loadingCardTranscriptId === m.id ? (
                                    <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                                      <Loader2Icon className="size-4 animate-spin text-purple-600" />
                                      <span>Loading meeting transcript segments...</span>
                                    </div>
                                  ) : (cardTranscripts[m.id] || []).length === 0 ? (
                                    <div className="py-6 text-center text-slate-500 text-xs font-medium">
                                      No transcript segments recorded for this session.
                                    </div>
                                  ) : (
                                    (cardTranscripts[m.id] || []).map((seg, sIdx) => {
                                      const isCustomer = seg.speakerRole === 'CUSTOMER' || (seg.speakerRole as string) === 'customer';
                                      const isPilot = seg.speakerRole === 'SPEC_PILOT' || (seg.speakerRole as string) === 'agent' || seg.speakerId?.includes('pilot');
                                      return (
                                        <div
                                          key={sIdx}
                                          className={`p-3 rounded-xl border text-xs space-y-1.5 shadow-xs ${
                                            isCustomer
                                              ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                                              : isPilot
                                              ? 'bg-purple-50/80 border-purple-200 text-purple-950'
                                              : 'bg-white border-slate-200 text-slate-800'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-bold flex items-center gap-1.5">
                                              {isCustomer ? (
                                                <UserIcon className="size-3.5 text-blue-700 shrink-0" />
                                              ) : isPilot ? (
                                                <BotIcon className="size-3.5 text-purple-700 shrink-0" />
                                              ) : (
                                                <ShieldCheckIcon className="size-3.5 text-slate-700 shrink-0" />
                                              )}
                                              <span className={isCustomer ? 'text-blue-800' : isPilot ? 'text-purple-800' : 'text-slate-800'}>
                                                {seg.speakerName || (isCustomer ? 'Customer Stakeholder' : 'SpecPilot AI')}
                                              </span>
                                              <Badge className="text-[9px] py-0 px-1.5 border border-slate-300 bg-white text-slate-700 font-semibold">
                                                {seg.speakerRole}
                                              </Badge>
                                            </span>
                                            <span className="text-slate-500 font-mono text-[10px]">
                                              {seg.timestamp ? new Date(seg.timestamp).toLocaleTimeString() : ''}
                                            </span>
                                          </div>
                                          <p className="text-xs text-slate-800 leading-relaxed font-sans">{seg.text}</p>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              ) : (
                                <>
                                  {candidates.length === 0 ? (
                                    <p className="text-xs text-slate-500 py-2 text-center font-medium">
                                      No features captured yet in this session.
                                    </p>
                                  ) : (
                                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                                      {candidates.map((req) => {
                                        const isEditing = editingItemId === req.id;
                                        const isUpdating = updatingItemId === req.id;
                                        const isApproved = req.status === 'APPROVED';
                                        const isTaggedNextMeet = req.status === 'TAGGED_FOR_NEXT_MEETING' || req.taggedForNextMeeting;

                                        return (
                                          <div
                                            key={req.id}
                                            className={`p-3 rounded-xl border text-xs transition-all space-y-2 shadow-xs ${
                                              isApproved
                                                ? 'border-emerald-200 bg-emerald-50/60'
                                                : isTaggedNextMeet
                                                ? 'border-purple-200 bg-purple-50/60'
                                                : req.status === 'REJECTED'
                                                ? 'border-rose-200 bg-rose-50/40 opacity-70'
                                                : 'border-slate-200 bg-white'
                                            }`}
                                          >
                                            <div className="flex items-start justify-between gap-2">
                                              <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="font-mono text-emerald-800 text-xs font-bold">
                                                  {req.id}
                                                </span>
                                                <Badge className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border border-slate-300 bg-slate-100 text-slate-700">
                                                  {req.type}
                                                </Badge>
                                                {isApproved && (
                                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold px-2 py-0.5 gap-1">
                                                    <CheckIcon className="size-3" />
                                                    <span>Approved</span>
                                                  </Badge>
                                                )}
                                                {isTaggedNextMeet && (
                                                  <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px] font-bold px-2 py-0.5 gap-1">
                                                    <TagIcon className="size-3" />
                                                    <span>Ask in Next Meet</span>
                                                  </Badge>
                                                )}
                                              </div>

                                              <div className="flex items-center gap-1.5">
                                                {/* Action: Approve */}
                                                {!isApproved && (
                                                  <button
                                                    onClick={() => handleReviewFeature(m.id, req, 'APPROVE')}
                                                    disabled={isUpdating}
                                                    title="Approve feature into baseline"
                                                    className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all flex items-center gap-1"
                                                  >
                                                    <CheckIcon className="size-3" />
                                                    <span>Approve</span>
                                                  </button>
                                                )}

                                                {/* Action: Ask in Next Meet */}
                                                {!isTaggedNextMeet && (
                                                  <button
                                                    onClick={() => handleReviewFeature(m.id, req, 'TAG_NEXT_MEET')}
                                                    disabled={isUpdating}
                                                    title="Tag to ask customer in next meeting"
                                                    className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-all flex items-center gap-1"
                                                  >
                                                    <TagIcon className="size-3" />
                                                    <span>Ask Next Meet</span>
                                                  </button>
                                                )}

                                                {/* Action: Edit */}
                                                <button
                                                  onClick={() => {
                                                    setEditingItemId(req.id);
                                                    setEditingText(req.requirementText);
                                                    setEditingType(req.type);
                                                    setEditingPriority(req.priority || 'high');
                                                  }}
                                                  title="Edit feature wording"
                                                  className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                                                >
                                                  <Edit3Icon className="size-3.5" />
                                                </button>
                                              </div>
                                            </div>

                                            {/* Requirement Text or Inline Edit Form */}
                                            {isEditing ? (
                                              <div className="space-y-2 pt-2 border-t border-slate-200">
                                                <textarea
                                                  rows={2}
                                                  value={editingText}
                                                  onChange={(e) => setEditingText(e.target.value)}
                                                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-sans shadow-xs"
                                                />
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <select
                                                      value={editingType}
                                                      onChange={(e) => setEditingType(e.target.value as CandidateRequirementType)}
                                                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 font-medium"
                                                    >
                                                      <option value="FUNCTIONAL">FUNCTIONAL</option>
                                                      <option value="NON_FUNCTIONAL">NON_FUNCTIONAL</option>
                                                      <option value="SECURITY">SECURITY</option>
                                                      <option value="PERFORMANCE">PERFORMANCE</option>
                                                      <option value="UI_UX">UI_UX</option>
                                                      <option value="TECHNICAL">TECHNICAL</option>
                                                    </select>

                                                    <select
                                                      value={editingPriority}
                                                      onChange={(e) => setEditingPriority(e.target.value as RequirementPriority)}
                                                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 font-medium"
                                                    >
                                                      <option value="low">Low Priority</option>
                                                      <option value="medium">Medium Priority</option>
                                                      <option value="high">High Priority</option>
                                                      <option value="critical">Critical</option>
                                                    </select>
                                                  </div>

                                                  <div className="flex items-center gap-2">
                                                    <button
                                                      onClick={() => setEditingItemId(null)}
                                                      className="px-2.5 py-1 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900"
                                                    >
                                                      Cancel
                                                    </button>
                                                    <button
                                                      onClick={() => handleReviewFeature(m.id, req, 'SAVE_EDIT')}
                                                      disabled={isUpdating}
                                                      className="px-3 py-1 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                                    >
                                                      {isUpdating ? 'Saving...' : 'Save Edit'}
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            ) : (
                                              <p className="text-slate-800 font-normal leading-relaxed text-xs sm:text-sm">
                                                {req.requirementText}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Inline Quick Add Feature */}
                                  <div className="pt-2.5 border-t border-slate-200 flex items-center gap-2">
                                    <select
                                      value={newFeatureType[m.id] || 'FUNCTIONAL'}
                                      onChange={(e) =>
                                        setNewFeatureType((prev) => ({
                                          ...prev,
                                          [m.id]: e.target.value as CandidateRequirementType,
                                        }))
                                      }
                                      className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 shadow-xs"
                                    >
                                      <option value="FUNCTIONAL">Functional</option>
                                      <option value="NON_FUNCTIONAL">Non-Functional</option>
                                      <option value="SECURITY">Security</option>
                                      <option value="PERFORMANCE">Performance</option>
                                      <option value="UI_UX">UI / UX</option>
                                      <option value="TECHNICAL">Technical</option>
                                    </select>
                                    <input
                                      type="text"
                                      placeholder="+ Add requirement manually (e.g., Two-factor authentication via TOTP)..."
                                      value={newFeatureText[m.id] || ''}
                                      onChange={(e) =>
                                        setNewFeatureText((prev) => ({ ...prev, [m.id]: e.target.value }))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddFeatureManually(m.id);
                                      }}
                                      className="flex-1 h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => handleAddFeatureManually(m.id)}
                                      disabled={addingFeatureMeetingId === m.id || !newFeatureText[m.id]?.trim()}
                                      className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 shadow-xs transition-all gap-1.5"
                                    >
                                      {addingFeatureMeetingId === m.id ? (
                                        <>
                                          <Loader2Icon className="size-3.5 animate-spin" />
                                          <span>Adding...</span>
                                        </>
                                      ) : (
                                        <span>Add</span>
                                      )}
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* Action Toolbar */}
                          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDocumentsModal(m.id, 'summary')}
                                className="h-8 gap-1.5 border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs px-3 font-semibold shadow-xs"
                              >
                                <FileTextIcon className="size-3.5 text-emerald-600" />
                                <span>Documents &amp; PDF</span>
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDocumentsModal(m.id, 'transcript')}
                                className="h-8 gap-1.5 border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs px-3 font-semibold shadow-xs"
                              >
                                <MessageSquareTextIcon className="size-3.5 text-purple-600" />
                                <span>Transcript</span>
                              </Button>

                              <a
                                href={`/api/meetings/${m.id}/documents/pdf?projectId=${activeProjectId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors shadow-xs"
                              >
                                <PrinterIcon className="size-3.5 text-slate-600" />
                                <span>PDF</span>
                              </a>
                            </div>

                            <Link href={`/meetings/${m.id}`}>
                              <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 font-bold shadow-xs">
                                <span>Join Room</span>
                                <ArrowRightIcon className="size-3.5" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: EMBEDDED CALENDAR BOX & QUALITY ISSUES (5 COLS) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* EMBEDDED CALENDAR SCHEDULE BOX */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="size-4 text-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Meeting Cadence &amp; Calendar Box
                    </h3>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openScheduleFollowUpModal}
                    className="h-7 text-xs border-slate-300 bg-white text-emerald-700 hover:bg-slate-50 font-bold gap-1 px-2.5 shadow-xs"
                  >
                    <PlusIcon className="size-3.5" />
                    <span>Follow-Up</span>
                  </Button>
                </div>

                {/* Tagged for Next Meet banner */}
                {totalTaggedForNextMeet > 0 && (
                  <div className="p-3 rounded-lg border border-purple-200 bg-purple-50 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-purple-900 font-bold">
                      <TagIcon className="size-3.5 text-purple-700" />
                      <span>{totalTaggedForNextMeet} Features Tagged for Next Meet</span>
                    </div>
                    <button
                      onClick={openScheduleFollowUpModal}
                      className="text-xs underline text-purple-700 hover:text-purple-900 font-extrabold"
                    >
                      Schedule Now
                    </button>
                  </div>
                )}

                {/* Interactive Multi-Colored Month Calendar Grid */}
                <InteractiveCalendarBox
                  events={projectData?.calendarEvents || []}
                  onScheduleClick={openScheduleFollowUpModal}
                />

                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Upcoming &amp; Past Sessions
                  </div>

                  {projectData?.calendarEvents && projectData.calendarEvents.length > 0 ? (
                    projectData.calendarEvents.slice(0, 4).map((ev) => {
                      const isPast = new Date(`${ev.date}T${ev.startTime}`).getTime() < Date.now();
                      const isFollowUp = ev.linkedMeetingId || ev.title.toLowerCase().includes('follow-up');
                      return (
                        <div
                          key={ev.id}
                          className={`p-3 rounded-xl border flex items-start justify-between gap-2 transition-all shadow-xs ${
                            isFollowUp
                              ? 'border-purple-200 bg-purple-50/50'
                              : 'border-slate-200 bg-slate-50/60'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {isPast ? (
                                <Badge className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0 border-0 font-bold">
                                  Completed
                                </Badge>
                              ) : isFollowUp ? (
                                <Badge className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0 border border-purple-300 font-bold">
                                  Follow-Up
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0 border border-emerald-300 font-bold">
                                  Scheduled
                                </Badge>
                              )}
                              <span className="font-bold text-xs text-slate-900 truncate max-w-[150px]">
                                {ev.title}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="size-3 text-slate-400" />
                                {ev.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <ClockIcon className="size-3 text-slate-400" />
                                {ev.startTime}
                              </span>
                              <span className="uppercase text-[10px] text-slate-600 font-mono font-bold">
                                {ev.meetingMode}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <a
                              href={`/api/calendar/${ev.id}/ics`}
                              download
                              title="Download .ics"
                              className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:text-slate-900 shadow-xs"
                            >
                              <DownloadIcon className="size-3.5" />
                            </a>
                            <Link href={`/meetings/${ev.meetingId}`}>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
                                Join
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-5 text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      No follow-up meetings scheduled yet. Click &quot;Follow-Up&quot; or dates in the calendar to schedule one.
                    </div>
                  )}

                  <div className="pt-2 flex justify-between items-center text-xs">
                    <Link href="/calendar" className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 text-[11px]">
                      <span>Open Full Calendar</span>
                      <ExternalLinkIcon className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* POST-ANALYSIS ISSUES & FOLLOW-UP QUESTIONS BOX */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangleIcon className="size-4 text-amber-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Document Analysis &amp; Quality Issues
                    </h3>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
                    {projectData?.qualityIssues.length || 0} Open
                  </Badge>
                </div>

                {projectData?.qualityIssues && projectData.qualityIssues.length > 0 ? (
                  <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                    {projectData.qualityIssues.slice(0, 5).map((issue, i) => (
                      <div key={i} className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 space-y-1 shadow-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-amber-900 font-mono">
                            [{issue.issueType}]
                          </span>
                          <span className="text-[10px] uppercase font-bold text-amber-700">
                            {issue.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 font-medium leading-snug">{issue.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-500 font-medium">
                    All requirements verified with zero open quality defects.
                  </div>
                )}

                {/* Follow-up Clarification Questions for Next Meeting */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                    <HelpCircleIcon className="size-3.5" />
                    <span>Follow-Up Questions for Next Meeting</span>
                  </div>

                  {projectData?.followUpQuestions && projectData.followUpQuestions.length > 0 ? (
                    <div className="space-y-2">
                      {projectData.followUpQuestions.slice(0, 3).map((q, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-medium">
                          &bull; &quot;{q.question}&quot;
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 font-medium">
                      No unresolved questions. Stakeholder answers are complete.
                    </p>
                  )}
                </div>
              </div>

              {/* MASTER LIVING SRS CARD */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2Icon className="size-4 text-emerald-700" />
                    <span className="text-xs font-bold text-slate-900">
                      Master Living Specification (SRS)
                    </span>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold font-mono">
                    {projectData?.currentVersion || 'v1.0'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  Consolidated specification containing all approved requirements, architecture decisions, and version history recovered across all meetings.
                </p>
                <div className="pt-1 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => setIsMasterDocOpen(true)}
                    className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                  >
                    Open Master SRS
                  </Button>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* 1. PER-MEETING DOCUMENTS & PDF MODAL */}
        {selectedMeetingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Modal Header */}
              {(() => {
                const curMeeting = meetings.find((m) => m.id === selectedMeetingId);
                const isBaselineApproved = Boolean(curMeeting?.baselineApproved);
                const baselineLabel = curMeeting?.baselineVersion || docVersions[0]?.versionLabel || 'v1.0';

                return (
                  <div className="flex items-center justify-between border-b border-slate-200 p-5 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-800">
                        <FileTextIcon className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">
                            {docBundle?.meetingTitle || curMeeting?.title || 'Requirement Meeting Documentation'}
                          </h3>
                          {isBaselineApproved ? (
                            <Badge className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-mono font-bold">
                              ✓ Approved Baseline: {baselineLabel}
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-mono font-bold">
                              Status: DRAFT (Pending Review)
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs font-mono text-slate-500 font-medium">
                          ID: {selectedMeetingId} &bull; {isBaselineApproved ? `Approved by ${curMeeting?.baselineApprovedBy || 'Lead Engineer'}` : 'Not signed off yet'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isBaselineApproved ? (
                        <Button
                          size="sm"
                          onClick={() => handleApproveBaseline(selectedMeetingId)}
                          disabled={approving}
                          className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 font-bold shadow-xs"
                        >
                          <CheckIcon className="size-3.5" />
                          <span>Approve Baseline</span>
                        </Button>
                      ) : (
                        <div className="px-3 py-1 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-1">
                          <CheckIcon className="size-3.5" />
                          <span>Baseline Signed Off</span>
                        </div>
                      )}

                      <button
                        onClick={() => handleReanalyzeTranscript(selectedMeetingId!)}
                        disabled={reanalyzing}
                        title="Force re-extract all requirements from the meeting transcript"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {reanalyzing ? (
                          <Loader2Icon className="size-3.5 animate-spin" />
                        ) : (
                          <SparklesIcon className="size-3.5" />
                        )}
                        <span>{reanalyzing ? 'Re-Analyzing...' : 'Re-Analyze'}</span>
                      </button>

                      <a
                        href={`/api/meetings/${selectedMeetingId}/documents/pdf?projectId=${activeProjectId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors"
                      >
                        <PrinterIcon className="size-3.5 text-slate-300" />
                        <span>Print / Save PDF</span>
                      </a>

                      <button
                        onClick={() => setSelectedMeetingId(null)}
                        className="text-slate-400 hover:text-slate-800 text-xl font-bold px-2"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Document Tabs */}
              <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-2.5 overflow-x-auto text-xs">
                {(
                  [
                    { id: 'summary', label: 'Summary' },
                    { id: 'transcript', label: `Full Transcript (${meetingTranscript.length})` },
                    { id: 'srs', label: 'Software Requirements (SRS)' },
                    { id: 'requirements', label: 'Requirements' },
                    { id: 'decisions', label: 'Decisions & Changes' },
                    { id: 'traceability', label: 'Traceability Matrix' },
                    { id: 'versions', label: 'Version History' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedDocTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedDocTab === tab.id
                        ? 'bg-white text-emerald-800 border border-slate-200 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 text-slate-800 bg-white font-sans text-xs sm:text-sm leading-relaxed">
                {docLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                    <Loader2Icon className="size-6 animate-spin text-emerald-600" />
                    <span className="font-medium text-xs">Generating &amp; loading documentation bundle &amp; transcript...</span>
                  </div>
                ) : selectedDocTab === 'transcript' ? (
                  <TranscriptView segments={meetingTranscript} meetingId={selectedMeetingId} />
                ) : !docBundle ? (
                  <div className="text-center py-16 text-slate-500 font-medium text-xs">
                    No documentation generated yet.
                  </div>
                ) : selectedDocTab === 'versions' ? (
                  <div className="space-y-4 font-sans">
                    <div className="text-slate-600 text-xs font-semibold">
                      Requirement baseline versions generated across meeting iterations:
                    </div>
                    {docVersions.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No signed-off baseline versions yet. Click &quot;Approve Baseline&quot; above to stamp an official baseline version.
                      </div>
                    ) : (
                      docVersions.map((v, i) => (
                        <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 shadow-xs">
                          <div className="flex items-center justify-between">
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-mono text-xs font-bold">
                              {v.versionLabel}
                            </Badge>
                            <span className="text-xs text-slate-500 font-mono">
                              {new Date(v.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-slate-900 font-bold">{v.changeSummary}</div>
                          <div className="text-slate-600 text-xs font-medium">
                            Approved by: <strong>{v.approvedBy}</strong> &bull; Requirements count: <strong>{v.requirements?.length || 0}</strong>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : selectedDocTab === 'requirements' ? (
                  <div className="space-y-4 font-sans">
                    {/* Toolbar: Bulk Actions & Download */}
                    {(() => {
                      const reqList = meetingIntelMap[selectedMeetingId]?.candidateRequirements || [];
                      const approvedCount = reqList.filter((r) => r.status === 'APPROVED').length;
                      const proposedCount = reqList.filter((r) => r.status === 'PROPOSED').length;
                      const taggedCount = reqList.filter((r) => r.status === 'TAGGED_FOR_NEXT_MEETING' || r.taggedForNextMeeting).length;

                      return (
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-slate-800">
                              Total Requirements: <strong>{reqList.length}</strong>
                            </span>
                            <span className="text-slate-300">&bull;</span>
                            <span className="text-emerald-700 font-bold">
                              Approved: <strong>{approvedCount}</strong>
                            </span>
                            <span className="text-slate-300">&bull;</span>
                            <span className="text-amber-700 font-bold">
                              Proposed / Pending: <strong>{proposedCount}</strong>
                            </span>
                            {taggedCount > 0 && (
                              <>
                                <span className="text-slate-300">&bull;</span>
                                <span className="text-purple-700 font-bold">
                                  Ask in Next Meet: <strong>{taggedCount}</strong>
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {proposedCount > 0 && (
                              <Button
                                size="sm"
                                onClick={() => handleBulkApproveMeetingItems(selectedMeetingId)}
                                disabled={approving}
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 gap-1.5 shadow-xs"
                              >
                                <CheckIcon className="size-3.5" />
                                <span>Approve All</span>
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadMarkdown(docBundle.requirements, `${selectedMeetingId}-requirements.md`)}
                              className="h-7 text-xs border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold gap-1.5"
                            >
                              <DownloadIcon className="size-3.5" />
                              <span>Download .md</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Interactive Requirement Cards */}
                    {selectedMeetingId && meetingIntelMap[selectedMeetingId]?.candidateRequirements && meetingIntelMap[selectedMeetingId].candidateRequirements.length > 0 ? (
                      <div className="space-y-3 font-sans">
                        {meetingIntelMap[selectedMeetingId].candidateRequirements.map((req) => {
                          const isApproved = req.status === 'APPROVED';
                          const isTaggedNextMeet = req.status === 'TAGGED_FOR_NEXT_MEETING' || req.taggedForNextMeeting;
                          const isEditing = editingItemId === req.id;
                          const isUpdating = updatingItemId === req.id;

                          return (
                            <div
                              key={req.id}
                              className={`p-4 rounded-xl border transition-all space-y-2.5 shadow-xs ${
                                isApproved
                                  ? 'bg-emerald-50/70 border-emerald-200'
                                  : isTaggedNextMeet
                                  ? 'bg-purple-50/70 border-purple-200'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-xs text-emerald-800">{req.id}</span>
                                  <Badge className="text-[10px] font-bold uppercase font-mono border border-slate-300 bg-slate-100 text-slate-700">
                                    {req.type}
                                  </Badge>
                                  {isApproved && (
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold flex items-center gap-1">
                                      <CheckIcon className="size-3" />
                                      <span>Approved</span>
                                    </Badge>
                                  )}
                                  {isTaggedNextMeet && (
                                    <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px] font-bold flex items-center gap-1">
                                      <TagIcon className="size-3" />
                                      <span>Ask in Next Meet</span>
                                    </Badge>
                                  )}
                                  {!isApproved && !isTaggedNextMeet && (
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
                                      Proposed (Pending Review)
                                    </Badge>
                                  )}
                                </div>

                                {/* Per-Item Actions */}
                                <div className="flex items-center gap-2">
                                  {!isApproved && (
                                    <button
                                      onClick={async () => {
                                        await handleReviewFeature(selectedMeetingId, req, 'APPROVE');
                                        const docRes = await fetch(`/api/meetings/${selectedMeetingId}/documents?projectId=${activeProjectId}`);
                                        if (docRes.ok) {
                                          const docData = await docRes.json();
                                          setDocBundle(docData.bundle);
                                        }
                                      }}
                                      disabled={isUpdating}
                                      className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1 shadow-xs"
                                    >
                                      <CheckIcon className="size-3" />
                                      <span>Approve</span>
                                    </button>
                                  )}

                                  {!isTaggedNextMeet && (
                                    <button
                                      onClick={async () => {
                                        await handleReviewFeature(selectedMeetingId, req, 'TAG_NEXT_MEET');
                                        const docRes = await fetch(`/api/meetings/${selectedMeetingId}/documents?projectId=${activeProjectId}`);
                                        if (docRes.ok) {
                                          const docData = await docRes.json();
                                          setDocBundle(docData.bundle);
                                        }
                                      }}
                                      disabled={isUpdating}
                                      className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors flex items-center gap-1"
                                    >
                                      <TagIcon className="size-3" />
                                      <span>Ask Next Meet</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => {
                                      setEditingItemId(req.id);
                                      setEditingText(req.requirementText);
                                      setEditingType(req.type);
                                      setEditingPriority(req.priority || 'high');
                                    }}
                                    className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                    title="Edit wording"
                                  >
                                    <Edit3Icon className="size-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Requirement Text or Edit Form */}
                              {isEditing ? (
                                <div className="space-y-2 pt-2 border-t border-slate-200">
                                  <textarea
                                    rows={2}
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-sans shadow-xs"
                                  />
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={editingType}
                                        onChange={(e) => setEditingType(e.target.value as CandidateRequirementType)}
                                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 font-medium"
                                      >
                                        <option value="FUNCTIONAL">FUNCTIONAL</option>
                                        <option value="NON_FUNCTIONAL">NON_FUNCTIONAL</option>
                                        <option value="SECURITY">SECURITY</option>
                                        <option value="PERFORMANCE">PERFORMANCE</option>
                                        <option value="UI_UX">UI_UX</option>
                                        <option value="TECHNICAL">TECHNICAL</option>
                                      </select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setEditingItemId(null)}
                                        className="px-2.5 py-1 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={async () => {
                                          await handleReviewFeature(selectedMeetingId, req, 'SAVE_EDIT');
                                          const docRes = await fetch(`/api/meetings/${selectedMeetingId}/documents?projectId=${activeProjectId}`);
                                          if (docRes.ok) {
                                            const docData = await docRes.json();
                                            setDocBundle(docData.bundle);
                                          }
                                        }}
                                        disabled={isUpdating}
                                        className="px-3 py-1 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                      >
                                        {isUpdating ? 'Saving...' : 'Save Edit'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-slate-800 font-normal text-xs sm:text-sm leading-relaxed font-sans">
                                  {req.requirementText}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <MarkdownView content={docBundle.requirements} />
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-end mb-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const content =
                            selectedDocTab === 'summary'
                              ? docBundle.summary
                              : selectedDocTab === 'srs'
                              ? docBundle.srs
                              : selectedDocTab === 'decisions'
                              ? `${docBundle.decisions}\n\n${docBundle.changes}`
                              : docBundle.traceability;
                          downloadMarkdown(content, `${selectedMeetingId}-${selectedDocTab}.md`);
                        }}
                        className="h-8 text-xs border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold gap-1.5 shadow-xs"
                      >
                        <DownloadIcon className="size-3.5" />
                        <span>Download .md</span>
                      </Button>
                    </div>

                    <MarkdownView
                      content={
                        selectedDocTab === 'summary'
                          ? docBundle.summary
                          : selectedDocTab === 'srs'
                          ? docBundle.srs
                          : selectedDocTab === 'decisions'
                          ? `${docBundle.decisions}\n\n---\n\n${docBundle.changes}`
                          : docBundle.traceability
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. MASTER LIVING SPECIFICATION MODAL */}
        {isMasterDocOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 p-5 bg-white">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800">
                    <FileCheck2Icon className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">
                        Master Living Software Requirements Specification
                      </h3>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold font-mono">
                        LIVING BASELINE
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      Project-wide consolidated baseline &bull; Client: <strong>{activeProject?.clientName || 'Acme'}</strong> &bull; Baseline: <strong>{projectData?.currentVersion || 'v1.0-Approved'}</strong>
                    </p>
                    {/* Evolution Stats Bar */}
                    {(() => {
                      const evList = projectData?.evolutionMatrix || [];
                      const newCount = evList.filter((e) => e.evolutionType === 'NEW').length;
                      const updatedCount = evList.filter((e) => e.evolutionType === 'UPDATED').length;
                      const removedCount = evList.filter((e) => e.evolutionType === 'REMOVED').length;
                      const stableCount = evList.filter((e) => e.evolutionType === 'STABLE').length;

                      return (
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-mono">
                          <span className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-300 font-bold">
                            <strong>+{newCount}</strong> New
                          </span>
                          <span className="flex items-center gap-1 text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-300 font-bold">
                            <strong>↻ {updatedCount}</strong> Updated
                          </span>
                          {removedCount > 0 && (
                            <span className="flex items-center gap-1 text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-300 font-bold">
                              <strong>- {removedCount}</strong> Removed
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-300 font-bold">
                            <strong>✓ {stableCount}</strong> Stable
                          </span>
                          <span className="text-slate-500 font-sans font-medium">
                            &bull; Continuous Memory across {projectData?.meetingsChronology?.length || projectData?.timelineMeetings?.length || 1} Sessions
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/api/projects/${activeProjectId}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors"
                  >
                    <PrinterIcon className="size-3.5 text-slate-300" />
                    <span>Print / Save PDF</span>
                  </a>

                  <Button
                    size="sm"
                    onClick={() => handleApproveBaseline()}
                    disabled={approving}
                    className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 font-bold shadow-xs"
                  >
                    <CheckIcon className="size-3.5" />
                    <span>Approve Baseline</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadMarkdown(projectData?.masterSrs || '', `${activeProjectId}-Master-SRS.md`)}
                    className="h-8 text-xs border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold shadow-xs"
                  >
                    <DownloadIcon className="size-3.5 mr-1" />
                    <span>Download .md</span>
                  </Button>

                  <button
                    onClick={() => setIsMasterDocOpen(false)}
                    className="text-slate-400 hover:text-slate-800 text-xl font-bold px-2"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Master Doc Tabs */}
              <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs overflow-x-auto">
                {(
                  [
                    { id: 'srs', label: 'Consolidated SRS (Markdown)' },
                    { id: 'evolution', label: `Requirement Evolution & Diffs (${projectData?.evolutionMatrix?.length || 0})` },
                    { id: 'requirements', label: `Approved Requirements (${projectData?.approvedRequirements.length || 0})` },
                    { id: 'issues', label: `Open Quality Defects (${projectData?.qualityIssues.length || 0})` },
                    { id: 'versions', label: `Version Lineage (${projectData?.versions.length || 0})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMasterDocTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      masterDocTab === tab.id
                        ? 'bg-white text-emerald-800 border border-slate-200 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Master Doc Content */}
              <div className="flex-1 overflow-y-auto p-6 font-sans text-xs sm:text-sm leading-relaxed text-slate-800 bg-white">
                {masterDocTab === 'srs' && (
                  <MarkdownView content={projectData?.masterSrs || ''} />
                )}

                {masterDocTab === 'evolution' && (
                  <div className="space-y-4 font-sans">
                    {/* Filter bar */}
                    {(() => {
                      const evList = projectData?.evolutionMatrix || [];
                      const newCount = evList.filter((e) => e.evolutionType === 'NEW').length;
                      const updatedCount = evList.filter((e) => e.evolutionType === 'UPDATED').length;
                      const removedCount = evList.filter((e) => e.evolutionType === 'REMOVED').length;
                      const stableCount = evList.filter((e) => e.evolutionType === 'STABLE').length;

                      const filtered = evList.filter((item) => {
                        if (evolutionFilter === 'ALL') return true;
                        return item.evolutionType === evolutionFilter;
                      });

                      return (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-1.5 text-xs">
                              {(
                                [
                                  { id: 'ALL', label: `All Points (${evList.length})`, color: 'text-slate-700' },
                                  { id: 'UPDATED', label: `↻ Updated Diffs (${updatedCount})`, color: 'text-amber-800' },
                                  { id: 'NEW', label: `+ New Points (${newCount})`, color: 'text-emerald-800' },
                                  { id: 'REMOVED', label: `- Removed (${removedCount})`, color: 'text-rose-800' },
                                  { id: 'STABLE', label: `✓ Stable (${stableCount})`, color: 'text-blue-800' },
                                ] as const
                              ).map((f) => (
                                <button
                                  key={f.id}
                                  onClick={() => setEvolutionFilter(f.id)}
                                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                                    evolutionFilter === f.id
                                      ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                                      : `${f.color || 'text-slate-600'} hover:text-slate-900 hover:bg-slate-200/50`
                                  }`}
                                >
                                  {f.label}
                                </button>
                              ))}
                            </div>

                            <span className="text-xs text-slate-500 font-mono font-medium">
                              Single Source of Truth Living Document
                            </span>
                          </div>

                          {/* Evolution Cards List */}
                          {filtered.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200 font-medium">
                              No requirements found matching current evolution filter.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {filtered.map((item) => {
                                const isUpdated = item.evolutionType === 'UPDATED';
                                const isNew = item.evolutionType === 'NEW';
                                const isRemoved = item.evolutionType === 'REMOVED';

                                return (
                                  <div
                                    key={item.id}
                                    className={`p-4 rounded-xl border transition-all space-y-2 shadow-xs ${
                                      isUpdated
                                        ? 'bg-amber-50/60 border-amber-300'
                                        : isNew
                                        ? 'bg-emerald-50/60 border-emerald-300'
                                        : isRemoved
                                        ? 'bg-rose-50/60 border-rose-300'
                                        : 'bg-white border-slate-200'
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                          {item.id}
                                        </span>

                                        {isUpdated ? (
                                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-mono font-medium flex items-center gap-1">
                                            <RefreshCwIcon className="size-2.5" />
                                            <span>Updated in Session #{item.originMeetingNumber || 1}</span>
                                          </Badge>
                                        ) : isNew ? (
                                          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px] font-mono font-medium flex items-center gap-1">
                                            <PlusIcon className="size-2.5" />
                                            <span>Added in Session #{item.originMeetingNumber || 1}</span>
                                          </Badge>
                                        ) : isRemoved ? (
                                          <Badge className="bg-rose-100 text-rose-900 border-rose-300 text-[10px] font-mono font-medium flex items-center gap-1">
                                            <MinusCircleIcon className="size-2.5" />
                                            <span>Removed / Out of Scope</span>
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-blue-100 text-blue-900 border-blue-300 text-[10px] font-mono font-medium flex items-center gap-1">
                                            <CheckIcon className="size-2.5" />
                                            <span>Baseline Stable</span>
                                          </Badge>
                                        )}

                                        <Badge className="text-[10px] uppercase font-mono border border-slate-300 bg-white text-slate-700 font-semibold">
                                          {item.category}
                                        </Badge>
                                      </div>

                                      <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
                                        <span>Priority: <strong className="text-slate-900">{item.priority.toUpperCase()}</strong></span>
                                        <span>&bull;</span>
                                        <span>Status: <strong className="text-slate-900">{item.status}</strong></span>
                                      </div>
                                    </div>

                                    {/* Evolution Body / Visual Diff */}
                                    {isUpdated ? (
                                      <div className="space-y-2.5 mt-2">
                                        {item.previousText && (
                                          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                                            <div className="text-[10px] uppercase font-bold text-rose-800 mb-1 flex items-center gap-1.5">
                                              <MinusCircleIcon className="size-3" />
                                              <span>Previous Baseline Specification (Superseded)</span>
                                            </div>
                                            <p className="line-through text-rose-900 text-xs sm:text-sm font-sans">
                                              &ldquo;{item.previousText}&rdquo;
                                            </p>
                                          </div>
                                        )}

                                        <div className="p-3 rounded-lg bg-amber-100/70 border border-amber-300">
                                          <div className="text-[10px] uppercase font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                                            <RefreshCwIcon className="size-3" />
                                            <span>Updated Active Specification</span>
                                          </div>
                                          <p className="text-amber-950 text-xs sm:text-sm font-bold">
                                            &ldquo;{item.currentText}&rdquo;
                                          </p>
                                        </div>

                                        {item.changeRationale && (
                                          <div className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 flex items-start gap-2 shadow-xs">
                                            <span className="text-slate-800 font-bold flex items-center gap-1 shrink-0">
                                              <InfoIcon className="size-3.5 text-slate-500" />
                                              <span>Rationale:</span>
                                            </span>
                                            <span>{item.changeRationale}</span>
                                          </div>
                                        )}
                                      </div>
                                    ) : isRemoved ? (
                                      <div className="space-y-2 mt-2">
                                        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                                          <p className="line-through text-rose-900 text-xs sm:text-sm font-sans">
                                            &ldquo;{item.currentText}&rdquo;
                                          </p>
                                          <p className="text-xs text-rose-800 mt-1 font-semibold">
                                            <strong>Out of Scope:</strong> {item.changeRationale || 'Marked obsolete during requirement elicitation.'}
                                          </p>
                                        </div>
                                      </div>
                                    ) : isNew ? (
                                      <div className="space-y-2 mt-2">
                                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                                          <p className="text-emerald-950 text-xs sm:text-sm font-bold">
                                            &ldquo;{item.currentText}&rdquo;
                                          </p>
                                          <p className="text-xs text-emerald-800 mt-1 font-mono font-medium">
                                            Elicited and agreed in Meeting #{item.originMeetingNumber || 1}
                                          </p>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mt-2">
                                        <p className="text-slate-800 text-xs sm:text-sm leading-relaxed">
                                          &ldquo;{item.currentText}&rdquo;
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {masterDocTab === 'requirements' && (
                  <div className="space-y-3 font-sans">
                    {projectData?.approvedRequirements.map((req) => (
                      <div key={req.id} className="p-4 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-emerald-800 font-bold">{req.id}</span>
                          <Badge className="text-[10px] uppercase font-mono border border-slate-300 bg-slate-100 text-slate-700">
                            {req.category}
                          </Badge>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{req.description}</p>
                        <div className="text-xs text-slate-500 font-mono font-medium">
                          Priority: <strong>{req.priority}</strong> &bull; Version: <strong>v{req.currentVersion}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {masterDocTab === 'issues' && (
                  <div className="space-y-3 font-sans">
                    {projectData?.qualityIssues.map((issue, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-amber-900 font-bold">[{issue.issueType}]</span>
                          <span className="text-[10px] uppercase text-amber-800 font-bold">Severity: {issue.severity}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900">{issue.description}</p>
                        <p className="text-xs text-slate-600">{issue.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}

                {masterDocTab === 'versions' && (
                  <div className="space-y-3 font-sans">
                    {projectData?.versions.map((ver, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-white border border-slate-200 space-y-2 shadow-xs">
                        <div className="flex items-center justify-between">
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-mono font-bold">
                            {ver.versionLabel}
                          </Badge>
                          <span className="text-xs font-mono text-slate-500">
                            {new Date(ver.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900">{ver.changeSummary}</p>
                        <p className="text-xs text-slate-600 font-medium">
                          Approved by: <strong>{ver.approvedBy}</strong> &bull; Requirements contained: <strong>{ver.requirements?.length || 0}</strong>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. QUICK SCHEDULE FOLLOW-UP MODAL */}
        {isScheduleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="size-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-slate-900">Schedule Follow-Up Meeting</h3>
                </div>
                <button
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="text-slate-400 hover:text-slate-800 text-xl font-bold"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateFollowUp} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-bold">Session Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Architecture &amp; Security Follow-Up"
                    value={scheduleTitle}
                    onChange={(e) => setScheduleTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-bold">Date</label>
                    <input
                      type="date"
                      required
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-bold">Start Time</label>
                    <input
                      type="time"
                      required
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-bold">Meeting Mode</label>
                  <select
                    value={scheduleMode}
                    onChange={(e) => setScheduleMode(e.target.value as 'assisted' | 'autonomous')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs font-medium"
                  >
                    <option value="assisted">Engineer-Assisted (Human RE in control)</option>
                    <option value="autonomous">Autonomous Follow-Up (SpecPilot leads session)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-700 font-bold">Target Agenda Topics</label>
                    {totalTaggedForNextMeet > 0 && (
                      <span className="text-[11px] text-purple-700 font-bold">
                        Pre-filled from tagged features
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Review authentication constraints&#10;Confirm cloud deployment budget"
                    value={scheduleAgenda}
                    onChange={(e) => setScheduleAgenda(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 font-sans shadow-xs"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsScheduleModalOpen(false)}
                    className="h-8 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={scheduling}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-xs"
                  >
                    {scheduling ? <Loader2Icon className="size-3.5 animate-spin" /> : <CalendarIcon className="size-3.5" />}
                    <span>Confirm &amp; Schedule</span>
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
