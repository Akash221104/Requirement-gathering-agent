import { z } from 'zod';
import type { MeetingMode } from './meeting';

export type CalendarEventStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface CalendarParticipant {
  name: string;
  role: 'CUSTOMER' | 'REQUIREMENT_ENGINEER' | 'SPEC_PILOT';
  email?: string;
}

export interface CalendarEvent {
  id: string;
  projectId: string;
  meetingId: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  timezone: string;
  meetingMode: MeetingMode;
  participants: CalendarParticipant[];
  agenda: string[];
  status: CalendarEventStatus;
  linkedMeetingId?: string;
  targetRequirementIds?: string[];
  followUpReason?: string;
  createdAt: string;
  updatedAt: string;
}

export const CalendarEventSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  meetingId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm'),
  timezone: z.string().default('UTC'),
  meetingMode: z.enum(['assisted', 'autonomous']),
  participants: z.array(
    z.object({
      name: z.string().min(1),
      role: z.enum(['CUSTOMER', 'REQUIREMENT_ENGINEER', 'SPEC_PILOT']),
      email: z.string().email().optional(),
    })
  ),
  agenda: z.array(z.string()).default([]),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).default('SCHEDULED'),
  linkedMeetingId: z.string().optional(),
  targetRequirementIds: z.array(z.string()).optional(),
  followUpReason: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export interface FollowUpRecommendation {
  meetingId: string;
  projectId: string;
  recommended: boolean;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
  suggestedAgenda: string[];
  suggestedMode: MeetingMode;
  unresolvedCount: number;
}
