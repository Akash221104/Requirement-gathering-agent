import { NextRequest, NextResponse } from 'next/server';
import { agentManager } from '@/features/meeting/services/specpilot-agent';
import { meetingStore } from '@/lib/storage/meeting-store';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;
  const agent = agentManager.getAgent(meetingId);
  const status = agent ? agent.getStatus() : 'disconnected';
  return NextResponse.json({ meetingId, status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const body = await req.json().catch(() => ({}));
    const projectId = body.projectId || 'project-001';
    const rebuild = body.rebuild === true || body.forceRestart === true;

    const meeting = await meetingStore.getMeeting(meetingId, projectId);
    const mode = meeting?.mode || 'assisted';

    let agent;
    if (rebuild) {
      console.log(`[AgentRoute] Rebuilding voice agent for meeting ${meetingId}...`);
      agent = await agentManager.rebuildAgent(meetingId, meeting?.projectId || projectId, mode);
    } else {
      agent = agentManager.getOrCreateAgent(meetingId, meeting?.projectId || projectId, mode);
      // Start agent if not already active
      const currentStatus = agent.getStatus();
      if (currentStatus === 'disconnected' || currentStatus === 'error') {
        agent.start().catch((err) => {
          console.error(`[AgentRoute] Background start failed for meeting ${meetingId}:`, err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      meetingId,
      status: agent.getStatus(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to start agent';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    await agentManager.removeAgent(meetingId);
    return NextResponse.json({ success: true, meetingId, status: 'disconnected' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to stop agent';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
