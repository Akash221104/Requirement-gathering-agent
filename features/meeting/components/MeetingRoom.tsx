'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useParticipants,
  useTracks,
  useRoomContext,
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import '@livekit/components-styles';
import type {
  Meeting,
  TranscriptSegment,
  SpecPilotStatus,
  VoiceSuggestionMessage,
  ParticipantRole,
} from '@/types/meeting';
import type { MeetingIntelligenceState } from '@/types/requirement';
import { ParticipantTile } from './ParticipantTile';
import { SpecPilotParticipantTile } from './SpecPilotParticipantTile';
import { MeetingHeader } from './MeetingHeader';
import { MeetingControlBar } from './MeetingControlBar';
import { EngineerWorkspacePanel } from './EngineerWorkspacePanel';
import {
  startSpecPilot,
  fetchSpecPilotStatus,
  fetchMeetingTranscript,
  fetchMeetingIntelligence,
  fetchVoiceInterventionState,
  setVoiceIntervention,
} from '../services/meeting-api';
import { AlertCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MeetingRoomProps {
  meeting: Meeting | null;
  meetingId: string;
  token: string;
  serverUrl: string;
  initialAudio: boolean;
  initialVideo: boolean;
  userRole?: ParticipantRole;
  onLeave: () => void;
}

export function MeetingRoom({
  meeting,
  meetingId,
  token,
  serverUrl,
  initialAudio,
  initialVideo,
  userRole = 'engineer',
  onLeave,
}: MeetingRoomProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null);

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={initialVideo}
      audio={initialAudio}
      onDisconnected={onLeave}
      onError={(err) => setConnectionError(err.message)}
      data-lk-theme="default"
      className="flex h-screen w-full flex-col bg-zinc-950 text-zinc-100 overflow-hidden"
    >
      <RoomAudioRenderer />
      <StartAudio
        label="🔊 Click anywhere to unmute AI voice"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs px-4 py-2 rounded-full shadow-lg border border-violet-400/40 animate-pulse cursor-pointer transition-all"
      />

      {connectionError ? (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-red-950 border border-red-800 text-red-400">
            <AlertCircleIcon className="size-7" />
          </div>
          <div className="text-center space-y-1 max-w-md">
            <h2 className="text-lg font-semibold text-zinc-100">LiveKit Connection Failed</h2>
            <p className="text-xs text-zinc-400">{connectionError}</p>
          </div>
          <Button onClick={onLeave} variant="secondary" size="sm">
            Back to Pre-Join Screen
          </Button>
        </div>
      ) : (
        <MeetingRoomContent
          meeting={meeting}
          meetingId={meetingId}
          userRole={userRole}
          onLeave={onLeave}
        />
      )}
    </LiveKitRoom>
  );
}

