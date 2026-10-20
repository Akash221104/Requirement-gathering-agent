import { transcriptStore } from '@/lib/storage/transcript-store';
import { conversationChunker } from '@/features/requirements/conversation-chunker';
import type { STTEvent } from '../stt/stt-provider';
import type { TranscriptSegment, MeetingTranscriptData } from '@/types/meeting';

export type TranscriptUpdateCallback = (segment: TranscriptSegment) => void;

interface MeetingState {
  meetingId: string;
  projectId: string;
  finalSegments: TranscriptSegment[];
  activeInterim: Map<string, TranscriptSegment>; // key: speakerId
  listeners: Set<TranscriptUpdateCallback>;
}

export class ConversationManager {
  private meetings = new Map<string, MeetingState>();

  private getOrCreateMeetingState(meetingId: string, projectId: string = 'project-001'): MeetingState {
    let state = this.meetings.get(meetingId);
    if (!state) {
      state = {
        meetingId,
        projectId,
        finalSegments: [],
        activeInterim: new Map(),
        listeners: new Set(),
      };
      this.meetings.set(meetingId, state);

      // Lazily populate previous final segments from filesystem if available
      transcriptStore.getTranscript(meetingId, projectId).then((existing) => {
        if (existing && existing.segments.length > 0 && state && state.finalSegments.length === 0) {
          state.finalSegments = [...existing.segments];
        }
      }).catch(() => {
        // Safe fallback
      });
    }
    return state;
  }

  public registerListener(meetingId: string, cb: TranscriptUpdateCallback, projectId: string = 'project-001'): void {
    const state = this.getOrCreateMeetingState(meetingId, projectId);
    state.listeners.add(cb);
  }

  public unregisterListener(meetingId: string, cb: TranscriptUpdateCallback): void {
    const state = this.meetings.get(meetingId);
    if (state) {
      state.listeners.delete(cb);
    }
  }

  public handleSTTEvent(meetingId: string, event: STTEvent, projectId: string = 'project-001'): TranscriptSegment {
    const state = this.getOrCreateMeetingState(meetingId, projectId);
    const { speakerId, speakerName, speakerRole, text, isFinal, timestamp } = event;

    if (!isFinal) {
      // Interim / Partial segment: keyed by speakerId
      const interimId = `interim-${speakerId}`;
      const segment: TranscriptSegment = {
        id: interimId,
        meetingId,
        speakerId,
        speakerName,
        speakerRole,
        text,
        isFinal: false,
        timestamp,
      };

      state.activeInterim.set(speakerId, segment);
      this.notifyListeners(state, segment);
      return segment;
    }

    // Final segment: produce stable unique ID
    const finalSegmentId = `seg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const finalSegment: TranscriptSegment = {
      id: finalSegmentId,
      meetingId,
      speakerId,
      speakerName,
      speakerRole,
      text,
      isFinal: true,
      timestamp,
    };

    // Clear active interim for this speaker
    state.activeInterim.delete(speakerId);
    state.finalSegments.push(finalSegment);

    // Persist final segment in filesystem
    transcriptStore.appendSegment(meetingId, finalSegment, projectId).catch((err) => {
      console.error(`[ConversationManager] Failed to persist segment for meeting ${meetingId}:`, err);
    });

    // Feed final segment to Phase 3 Conversation Intelligence Chunker
    try {
      conversationChunker.pushFinalSegment(meetingId, finalSegment, projectId);
    } catch (err) {
      console.warn(`[ConversationManager] Chunker push error for meeting ${meetingId}:`, err);
    }

    this.notifyListeners(state, finalSegment);
    return finalSegment;
  }

  public async handleSTTEventAsync(meetingId: string, event: STTEvent, projectId: string = 'project-001'): Promise<TranscriptSegment> {
    const segment = this.handleSTTEvent(meetingId, event, projectId);
    if (segment.isFinal) {
      await transcriptStore.appendSegment(meetingId, segment, projectId);
    }
    return segment;
  }

  public getSegments(meetingId: string, projectId: string = 'project-001'): TranscriptSegment[] {
    const state = this.getOrCreateMeetingState(meetingId, projectId);
    const interims = Array.from(state.activeInterim.values());
    return [...state.finalSegments, ...interims];
  }

  public async getPersistedTranscript(meetingId: string, projectId: string = 'project-001'): Promise<MeetingTranscriptData | null> {
    return transcriptStore.getTranscript(meetingId, projectId);
  }

  public clearMeeting(meetingId: string): void {
    this.meetings.delete(meetingId);
  }

  private notifyListeners(state: MeetingState, segment: TranscriptSegment): void {
    for (const listener of state.listeners) {
      try {
        listener(segment);
      } catch (err) {
        console.error('[ConversationManager] Listener error:', err);
      }
    }
  }
}

// Global singleton instance for the server-side runtime
const globalForConversation = globalThis as unknown as {
  conversationManager?: ConversationManager;
};

export const conversationManager = globalForConversation.conversationManager ?? new ConversationManager();
if (process.env.NODE_ENV !== 'production') {
  globalForConversation.conversationManager = conversationManager;
}
