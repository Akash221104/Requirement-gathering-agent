'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { MeetingMode } from '@/types/meeting';
import {
  ArrowLeftIcon,
  VideoIcon,
  BriefcaseIcon,
  BotIcon,
  Loader2Icon,
} from 'lucide-react';

export default function NewMeetingPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">Loading...</div>}>
      <NewMeetingPage />
    </Suspense>
  );
}

function NewMeetingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || 'project-001';

  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<MeetingMode>('assisted');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          mode,
          projectId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create meeting');
      }

      const meeting = await res.json();
      router.push(`/meetings/${meeting.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10 flex items-center justify-center">
      <div className="w-full max-w-xl space-y-6">
        <Link
          href={projectId ? `/meetings?projectId=${projectId}` : '/meetings'}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeftIcon className="size-4" />
          Back to Meetings Workspace
        </Link>

        <Card className="border-slate-200 bg-white shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="space-y-1.5 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <VideoIcon className="size-5" />
              <Badge className="text-xs border-emerald-300 bg-emerald-50 text-emerald-800 font-bold">
                Live Elicitation Session
              </Badge>
            </div>
            <CardTitle className="text-xl font-bold text-slate-900">Create New Meeting</CardTitle>
            <CardDescription className="text-xs text-slate-500 font-medium">
              Set up a live interactive audio/video room for Client and Autonomous Requirement Elicitation.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="space-y-6">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 font-medium">
                  {error}
                </div>
              )}

              {/* Title */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Meeting Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Core System Architecture & Requirement Elicitation"
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-500 shadow-xs"
                  required
                />
              </div>

              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Meeting Mode</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('assisted')}
                    className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all ${
                      mode === 'assisted'
                        ? 'border-blue-500 bg-blue-50/70 text-blue-950 ring-2 ring-blue-500/30 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-800">
                      <BriefcaseIcon className="size-4 text-blue-600" />
                      <span>Engineer-Assisted</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                      Human Requirement Engineer leads the session with the Client, with real-time AI feature elicitation in background.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('autonomous')}
                    className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all ${
                      mode === 'autonomous'
                        ? 'border-purple-500 bg-purple-50/70 text-purple-950 ring-2 ring-purple-500/30 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-800">
                      <BotIcon className="size-4 text-purple-600" />
                      <span>Autonomous Mode</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                      SpecPilot AI independently leads the interview, probing clarification questions and evolving living specs.
                    </p>
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading || !title.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-sm h-10"
              >
                {loading ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    <span>Creating Room...</span>
                  </>
                ) : (
                  <span>Create &amp; Proceed to Room</span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
