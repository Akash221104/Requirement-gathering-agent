'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { ParticipantRole, Meeting } from '@/types/meeting';
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  UserIcon,
  BriefcaseIcon,
  ArrowLeftIcon,
  AlertCircleIcon,
} from 'lucide-react';
import Link from 'next/link';

interface PreJoinScreenProps {
  meeting: Meeting | null;
  meetingId: string;
  onJoin: (params: {
    name: string;
    role: ParticipantRole;
    audioEnabled: boolean;
    videoEnabled: boolean;
  }) => void;
  error?: string | null;
}

export function PreJoinScreen({ meeting, meetingId, onJoin, error }: PreJoinScreenProps) {
  const [role, setRole] = useState<ParticipantRole>('customer');
  const [name, setName] = useState('Customer Stakeholder');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleRoleSelect = (newRole: ParticipantRole) => {
    setRole(newRole);
    if (!name || name === 'Customer Stakeholder' || name === 'Requirement Engineer') {
      setName(newRole === 'customer' ? 'Customer Stakeholder' : 'Requirement Engineer');
    }
  };

  // Request preview camera/mic stream
  useEffect(() => {
    let active = true;

    async function initPreview() {
      try {
        setPermissionError(null);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }

        if (videoEnabled || audioEnabled) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: videoEnabled,
            audio: audioEnabled,
          });

          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          streamRef.current = stream;
          if (videoRef.current && videoEnabled) {
            videoRef.current.srcObject = stream;
          }
        } else {
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        }
      } catch (err: unknown) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Media device error';
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setPermissionError('Camera or microphone permission was denied. You can still join with audio/video off.');
        } else if (msg.includes('NotFound') || msg.includes('DevicesNotFoundError')) {
          setPermissionError('No camera or microphone device detected.');
        } else {
          setPermissionError(msg);
        }
        setVideoEnabled(false);
      }
    }

    initPreview();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [videoEnabled, audioEnabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Clean up local preview stream before joining LiveKit room
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    onJoin({
      name: name.trim(),
      role,
      audioEnabled,
      videoEnabled,
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900">
      <div className="w-full max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/meetings"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeftIcon className="size-4" />
            Back to Meetings
          </Link>
          <div className="flex items-center gap-2">
            {meetingId && meetingId !== 'undefined' && (
              <span className="text-xs text-slate-500 font-mono font-medium">ID: {meetingId}</span>
            )}
            {meeting?.mode && (
              <Badge className="text-xs capitalize border border-slate-300 bg-white text-slate-700 font-bold">
                {meeting.mode.replace('_', ' ')}
              </Badge>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3">
            <AlertCircleIcon className="size-5 shrink-0 text-red-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Connection Error</p>
              <p className="text-xs opacity-90">{error}</p>
            </div>
          </div>
        )}

        {permissionError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircleIcon className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <span>{permissionError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Video Preview Column */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900 flex items-center justify-center border border-slate-200">
              {videoEnabled ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover transform -scale-x-100"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                  <div className="flex size-20 items-center justify-center rounded-full bg-slate-800 border border-slate-700">
                    <UserIcon className="size-10 text-slate-300" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Camera is off</span>
                </div>
              )}

              {/* Status overlay badge */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <Badge className="bg-black/70 backdrop-blur-md border border-white/20 text-xs px-2 py-0.5 font-bold text-white">
                  Camera Preview
                </Badge>
              </div>

              {/* In-preview quick controls */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-md p-1.5 rounded-full border border-white/20">
                <Button
                  type="button"
                  size="icon-sm"
                  variant={audioEnabled ? 'secondary' : 'destructive'}
                  className="rounded-full"
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  title={audioEnabled ? 'Mute Mic' : 'Unmute Mic'}
                >
                  {audioEnabled ? <MicIcon className="size-4" /> : <MicOffIcon className="size-4" />}
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant={videoEnabled ? 'secondary' : 'destructive'}
                  className="rounded-full"
                  onClick={() => setVideoEnabled(!videoEnabled)}
                  title={videoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
                >
                  {videoEnabled ? <VideoIcon className="size-4" /> : <VideoOffIcon className="size-4" />}
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
              <span>Ready to enter meeting room</span>
              <span className="font-mono text-[11px] text-slate-400">LiveKit Cloud Audio/Video Ready</span>
            </div>
          </div>

          {/* Configuration Form Column */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <Card className="border-slate-200 bg-white shadow-xl rounded-2xl">
              <CardHeader className="space-y-1.5 border-b border-slate-100 pb-4">
                <CardTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Join Meeting
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium">
                  {meeting?.title && !meeting.title.includes('undefined')
                    ? meeting.title
                    : 'Configure your identity before entering the call.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Role Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700">Your Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleRoleSelect('customer')}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-bold transition-all ${
                          role === 'customer'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/30 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <UserIcon className="size-5 text-emerald-600" />
                        <span>Customer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRoleSelect('engineer')}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-bold transition-all ${
                          role === 'engineer'
                            ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500/30 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <BriefcaseIcon className="size-5 text-blue-600" />
                        <span>Req. Engineer</span>
                      </button>
                    </div>
                  </div>

                  {/* Display Name Input */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700">Display Name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alice Smith"
                      className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-500 shadow-xs"
                      required
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs h-10"
                  >
                    Enter Meeting Room
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
