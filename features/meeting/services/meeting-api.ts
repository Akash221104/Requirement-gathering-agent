import type { Meeting, MeetingMode, MeetingTokenResponse } from '@/types/meeting';

export async function fetchMeetingToken(
  room: string,
  identity: string,
  name: string,
  role: string
): Promise<MeetingTokenResponse> {
  const params = new URLSearchParams({
    room,
    identity,
    name,
    role,
  });

  const res = await fetch(`/api/livekit/token?${params.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch token: HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchMeeting(meetingId: string): Promise<Meeting> {
  const res = await fetch(`/api/meetings/${meetingId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch meeting: HTTP ${res.status}`);
  }
  return res.json();
}

export async function createMeeting(
  title: string,
  mode: MeetingMode = 'assisted',
  projectId: string = 'project-001'
): Promise<Meeting> {
  const res = await fetch('/api/meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, mode, projectId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create meeting: HTTP ${res.status}`);
  }

  return res.json();
}

export async function startSpecPilot(
  meetingId: string,
  projectId: string = 'project-001',
  rebuild: boolean = false
): Promise<{ status: string }> {
  const res = await fetch(`/api/meetings/${meetingId}/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, rebuild }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to start SpecPilot: HTTP ${res.status}`);
  }
  return res.json();
}

export async function stopSpecPilot(meetingId: string): Promise<{ status: string }> {
  const res = await fetch(`/api/meetings/${meetingId}/agent`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to stop SpecPilot: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchSpecPilotStatus(meetingId: string): Promise<{ status: string }> {
  const res = await fetch(`/api/meetings/${meetingId}/agent`);
  if (!res.ok) return { status: 'disconnected' };
  return res.json();
}

export async function fetchMeetingTranscript(
  meetingId: string,
  projectId: string = 'project-001'
): Promise<{ segments: import('@/types/meeting').TranscriptSegment[] }> {
  const res = await fetch(`/api/meetings/${meetingId}/transcript?projectId=${projectId}`);
  if (!res.ok) return { segments: [] };
  return res.json();
}

export async function fetchMeetingIntelligence(
  meetingId: string,
  projectId: string = 'project-001'
): Promise<import('@/types/requirement').MeetingIntelligenceState | null> {
  const res = await fetch(`/api/meetings/${meetingId}/intelligence?projectId=${projectId}`);
  if (!res.ok) return null;
  return res.json();
}

// Phase 4: Voice Intervention
export async function fetchVoiceInterventionState(
  meetingId: string
): Promise<{ voiceInterventionEnabled: boolean }> {
  const res = await fetch(`/api/meetings/${meetingId}/voice`);
  if (!res.ok) return { voiceInterventionEnabled: false };
  return res.json();
}

export async function setVoiceIntervention(
  meetingId: string,
  enabled: boolean
): Promise<{ voiceInterventionEnabled: boolean; message: string }> {
  const res = await fetch(`/api/meetings/${meetingId}/voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to toggle voice intervention: HTTP ${res.status}`);
  }
  return res.json();
}

