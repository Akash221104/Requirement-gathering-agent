'use client';

import React from 'react';
import type { SpecPilotStatus } from '@/types/meeting';
import { Badge } from '@/components/ui/badge';
import {
  SparklesIcon,
  BotIcon,
  Volume2Icon,
  MicIcon,
  MicOffIcon,
  Loader2Icon,
  RadioIcon,
  RefreshCwIcon,
} from 'lucide-react';

interface SpecPilotParticipantTileProps {
  status: SpecPilotStatus;
  voiceInterventionEnabled?: boolean;
  spokenText?: string;
  isCustomer?: boolean;
  onRetry?: () => void;
}

export function SpecPilotParticipantTile({
  status,
  voiceInterventionEnabled = true,
  spokenText = '',
  isCustomer = false,
  onRetry,
}: SpecPilotParticipantTileProps) {
  const isSpeaking = status === 'speaking';
  const isAnalyzing = status === 'transcribing';
  const isConnecting = status === 'connecting';
  const isError = status === 'error';
  const isMuted = !voiceInterventionEnabled && !isCustomer;

  // Visual status config
  const getStatusBadge = () => {
    if (isSpeaking) {
      return (
        <div className="flex items-center gap-1.5 rounded-full border border-violet-500/50 bg-violet-950/70 px-2.5 py-0.5 text-xs text-violet-200 shadow-sm animate-pulse">
          <Volume2Icon className="size-3 text-violet-400" />
          <span className="font-semibold text-[11px] tracking-wide">Speaking</span>
        </div>
      );
    }
    if (isAnalyzing && !isCustomer) {
      return (
        <div className="flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-950/60 px-2.5 py-0.5 text-xs text-indigo-200 shadow-sm">
          <span className="size-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span className="font-medium text-[11px] tracking-wide">Analyzing</span>
        </div>
      );
    }
    if (isConnecting) {
      return (
        <div className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/60 px-2.5 py-0.5 text-xs text-amber-200">
          <Loader2Icon className="size-3 animate-spin text-amber-400" />
          <span className="font-medium text-[11px]">Connecting</span>
        </div>
      );
    }
    if (isError) {
      return (
        <div className="flex items-center gap-1.5 rounded-full border border-amber-600/40 bg-amber-950/50 px-2.5 py-0.5 text-xs text-amber-300">
          <span className="size-1.5 rounded-full bg-amber-400" />
          <span className="font-medium text-[11px]">Standby</span>
        </div>
      );
    }
    if (isMuted) {
      return (
        <div className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-2.5 py-0.5 text-xs text-zinc-400">
          <span className="size-1.5 rounded-full bg-zinc-500" />
          <span className="font-medium text-[11px]">Voice Muted</span>
        </div>
      );
    }
    // Default Listening / Active
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2.5 py-0.5 text-xs text-emerald-300 shadow-sm">
        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-medium text-[11px] tracking-wide">
          {isCustomer ? 'Participating' : 'Listening'}
        </span>
      </div>
    );
  };

  return (
    <div
      className={`relative flex aspect-video w-full min-h-[220px] sm:min-h-[280px] flex-col items-center justify-between overflow-hidden rounded-2xl border bg-gradient-to-b from-zinc-900/95 via-zinc-950 to-zinc-950 p-4 transition-all duration-300 shadow-lg ${
        isSpeaking
          ? 'border-violet-500/70 shadow-violet-950/30 ring-2 ring-violet-500/40 shadow-xl'
          : isAnalyzing
          ? 'border-indigo-500/40'
          : 'border-zinc-800/90 hover:border-zinc-700/80'
      }`}
    >
      {/* Top Bar: Role Badge & Voice State */}
      <div className="w-full flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2">
          <Badge className="text-[11px] font-semibold backdrop-blur-md border border-violet-600/40 bg-violet-950/60 text-violet-300 px-2.5 py-0.5 shadow-sm flex items-center gap-1">
            <SparklesIcon className="size-3 text-violet-400" />
            <span>SpecPilot AI</span>
          </Badge>
          {!isCustomer && (
            <Badge
              variant="outline"
              className="text-[10px] border-zinc-800 bg-black/40 text-zinc-400 backdrop-blur-md hidden sm:inline-flex"
            >
              AI Co-Pilot
            </Badge>
          )}
        </div>

        {/* Status Pill (Speaking / Listening / Muted) */}
        <div>{getStatusBadge()}</div>
      </div>

      {/* Center Avatar & Visual Experience */}
      <div className="flex flex-col items-center justify-center gap-3 my-auto z-10 select-none">
        {/* Animated Avatar Sphere */}
        <div className="relative flex items-center justify-center">
          {/* Subtle Outer Wave Pulse when speaking */}
          {isSpeaking && (
            <>
              <div className="absolute size-24 sm:size-28 rounded-full border border-violet-500/30 bg-violet-500/10 animate-ping opacity-75" />
              <div className="absolute size-28 sm:size-32 rounded-full border border-violet-400/20 bg-violet-500/5 animate-pulse" />
            </>
          )}

          {/* Core Avatar Circle */}
          <div
            className={`relative size-20 sm:size-24 rounded-full flex items-center justify-center border shadow-xl transition-all duration-300 ${
              isSpeaking
                ? 'border-violet-400/80 bg-gradient-to-br from-violet-900/90 to-indigo-950 text-violet-200 ring-4 ring-violet-500/20 shadow-violet-950/60 scale-105'
                : isAnalyzing
                ? 'border-indigo-500/60 bg-gradient-to-br from-indigo-950 to-zinc-900 text-indigo-300 ring-2 ring-indigo-500/20'
                : 'border-zinc-700/80 bg-gradient-to-br from-zinc-800 to-zinc-900/90 text-zinc-300'
            }`}
          >
            {isSpeaking ? (
              <BotIcon className="size-9 sm:size-11 text-violet-200 animate-pulse" />
            ) : isConnecting ? (
              <Loader2Icon className="size-9 sm:size-11 animate-spin text-amber-400" />
            ) : (
              <BotIcon className="size-9 sm:size-11 text-zinc-300" />
            )}
          </div>
        </div>

        {/* Identity & Audio Indicator */}
        <div className="flex flex-col items-center text-center gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs sm:text-sm font-bold tracking-wider uppercase text-zinc-200">
              SpecPilot AI
            </span>
          </div>

          {/* Subtitle / Waveform visualization */}
          {isSpeaking ? (
            <div className="flex items-center gap-1 h-3 mt-0.5">
              <span className="w-1 bg-violet-400 rounded-full h-2 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1 bg-violet-400 rounded-full h-3 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1 bg-violet-400 rounded-full h-4 animate-bounce" />
              <span className="w-1 bg-violet-400 rounded-full h-2.5 animate-bounce [animation-delay:-0.2s]" />
              <span className="w-1 bg-violet-400 rounded-full h-1.5 animate-bounce [animation-delay:-0.35s]" />
            </div>
          ) : (
            <p className="text-[11px] text-zinc-400 font-medium">
              {isCustomer ? 'Requirement Assistant' : 'Live Requirement Co-Pilot'}
            </p>
          )}

          {onRetry && (isError || isConnecting) && (
            <button
              onClick={onRetry}
              className="mt-2 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Click to reconnect agent"
            >
              <RefreshCwIcon className="size-3" />
              <span>Reconnect Agent</span>
            </button>
          )}

          {/* Real-time speech caption preview */}
          {isSpeaking && spokenText && (
            <p className="text-[11px] text-violet-300/90 italic font-medium max-w-[280px] truncate px-2.5 py-1 bg-violet-950/60 rounded border border-violet-800/40 mt-1 shadow-sm">
              &quot;{spokenText}&quot;
            </p>
          )}
        </div>
      </div>

      {/* Bottom Bar: Presence & Audio Status */}
      <div className="w-full flex items-center justify-between rounded-xl bg-black/60 px-3 py-1.5 backdrop-blur-md border border-zinc-800/60 z-10">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
          <SparklesIcon className="size-3 text-violet-400" />
          <span className="text-[11px]">AI Participant</span>
        </div>

        <div className="flex items-center gap-1.5">
          {isSpeaking ? (
            <div className="flex items-center gap-1 text-[11px] text-violet-400 font-semibold font-mono">
              <RadioIcon className="size-3 animate-pulse" />
              <span>Speaking</span>
            </div>
          ) : !isMuted ? (
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <MicIcon className="size-3" />
              <span className="text-[10px]">Listening</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-medium">
              <MicOffIcon className="size-3" />
              <span className="text-[10px]">Muted</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
