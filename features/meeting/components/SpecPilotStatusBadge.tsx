'use client';

import React from 'react';
import type { SpecPilotStatus } from '@/types/meeting';
import { BotIcon, RefreshCwIcon } from 'lucide-react';

interface SpecPilotStatusBadgeProps {
  status: SpecPilotStatus;
  onRetry?: () => void;
}

export function SpecPilotStatusBadge({ status, onRetry }: SpecPilotStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'listening':
        return {
          label: 'Listening',
          dotColor: 'bg-emerald-400',
          textColor: 'text-emerald-300',
          borderColor: 'border-emerald-500/30',
          bgColor: 'bg-emerald-950/40',
          pulse: true,
        };
      case 'transcribing':
        return {
          label: 'Transcribing...',
          dotColor: 'bg-indigo-400',
          textColor: 'text-indigo-300',
          borderColor: 'border-indigo-500/30',
          bgColor: 'bg-indigo-950/40',
          pulse: true,
        };
      case 'speaking':
        return {
          label: 'Speaking...',
          dotColor: 'bg-violet-400',
          textColor: 'text-violet-300',
          borderColor: 'border-violet-500/30',
          bgColor: 'bg-violet-950/40',
          pulse: true,
        };
      case 'connecting':
        return {
          label: 'Connecting...',
          dotColor: 'bg-amber-400',
          textColor: 'text-amber-300',
          borderColor: 'border-amber-500/30',
          bgColor: 'bg-amber-950/40',
          pulse: true,
        };
      case 'error':
        return {
          label: 'Unavailable',
          dotColor: 'bg-amber-500',
          textColor: 'text-amber-300',
          borderColor: 'border-amber-500/40',
          bgColor: 'bg-amber-950/30',
          pulse: false,
        };
      case 'disconnected':
      default:
        return {
          label: 'Disconnected',
          dotColor: 'bg-zinc-500',
          textColor: 'text-zinc-400',
          borderColor: 'border-zinc-800',
          bgColor: 'bg-zinc-900/60',
          pulse: false,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${config.borderColor} ${config.bgColor}`}
      title={status === 'error' ? 'SpecPilot transcription unavailable. Meeting continues normally.' : `SpecPilot AI Status: ${config.label}`}
    >
      <BotIcon className="size-3.5 text-zinc-300" />
      <span className="font-semibold text-zinc-200">SpecPilot</span>
      <div className="flex items-center gap-1.5 border-l border-zinc-700/60 pl-1.5">
        <span
          className={`size-2 rounded-full ${config.dotColor} ${config.pulse ? 'animate-pulse' : ''}`}
        />
        <span className={`text-[11px] ${config.textColor}`}>{config.label}</span>
      </div>

      {status === 'error' && onRetry && (
        <button
          onClick={onRetry}
          type="button"
          className="ml-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Retry connecting SpecPilot"
        >
          <RefreshCwIcon className="size-3" />
        </button>
      )}
    </div>
  );
}
