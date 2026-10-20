import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get('room');
  const identity = req.nextUrl.searchParams.get('identity');
  const name = req.nextUrl.searchParams.get('name') || identity;
  const role = req.nextUrl.searchParams.get('role') || 'customer';

  if (!room || !identity) {
    return NextResponse.json(
      { error: 'Missing required query parameters: "room" and "identity" are required.' },
      { status: 400 }
    );
  }

  return generateToken({ room, identity, name: name || identity, role });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { room, identity, name, role } = body;

    if (!room || !identity) {
      return NextResponse.json(
        { error: 'Missing required parameters: "room" and "identity" are required.' },
        { status: 400 }
      );
    }

    return generateToken({
      room,
      identity,
      name: name || identity,
      role: role || 'customer',
    });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

async function generateToken({
  room,
  identity,
  name,
  role,
}: {
  room: string;
  identity: string;
  name: string;
  role: string;
}) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      {
        error:
          'LiveKit Cloud is not configured. Please set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL (or NEXT_PUBLIC_LIVEKIT_URL) in your .env.local file.',
      },
      { status: 500 }
    );
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      metadata: JSON.stringify({ role }),
      ttl: '4h',
    });

    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      token,
      serverUrl: wsUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate token';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
