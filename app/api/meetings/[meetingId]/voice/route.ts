/**
 * API Route: /api/meetings/[meetingId]/voice
 *
 * GET  — Returns current voice intervention state for the meeting.
 * POST — Toggle voice intervention on or off.
 *        Body: { enabled: boolean }
 *
 * Server-side only. No secrets returned to client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentManager } from '@/features/meeting/services/specpilot-agent';

interface RouteParams {
  params: Promise<{ meetingId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { meetingId } = await params;

  const agent = agentManager.getAgent(meetingId);
  if (!agent) {
    return NextResponse.json(
      { voiceInterventionEnabled: false, meetingId },
      { status: 200 }
    );
  }

  return NextResponse.json({
    meetingId,
    voiceInterventionEnabled: agent.isVoiceInterventionEnabled(),
    agentStatus: agent.getStatus(),
  });
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { meetingId } = await params;

  let body: { enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'Request body must contain "enabled" (boolean).' },
      { status: 400 }
    );
  }

  const agent = agentManager.getAgent(meetingId);
  if (!agent) {
    return NextResponse.json(
      { error: 'SpecPilot agent is not running for this meeting.' },
      { status: 404 }
    );
  }

  agent.setVoiceIntervention(body.enabled);

  return NextResponse.json({
    meetingId,
    voiceInterventionEnabled: agent.isVoiceInterventionEnabled(),
    message: `Voice intervention ${body.enabled ? 'enabled' : 'disabled'}.`,
  });
}
