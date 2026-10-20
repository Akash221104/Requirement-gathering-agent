'use client';

import React from 'react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core';
import { isTrackReference } from '@livekit/components-core';
import { Track } from 'livekit-client';
import { VideoTrack, useIsSpeaking, useIsMuted } from '@livekit/components-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MicIcon, MicOffIcon, VideoOffIcon } from 'lucide-react';

interface ParticipantTileProps {
  trackRef: TrackReferenceOrPlaceholder;
}

export function ParticipantTile({ trackRef }: ParticipantTileProps) {
  const participant = trackRef.participant;
  const isVideoMuted = useIsMuted(trackRef);
  const isMicMuted = useIsMuted({
    participant,
    source: Track.Source.Microphone,
  });
  const isSpeaking = useIsSpeaking(participant);
  const isLocal = participant.isLocal;

  // Video is active only when it is a valid TrackReference and not muted
  const isVideoActive = isTrackReference(trackRef) && !isVideoMuted;

  // Extract role from participant metadata or name fallback
  let role: 'customer' | 'engineer' | 'agent' = 'customer';
  try {
    if (participant.metadata) {
      const parsed = JSON.parse(participant.metadata);
      const rawRole = String(parsed.role || '').toLowerCase();
      if (rawRole.includes('engineer')) role = 'engineer';
      else if (rawRole.includes('pilot') || rawRole.includes('agent')) role = 'agent';
      else role = 'customer';
    }
  } catch {
    if (participant.name?.toLowerCase().includes('engineer')) role = 'engineer';
    else if (participant.name?.toLowerCase().includes('agent')) role = 'agent';
  }

  // Name initials for avatar fallback
  const displayName = participant.name || participant.identity;
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'P';

  const roleBadgeColor = {
    customer: 'border-emerald-600/40 bg-emerald-950/60 text-emerald-300',
    engineer: 'border-blue-600/40 bg-blue-950/60 text-blue-300',
    agent: 'border-purple-600/40 bg-purple-950/60 text-purple-300',
  }[role];

  return (
    <div
      className={`relative flex aspect-video w-full min-h-[220px] sm:min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-2xl border bg-zinc-900 transition-all duration-200 ${
        isSpeaking
          ? 'border-emerald-500 shadow-lg shadow-emerald-950/40 ring-2 ring-emerald-500/50'
          : 'border-zinc-800'
      }`}
    >
      {/* Video Stream or Avatar Fallback */}
      {isVideoActive && isTrackReference(trackRef) ? (
        <div className={`relative h-full w-full overflow-hidden ${isLocal ? 'transform -scale-x-100' : ''}`}>
          <VideoTrack
            trackRef={trackRef}
            className="h-full w-full object-cover block"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 select-none">
          <Avatar className="size-20 sm:size-24 border-2 border-zinc-700 bg-zinc-800 shadow-inner">
            <AvatarFallback className="text-xl sm:text-2xl font-bold tracking-wider text-zinc-200 bg-zinc-800">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <VideoOffIcon className="size-3.5" />
            <span>Camera Off</span>
          </div>
        </div>
      )}

      {/* Top Left: Role & Identity Badges */}
      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none z-10">
        <Badge className={`text-[11px] font-medium backdrop-blur-md border capitalize px-2 py-0.5 ${roleBadgeColor}`}>
          {role === 'engineer' ? 'Requirement Engineer' : 'Customer'}
        </Badge>
        {isLocal && (
          <Badge variant="outline" className="text-[11px] border-zinc-700 bg-black/60 text-zinc-300 backdrop-blur-md">
            You
          </Badge>
        )}
      </div>

      {/* Bottom Bar overlay: Participant Name & Mic Status */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-black/70 px-3 py-1.5 backdrop-blur-md border border-zinc-800/60 z-10">
        <span className="truncate text-xs font-semibold text-zinc-100 max-w-[200px]">
          {displayName}
        </span>

        <div className="flex items-center gap-2">
          {!isMicMuted ? (
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <MicIcon className="size-3.5" />
              {isSpeaking && <span className="text-[10px] animate-pulse font-mono">Speaking</span>}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-red-400">
              <MicOffIcon className="size-3.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
