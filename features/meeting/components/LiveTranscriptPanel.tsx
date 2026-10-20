'use client';

import React, { useEffect, useRef } from 'react';
import type { TranscriptSegment, SpecPilotStatus } from '@/types/meeting';
import { Badge } from '@/components/ui/badge';
import {
  FileTextIcon,
  XIcon,
  RadioIcon,
  AlertTriangleIcon,
} from 'lucide-react';

interface LiveTranscriptPanelProps {
  segments: TranscriptSegment[];
  specPilotStatus: SpecPilotStatus;
  isOpen: boolean;
  onClose: () => void;
}

export function LiveTranscriptPanel({
  segments,
  specPilotStatus,
  isOpen,
  onClose,
}: LiveTranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new segments or changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments]);

  if (!isOpen) return null;

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  const getRoleBadge = (role: string) => {
    const r = role.toUpperCase();
    if (r.includes('ENGINEER')) {
      return (
        <Badge className="bg-emerald-950/80 text-emerald-300 border-emerald-800 text-[10px] font-medium px-1.5 py-0">
          Requirement Engineer
        </Badge>
      );
    }
    if (r.includes('PILOT') || r.includes('AGENT')) {
      return (
        <Badge className="bg-purple-950/80 text-purple-300 border-purple-800 text-[10px] font-medium px-1.5 py-0">
          SpecPilot AI
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-950/80 text-blue-300 border-blue-800 text-[10px] font-medium px-1.5 py-0">
        Customer
      </Badge>
    );
  };

  return (
    <aside className="w-80 lg:w-96 flex flex-col h-full border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-2xl transition-all duration-200 z-20">
      {/* Panel Header */}
      <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        <div className="flex items-center gap-2">
          <FileTextIcon className="size-4 text-zinc-300" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
            Live Transcript
          </h2>
          {specPilotStatus === 'transcribing' && (
            <span className="flex items-center gap-1 text-[10px] text-indigo-400 font-mono animate-pulse">
              <RadioIcon className="size-3" />
              Live
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-zinc-500">
            {segments.filter((s) => s.isFinal).length} segments
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            title="Close Transcript Panel"
            type="button"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Non-blocking Status Notice if STT unavailable */}
      {specPilotStatus === 'error' && (
        <div className="flex items-center gap-2 border-b border-amber-900/50 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-300">
          <AlertTriangleIcon className="size-3.5 shrink-0 text-amber-400" />
          <span>SpecPilot transcription unavailable. Meeting continues normally.</span>
        </div>
      )}

      {/* Transcript Items Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {segments.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
            <FileTextIcon className="size-8 stroke-[1.5] text-zinc-600" />
            <p className="text-xs font-medium text-zinc-400">Waiting for speech...</p>
            <p className="text-[11px] leading-relaxed max-w-[200px]">
              Customer and Engineer utterances will appear here in real time.
            </p>
          </div>
        ) : (
          segments.map((segment) => (
            <div
              key={segment.id}
              className={`rounded-lg border p-3 transition-all ${
                segment.isFinal
                  ? 'border-zinc-800/80 bg-zinc-900/50'
                  : 'border-zinc-700/50 bg-zinc-900/20 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-200">
                    {segment.speakerName}
                  </span>
                  {getRoleBadge(segment.speakerRole)}
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  {formatTimestamp(segment.timestamp)}
                </span>
              </div>

              <p
                className={`text-xs leading-relaxed ${
                  segment.isFinal
                    ? 'text-zinc-200'
                    : 'text-zinc-400 italic'
                }`}
              >
                {segment.text}
                {!segment.isFinal && (
                  <span className="inline-block ml-1 animate-pulse text-indigo-400 font-bold">
                    ...
                  </span>
                )}
              </p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
