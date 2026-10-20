'use client';

import React, { useState, useEffect, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { Meeting, ParticipantRole } from '@/types/meeting';
import { fetchMeeting, fetchMeetingToken } from '@/features/meeting/services/meeting-api';
import { PreJoinScreen } from '@/features/meeting/components/PreJoinScreen';
import { MeetingRoom } from '@/features/meeting/components/MeetingRoom';
import { Loader2Icon } from 'lucide-react';

interface MeetingRoomPageProps {
  params: Promise<{ meetingId: string }>;
}

export default function MeetingRoomPage({ params }: MeetingRoomPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
          <div className="flex flex-col items-center gap-3">
            <Loader2Icon className="size-8 animate-spin text-emerald-500" />
            <span className="text-xs text-zinc-400 font-medium">Preparing meeting room...</span>
          </div>
        </div>
      }
    >
      <MeetingRoomContent params={params} />
    </Suspense>
  );
}

function MeetingRoomContent({ params }: MeetingRoomPageProps) {
  const { meetingId } = use(params);
  const router = useRouter();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // LiveKit Connection State
  const [inRoom, setInRoom] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [initialAudio, setInitialAudio] = useState(true);
  const [initialVideo, setVideoEnabled] = useState(true);
  const [userRole, setUserRole] = useState<ParticipantRole>('customer');

  // Load meeting metadata
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchMeeting(meetingId);
        if (active) setMeeting(data);
      } catch (err: unknown) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Failed to load meeting';
        console.warn('Meeting fetch issue:', msg);
        if (active) {
          setMeeting({
            id: meetingId || 'requirement-meeting',
            projectId: 'project-001',
            title: 'Requirement Elicitation Meeting',
            mode: 'assisted',
            status: 'in_progress',
            participants: [],
            agenda: [],
            createdAt: new Date().toISOString(),
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [meetingId]);

  // Handle Join click from PreJoinScreen
  const handleJoin = async ({
    name,
    role,
    audioEnabled,
    videoEnabled: vEnabled,
  }: {
    name: string;
    role: ParticipantRole;
    audioEnabled: boolean;
    videoEnabled: boolean;
  }) => {
    try {
      setError(null);
      setUserRole(role);
      const identity = `${role}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

      const tokenData = await fetchMeetingToken(meetingId, identity, name, role);

      setToken(tokenData.token);
      setServerUrl(tokenData.serverUrl);
      setInitialAudio(audioEnabled);
      setVideoEnabled(vEnabled);
      setInRoom(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to LiveKit';
      setError(msg);
    }
  };

  const handleLeave = () => {
    setInRoom(false);
    setToken(null);
    setServerUrl(null);
    router.push('/meetings');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2Icon className="size-8 animate-spin text-emerald-500" />
          <span className="text-xs text-zinc-400 font-medium">Preparing meeting room...</span>
        </div>
      </div>
    );
  }

  if (inRoom && token && serverUrl) {
    return (
      <MeetingRoom
        meeting={meeting}
        meetingId={meetingId}
        token={token}
        serverUrl={serverUrl}
        initialAudio={initialAudio}
        initialVideo={initialVideo}
        userRole={userRole}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <PreJoinScreen
      meeting={meeting}
      meetingId={meetingId}
      onJoin={handleJoin}
      error={error}
    />
  );
}
