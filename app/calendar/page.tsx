'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  FileText,
  ExternalLink,
  Download,
  Plus,
  ArrowLeft,
  Users,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CalendarEvent } from '@/types/calendar';
import { buildGoogleCalendarUrl } from '@/lib/calendar/ics-generator';

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('10:00');
  const [newMode, setNewMode] = useState<'assisted' | 'autonomous'>('assisted');
  const [newAgenda, setNewAgenda] = useState('Review baseline requirements, Clarify open ambiguities');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/calendar');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (e) {
      console.warn('Failed to fetch calendar events:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) return;

    try {
      setSubmitting(true);
      const meetingId = `meeting-${Date.now().toString(36)}`;
      const payload = {
        meetingId,
        projectId: 'project-001',
        title: newTitle.trim(),
        description: 'Requirement discovery session organized with SpecPilot AI',
        date: newDate,
        startTime: newTime,
        endTime: calculateEndTime(newTime),
        meetingMode: newMode,
        agenda: newAgenda.split(',').map((s) => s.trim()).filter(Boolean),
        attendees: [
          { name: 'Requirement Engineer', role: 'REQUIREMENT_ENGINEER' },
          { name: 'Customer Stakeholder', role: 'CUSTOMER' },
        ],
        status: 'SCHEDULED',
      };

      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Also register in meetingStore
        await fetch('/api/meetings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newTitle.trim(),
            mode: newMode,
            projectId: 'project-001',
          }),
        });

        setShowScheduleModal(false);
        setNewTitle('');
        setNewDate('');
        fetchEvents();
      }
    } catch (err) {
      console.error('Failed to create calendar event:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const calculateEndTime = (start: string) => {
    try {
      const [h, m] = start.split(':').map((n) => parseInt(n, 10));
      const total = h * 60 + m + 45; // 45 min meeting
      const endH = Math.floor(total / 60) % 24;
      const endM = total % 60;
      return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
    } catch {
      return '10:45';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Navigation & Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
              <Link href="/meetings" className="flex items-center gap-1 hover:text-slate-900 transition-colors">
                <ArrowLeft className="size-3.5" />
                <span>Back to Meetings</span>
              </Link>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
              <CalendarIcon className="size-6 text-emerald-600" />
              <span>Requirement Meeting Calendar</span>
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              Schedule, track, and sync requirement discovery &amp; follow-up sessions across stakeholders.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowScheduleModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs shadow-xs"
            >
              <Plus className="size-4" />
              <span>Schedule Follow-Up</span>
            </Button>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card className="border-dashed border-slate-300 bg-white shadow-xs text-center py-16">
            <CardHeader className="space-y-3">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-slate-500">
                <CalendarIcon className="size-6 text-slate-600" />
              </div>
              <CardTitle className="text-lg font-bold text-slate-800">No Calendar Events Scheduled</CardTitle>
              <CardDescription className="text-xs text-slate-500 max-w-sm mx-auto">
                No follow-up requirement sessions have been scheduled yet. Click below to book a discovery session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setShowScheduleModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs shadow-xs"
              >
                <Plus className="size-4" />
                <span>Schedule First Meeting</span>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {events.map((ev) => {
              const isAutonomous = ev.meetingMode === 'autonomous';
              const googleCalUrl = buildGoogleCalendarUrl(ev);

              return (
                <Card
                  key={ev.id}
                  className="border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col justify-between shadow-xs rounded-xl"
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 border ${
                            isAutonomous
                              ? 'border-purple-300 bg-purple-50 text-purple-800'
                              : 'border-blue-300 bg-blue-50 text-blue-800'
                          }`}
                        >
                          {isAutonomous ? 'Autonomous Mode' : 'Engineer-Assisted'}
                        </Badge>
                        {ev.linkedMeetingId && (
                          <Badge className="text-[10px] border-emerald-300 bg-emerald-50 text-emerald-800 font-bold">
                            Follow-Up Session
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono text-slate-500 font-medium">
                        <Clock className="size-3.5 text-slate-400" />
                        <span>
                          {ev.date} &bull; {ev.startTime} - {ev.endTime}
                        </span>
                      </div>
                    </div>

                    <CardTitle className="text-base font-bold text-slate-900 mt-2">
                      {ev.title}
                    </CardTitle>
                    {ev.description && (
                      <CardDescription className="text-xs text-slate-600 line-clamp-2 font-normal">
                        {ev.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="border-t border-slate-100 mt-2 pt-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Agenda items */}
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                      <Users className="size-3.5 text-slate-400" />
                      <span>{ev.participants?.length || 0} Attendees</span>
                      {ev.agenda.length > 0 && (
                        <span className="text-slate-400">&bull; {ev.agenda.length} Agenda Topics</span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={googleCalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-xs transition-colors"
                      >
                        <ExternalLink className="size-3 text-slate-500" />
                        <span>Google Calendar</span>
                      </a>

                      <a
                        href={`/api/calendar/${ev.id}/ics`}
                        download
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-xs transition-colors"
                      >
                        <Download className="size-3 text-slate-500" />
                        <span>Download .ics</span>
                      </a>

                      <Link href={`/meetings/${ev.meetingId}`}>
                        <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs px-3.5">
                          <Video className="size-3.5" />
                          <span>Join Meeting</span>
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Schedule Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="size-4 text-emerald-600" />
                  <span>Schedule Requirement Session</span>
                </h3>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="text-slate-400 hover:text-slate-800 text-xl font-bold"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Session Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Follow-Up: Payment Gateway & User Roles"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 mb-1 font-bold">Meeting Date</label>
                    <input
                      type="date"
                      required
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1 font-bold">Start Time</label>
                    <input
                      type="time"
                      required
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Session Mode</label>
                  <select
                    value={newMode}
                    onChange={(e) => setNewMode(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs font-medium"
                  >
                    <option value="assisted">Requirement Engineer-Assisted (Human Co-Pilot)</option>
                    <option value="autonomous">Autonomous AI Follow-Up (SpecPilot Led)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Agenda Topics (comma separated)</label>
                  <input
                    type="text"
                    value={newAgenda}
                    onChange={(e) => setNewAgenda(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowScheduleModal(false)}
                    className="text-slate-600 hover:text-slate-900 font-semibold text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 shadow-xs"
                  >
                    {submitting ? 'Scheduling...' : 'Save & Schedule'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
