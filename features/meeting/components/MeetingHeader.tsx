'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Meeting, ParticipantRole, SpecPilotStatus } from '@/types/meeting';
import {
  CopyIcon,
  CheckIcon,
  UsersIcon,
  RadioIcon,
  SparklesIcon,
  BotIcon,
  RefreshCwIcon,
  Share2Icon,
} from 'lucide-react';

interface MeetingHeaderProps {
  meeting: Meeting | null;
  meetingId: string;
  participantCount: number;
  userRole?: ParticipantRole;
  specPilotStatus?: SpecPilotStatus;
  onRetrySpecPilot?: () => void;
  isWorkspaceOpen?: boolean;
  onToggleWorkspace?: () => void;
  isTranscriptOpen?: boolean;
  onToggleTranscript?: () => void;
  isIntelligenceOpen?: boolean;
  onToggleIntelligence?: () => void;
  intelligenceCount?: number;
  voiceInterventionEnabled?: boolean;
}

export function MeetingHeader({
  meeting,
  meetingId: _meetingId,
  participantCount,
  userRole = 'engineer',
  specPilotStatus = 'disconnected',
  onRetrySpecPilot,
  isWorkspaceOpen = true,
  onToggleWorkspace,
  intelligenceCount = 0,
  voiceInterventionEnabled = false,
}: MeetingHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isCustomer = userRole?.toLowerCase().includes('customer');

  // Meeting duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Safe meeting title fallback — strictly prevent "undefined" or null
  const displayTitle =
    meeting?.title && !meeting.title.includes('undefined')
      ? meeting.title
      : 'Requirement Elicitation Meeting';

  const mode = meeting?.mode || 'assisted';

  // -------------------------------------------------------------
  // CUSTOMER VIEW HEADER
  // -------------------------------------------------------------
  if (isCustomer) {
    return (
      <header className="flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-md shadow-xs">
        {/* Left: Meeting Title & Clean Customer Session Pill */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <RadioIcon className="size-4 text-emerald-600 animate-pulse" />
            <h1 className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-md">
              {displayTitle}
            </h1>
          </div>
          <Badge
            className="text-[10px] font-bold border border-slate-300 text-slate-700 bg-slate-100"
          >
            Customer Session
          </Badge>
        </div>

        {/* Center: Simple non-technical SpecPilot indicator */}
        <div className="hidden md:flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs text-purple-900 font-medium">
          <span className="size-2 rounded-full bg-purple-600 animate-pulse" />
          <span className="text-[11px] font-bold">SpecPilot is participating</span>
        </div>

        {/* Right: Share Link, Timer & Participants Count */}
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs px-3 font-bold transition-all shadow-xs"
            onClick={copyLink}
            title="Copy Meeting Invite Link"
          >
            {copied ? (
              <>
                <CheckIcon className="size-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2Icon className="size-3.5 text-slate-500" />
                <span>Share Link</span>
              </>
            )}
          </Button>

          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-mono font-bold text-slate-700">
            <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            <UsersIcon className="size-3.5 text-slate-500" />
            <span>{participantCount}</span>
          </div>
        </div>
      </header>
    );
  }

  // -------------------------------------------------------------
  // REQUIREMENT ENGINEER VIEW HEADER
  // -------------------------------------------------------------
  return (
    <header className="flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-md shadow-xs">
      {/* Left: Title & Mode */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2">
          <RadioIcon className="size-4 text-emerald-600 animate-pulse" />
          <h1 className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
            {displayTitle}
          </h1>
        </div>

        <Badge
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border ${
            mode === 'autonomous'
              ? 'border-purple-300 bg-purple-50 text-purple-800'
              : 'border-blue-300 bg-blue-50 text-blue-800'
          }`}
        >
          {mode === 'autonomous' ? 'Autonomous Mode' : 'Engineer-Assisted'}
        </Badge>
      </div>

      {/* Center: SpecPilot Co-Pilot Status & Voice Indicator */}
      <div className="hidden md:flex items-center gap-2">
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
            specPilotStatus === 'speaking'
              ? 'border-purple-300 bg-purple-50 text-purple-900'
              : specPilotStatus === 'error'
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-emerald-300 bg-emerald-50 text-emerald-900'
          }`}
        >
          <BotIcon className="size-3.5 text-slate-600" />
          <span className="font-bold text-slate-900">SpecPilot</span>
          <div className="flex items-center gap-1.5 border-l border-slate-300 pl-1.5">
            <span
              className={`size-2 rounded-full ${
                specPilotStatus === 'speaking'
                  ? 'bg-purple-600 animate-ping'
                  : specPilotStatus === 'error'
                  ? 'bg-amber-500'
                  : 'bg-emerald-600 animate-pulse'
              }`}
            />
            <span className="text-[11px] font-bold">
              {specPilotStatus === 'speaking'
                ? 'Speaking'
                : specPilotStatus === 'error'
                ? 'Unavailable'
                : 'Active'}
            </span>
          </div>

          {onRetrySpecPilot && (
            <button
              onClick={onRetrySpecPilot}
              type="button"
              className="ml-1 text-slate-500 hover:text-purple-700 transition-colors p-0.5 rounded hover:bg-slate-200"
              title="Rebuild & Reconnect SpecPilot Voice Agent"
            >
              <RefreshCwIcon className={`size-3 ${specPilotStatus === 'connecting' ? 'animate-spin text-amber-600' : ''}`} />
            </button>
          )}
        </div>

        <Badge
          className={`text-[10px] px-2 py-0.5 border font-bold ${
            voiceInterventionEnabled
              ? 'border-purple-300 bg-purple-50 text-purple-800'
              : 'border-slate-300 bg-slate-100 text-slate-600 font-semibold'
          }`}
        >
          {voiceInterventionEnabled ? '● Voice Active' : '○ Voice Muted'}
        </Badge>
      </div>

      {/* Right: Timer, Participants, Workspace Toggle, Invite Link */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-mono font-bold text-slate-700">
          <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
          <span>{formatTime(elapsedSeconds)}</span>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
          <UsersIcon className="size-3.5 text-slate-500" />
          <span>{participantCount}</span>
        </div>

        {onToggleWorkspace && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 rounded-full border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 shadow-xs"
            onClick={onToggleWorkspace}
            title={isWorkspaceOpen ? 'Collapse Co-Pilot Workspace' : 'Open Co-Pilot Workspace'}
          >
            <SparklesIcon className="size-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Co-Pilot Workspace</span>
            {intelligenceCount > 0 && (
              <span className="rounded-full bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0 font-mono font-bold">
                {intelligenceCount}
              </span>
            )}
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-full border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 shadow-xs"
          onClick={copyLink}
          title="Copy Meeting Invite Link"
        >
          {copied ? (
            <>
              <CheckIcon className="size-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-bold">Copied</span>
            </>
          ) : (
            <>
              <CopyIcon className="size-3.5 text-slate-500" />
              <span className="hidden sm:inline">Invite Link</span>
            </>
          )}
        </Button>
      </div>
    </header>
  );
}