function MeetingRoomContent({
  meeting,
  meetingId,
  userRole = 'engineer',
  onLeave,
}: {
  meeting: Meeting | null;
  meetingId: string;
  userRole?: ParticipantRole;
  onLeave: () => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();

  // Role separation check
  const isEngineer = (userRole || 'engineer').toLowerCase().includes('engineer');
  const isCustomer = !isEngineer;

  // Video tracks for remote & local participants
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);

  // SpecPilot agent status
  const [specPilotStatus, setSpecPilotStatus] = useState<SpecPilotStatus>('connecting');

  // Engineer-only states
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [intelligenceState, setIntelligenceState] = useState<MeetingIntelligenceState | null>(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);

  // Phase 4: Voice Intervention state
  const isAutonomous = meeting?.mode === 'autonomous';
  const [voiceInterventionEnabled, setVoiceInterventionEnabled] = useState(isAutonomous);
  const [voiceTogglingInProgress, setVoiceTogglingInProgress] = useState(false);
  const [voiceSuggestions, setVoiceSuggestions] = useState<VoiceSuggestionMessage[]>([]);
  const [specPilotSpokenText, setSpecPilotSpokenText] = useState<string>('');

  const projectId = meeting?.projectId || 'project-001';

  // Manual retry handler for SpecPilot AI participant
  const handleRetrySpecPilot = useCallback(async () => {
    try {
      setSpecPilotStatus('connecting');
      await startSpecPilot(meetingId, projectId, true);
      const res = await fetchSpecPilotStatus(meetingId);
      setSpecPilotStatus((res.status as SpecPilotStatus) || 'listening');
    } catch (err) {
      console.warn('[MeetingRoom] SpecPilot retry notice:', err);
      setSpecPilotStatus('error');
    }
  }, [meetingId, projectId]);

  // Phase 4: Toggle voice intervention via API (Engineer-only)
  const handleToggleVoiceIntervention = useCallback(async () => {
    if (!isEngineer) return;
    setVoiceTogglingInProgress(true);
    try {
      const result = await setVoiceIntervention(meetingId, !voiceInterventionEnabled);
      setVoiceInterventionEnabled(result.voiceInterventionEnabled);
    } catch (err) {
      console.warn('[MeetingRoom] Voice toggle error:', err);
    } finally {
      setVoiceTogglingInProgress(false);
    }
  }, [isEngineer, meetingId, voiceInterventionEnabled]);

  // Phase 4: Auto-unlock browser audio playback on user interaction
  useEffect(() => {
    if (!room) return;
    const unlock = () => {
      if (room.canPlaybackAudio === false) {
        room.startAudio().catch(() => {});
      }
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [room]);

  // Initial load: Only Engineer fetches intelligence, voice intervention state, and transcript
  useEffect(() => {
    let isMounted = true;

    if (isEngineer) {
      fetchMeetingTranscript(meetingId, projectId).then((data) => {
        if (isMounted && data.segments) {
          setSegments(data.segments);
        }
      }).catch(() => {});

      fetchMeetingIntelligence(meetingId, projectId).then((intel) => {
        if (isMounted && intel) {
          setIntelligenceState(intel);
        }
      }).catch(() => {});

      fetchVoiceInterventionState(meetingId).then((state) => {
        if (isMounted) {
          setVoiceInterventionEnabled(isAutonomous ? true : state.voiceInterventionEnabled);
        }
      }).catch(() => {});
    }

    let pollInterval: NodeJS.Timeout | null = null;
    let pollCount = 0;

    const syncAgentStatus = async () => {
      try {
        const res = await fetchSpecPilotStatus(meetingId);
        if (!isMounted) return;
        const current = (res.status as SpecPilotStatus) || 'connecting';
        setSpecPilotStatus(current);
        if (current === 'listening' || current === 'speaking') {
          if (pollInterval) clearInterval(pollInterval);
        } else if (current === 'error' && pollCount === 2) {
          // Auto-retry once on transient error
          console.log('[MeetingRoom] Auto-recovering SpecPilot connection...');
          await startSpecPilot(meetingId, projectId, true).catch(() => {});
        }
      } catch {
        // Non-blocking
      }
    };

    startSpecPilot(meetingId, projectId)
      .then(syncAgentStatus)
      .catch((err) => {
        console.warn('[MeetingRoom] SpecPilot auto-start notice:', err);
        if (isMounted) {
          setSpecPilotStatus('connecting');
        }
      });

    // Check status periodically while connecting
    pollInterval = setInterval(() => {
      pollCount++;
      if (pollCount > 10) {
        if (pollInterval) clearInterval(pollInterval);
        return;
      }
      syncAgentStatus();
    }, 2500);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [meetingId, projectId, isAutonomous, isEngineer]);

  // Subscribe to real-time LiveKit data channel messages with strict role-based access control
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, _participant?: unknown, _kind?: unknown, topic?: string) => {
      try {
        const text = new TextDecoder().decode(payload);

        // Core presence: both Customer and Engineer receive agent presence
        if (topic === 'specpilot-status') {
          const { status } = JSON.parse(text);
          if (status) {
            setSpecPilotStatus(status);
          }
          return;
        }

        // Speaking state indicator & live captions
        if (topic === 'specpilot-speaking') {
          const state = JSON.parse(text);
          if (state.isSpeaking) {
            setSpecPilotStatus('speaking');
            if (state.text) {
              setSpecPilotSpokenText(state.text);
            }
          } else {
            setSpecPilotStatus('listening');
            // Keep caption visible briefly then clear
            setTimeout(() => {
              setSpecPilotSpokenText('');
            }, 2500);
          }
          return;
        }

        // -----------------------------------------------------------------
        // ROLE-BASED ACCESS CONTROL: Customers do NOT process internal data
        // -----------------------------------------------------------------
        if (!isEngineer) {
          return;
        }

        if (topic === 'transcript') {
          const incoming: TranscriptSegment = JSON.parse(text);

          setSegments((prev) => {
            if (incoming.isFinal) {
              const filtered = prev.filter(
                (s) => s.id !== `interim-${incoming.speakerId}` && s.id !== incoming.id
              );
              return [...filtered, incoming];
            } else {
              const interimIndex = prev.findIndex(
                (s) => s.id === incoming.id || s.id === `interim-${incoming.speakerId}`
              );
              if (interimIndex >= 0) {
                const next = [...prev];
                next[interimIndex] = incoming;
                return next;
              } else {
                return [...prev, incoming];
              }
            }
          });
        } else if (topic === 'requirement-intelligence') {
          const parsed: MeetingIntelligenceState = JSON.parse(text);
          if (parsed) {
            setIntelligenceState(parsed);
          }
        } else if (topic === 'voice-suggestion') {
          const suggestion: VoiceSuggestionMessage = JSON.parse(text);
          setVoiceSuggestions((prev) => [suggestion, ...prev].slice(0, 20));
        } else if (topic === 'specpilot-voice-state') {
          const state = JSON.parse(text);
          if (typeof state.voiceInterventionEnabled === 'boolean') {
            setVoiceInterventionEnabled(state.voiceInterventionEnabled);
          }
        }
      } catch {
        // Discard malformed packets
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, isEngineer]);

  const handleLeaveRoom = () => {
    // Notify server that meeting ended and trigger post-meeting documentation
    fetch(`/api/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    }).catch(() => {});

    room?.disconnect();
    onLeave();
  };

  // Filter human participants (Customer, Engineer)
  const humanTracks = tracks.filter((t) => t.participant.identity !== 'specpilot-ai');

  // Total participant tiles in the meeting stage: Human tracks + SpecPilot AI tile
  const totalTilesCount = humanTracks.length + 1;
  const gridClasses =
    totalTilesCount <= 1
      ? 'grid-cols-1 max-w-2xl'
      : totalTilesCount === 2
      ? 'grid-cols-1 md:grid-cols-2 max-w-4xl'
      : totalTilesCount === 3
      ? isCustomer || !isWorkspaceOpen
        ? 'grid-cols-1 md:grid-cols-3 max-w-6xl'
        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-5xl'
      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 max-w-6xl';

  const intelligenceCount =
    (intelligenceState?.candidateRequirements.length || 0) +
    (intelligenceState?.issues.length || 0) +
    (intelligenceState?.clarificationQuestions.length || 0) +
    voiceSuggestions.length;

  const totalParticipantCount = Math.max(participants.length, humanTracks.length + 1);

  return (
    <div className="flex h-full w-full flex-col justify-between overflow-hidden">
      {/* Top Header */}
      <MeetingHeader
        meeting={meeting}
        meetingId={meetingId}
        participantCount={totalParticipantCount}
        userRole={userRole}
        specPilotStatus={specPilotStatus}
        onRetrySpecPilot={handleRetrySpecPilot}
        isWorkspaceOpen={isWorkspaceOpen}
        onToggleWorkspace={() => setIsWorkspaceOpen((prev) => !prev)}
        intelligenceCount={intelligenceCount}
        voiceInterventionEnabled={voiceInterventionEnabled}
      />

      {/* Live SpecPilot Closed Captions (Visible to all participants) */}
      {specPilotSpokenText && (
        <div className="mx-auto mt-2 mb-0 max-w-2xl px-5 py-2.5 rounded-2xl border border-violet-500/40 bg-zinc-950/90 backdrop-blur-xl text-zinc-100 text-xs sm:text-sm text-center shadow-2xl flex items-center justify-center gap-2.5 z-20 transition-all animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-600/30 text-violet-300 font-semibold text-[11px] uppercase tracking-wider shrink-0 border border-violet-500/30">
            <span className="size-2 rounded-full bg-violet-400 animate-ping" />
            SpecPilot
          </span>
          <span className="text-zinc-200 font-medium italic">
            &quot;{specPilotSpokenText}&quot;
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Video Stage (Takes 100% in Customer View, ~60-65% in Engineer View if workspace open) */}
        <main
          className={`flex-1 flex items-center justify-center p-3 sm:p-5 overflow-y-auto transition-all duration-300 ${
            isCustomer || !isWorkspaceOpen ? 'w-full' : 'w-full lg:w-[62%]'
          }`}
        >
          <div className={`grid w-full gap-3 transition-all duration-300 ${gridClasses}`}>
            {/* Human Participants (Customer, Requirement Engineer) */}
            {humanTracks.map((trackRef) => (
              <ParticipantTile
                key={`${trackRef.participant.identity}-${trackRef.source}`}
                trackRef={trackRef}
              />
            ))}

            {/* SpecPilot AI Participant Tile (Visible to both Customer and Engineer) */}
            <SpecPilotParticipantTile
              status={specPilotStatus}
              voiceInterventionEnabled={voiceInterventionEnabled}
              spokenText={specPilotSpokenText}
              isCustomer={isCustomer}
              onRetry={handleRetrySpecPilot}
            />
          </div>
        </main>

        {/* Engineer Unified Co-Pilot Workspace (~35-40% width) */}
        {isEngineer && (
          <EngineerWorkspacePanel
            intelligenceState={intelligenceState}
            segments={segments}
            specPilotStatus={specPilotStatus}
            voiceSuggestions={voiceSuggestions}
            isOpen={isWorkspaceOpen}
            onClose={() => setIsWorkspaceOpen(false)}
          />
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <footer className="pb-5 pt-2 flex justify-center border-t border-zinc-900/60 bg-zinc-950/80 backdrop-blur-md">
        <MeetingControlBar
          onLeave={handleLeaveRoom}
          userRole={userRole}
          isWorkspaceOpen={isWorkspaceOpen}
          onToggleWorkspace={() => setIsWorkspaceOpen((prev) => !prev)}
          intelligenceCount={intelligenceCount}
          voiceInterventionEnabled={voiceInterventionEnabled}
          onToggleVoiceIntervention={handleToggleVoiceIntervention}
          voiceTogglingInProgress={voiceTogglingInProgress}
        />
      </footer>
    </div>
  );
}
