import type { TranscriptSegment } from '@/types/meeting';
import type { MeetingIntelligenceState } from '@/types/requirement';
import { requirementIntelligenceEngine } from './services/requirement-intelligence';

export type IntelligenceCallback = (state: MeetingIntelligenceState) => void;

const REQUIREMENT_TRIGGER_KEYWORDS = [
  'need',
  'want',
  'should',
  'must',
  'require',
  'feature',
  'system',
  'able to',
  'support',
  'allow',
  'fast',
  'quick',
  'user',
  'admin',
  'login',
  'password',
  'data',
  'report',
  'access',
  'security',
  'can you',
  'tell me',
  'what',
  'which',
  'how',
  'why',
  'who',
  'recommend',
  'suggest',
  'specpilot',
  'spentfiber',
  'pilot',
  'stack',
  'architecture',
  'technology',
  'database',
  'framework',
  'hello',
  'hi',
  'are you there',
  'think',
];

interface ChunkerMeetingSession {
  meetingId: string;
  projectId: string;
  pendingSegments: TranscriptSegment[];
  analyzedSegmentIds: Set<string>;
  historySegments: TranscriptSegment[];
  idleTimer: NodeJS.Timeout | null;
  isProcessing: boolean;
  listeners: Set<IntelligenceCallback>;
}

export class ConversationChunker {
  private sessions = new Map<string, ChunkerMeetingSession>();

  private getOrCreateSession(meetingId: string, projectId: string = 'project-001'): ChunkerMeetingSession {
    let session = this.sessions.get(meetingId);
    if (!session) {
      session = {
        meetingId,
        projectId,
        pendingSegments: [],
        analyzedSegmentIds: new Set(),
        historySegments: [],
        idleTimer: null,
        isProcessing: false,
        listeners: new Set(),
      };
      this.sessions.set(meetingId, session);
    }
    return session;
  }

  public onIntelligenceUpdate(
    meetingId: string,
    callback: IntelligenceCallback,
    projectId: string = 'project-001'
  ): () => void {
    const session = this.getOrCreateSession(meetingId, projectId);
    session.listeners.add(callback);
    return () => {
      session.listeners.delete(callback);
    };
  }

  /**
   * Consume a final transcript segment.
   * Interim transcripts are strictly ignored.
   */
  public pushFinalSegment(
    meetingId: string,
    segment: TranscriptSegment,
    projectId: string = 'project-001'
  ): void {
    // Defense: Only process final transcripts
    if (!segment.isFinal) {
      return;
    }

    const session = this.getOrCreateSession(meetingId, projectId);

    // Prevent duplicate analysis of the same segment
    if (session.analyzedSegmentIds.has(segment.id)) {
      return;
    }

    // Add to pending chunk & history
    session.pendingSegments.push(segment);
    session.historySegments.push(segment);
    if (session.historySegments.length > 15) {
      session.historySegments.shift();
    }

    // Check if the utterance triggers immediate or debounced evaluation
    const textLower = segment.text.toLowerCase();
    const isQuestionOrInquiry =
      segment.text.includes('?') ||
      /\b(can you|could you|tell me|what|which|how|why|who|recommend|suggest|specpilot|spentfiber|pilot|hello|hi|are you there)\b/i.test(
        textLower
      );
    const hasTriggerKeyword =
      isQuestionOrInquiry || REQUIREMENT_TRIGGER_KEYWORDS.some((kw) => textLower.includes(kw));

    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
      session.idleTimer = null;
    }

    if (isQuestionOrInquiry) {
      // Fast debounce (800ms) for questions so SpecPilot responds promptly
      session.idleTimer = setTimeout(() => {
        this.triggerAnalysis(session);
      }, 800);
    } else if (session.pendingSegments.length >= 3) {
      this.triggerAnalysis(session);
    } else if (hasTriggerKeyword) {
      // Short debounce (1.5s) to allow natural pauses within a thought
      session.idleTimer = setTimeout(() => {
        this.triggerAnalysis(session);
      }, 1500);
    } else {
      // Idle timeout (2.5s)
      session.idleTimer = setTimeout(() => {
        this.triggerAnalysis(session);
      }, 2500);
    }
  }

  /**
   * Triggers chunk analysis asynchronously without blocking conversation flow.
   */
  public async triggerAnalysis(session: ChunkerMeetingSession): Promise<MeetingIntelligenceState | null> {
    if (session.isProcessing || session.pendingSegments.length === 0) {
      return null;
    }

    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
      session.idleTimer = null;
    }

    session.isProcessing = true;
    const chunkToAnalyze = [...session.pendingSegments];
    const context = session.historySegments.slice(0, Math.max(0, session.historySegments.length - chunkToAnalyze.length));

    // Mark IDs as analyzed immediately to prevent double processing
    for (const seg of chunkToAnalyze) {
      session.analyzedSegmentIds.add(seg.id);
    }
    session.pendingSegments = [];

    try {
      const state = await requirementIntelligenceEngine.analyzeChunk(
        session.meetingId,
        session.projectId,
        chunkToAnalyze,
        context
      );

      if (state) {
        for (const listener of session.listeners) {
          try {
            listener(state);
          } catch (e) {
            console.error('[ConversationChunker] Listener dispatch error:', e);
          }
        }
      }

      return state;
    } catch (err) {
      console.warn(`[ConversationChunker] Error during chunk analysis for meeting ${session.meetingId}:`, err);
      return null;
    } finally {
      session.isProcessing = false;

      // If more segments arrived while analyzing, trigger next batch
      if (session.pendingSegments.length >= 2) {
        setTimeout(() => this.triggerAnalysis(session), 1000);
      }
    }
  }

  public clearMeeting(meetingId: string): void {
    const session = this.sessions.get(meetingId);
    if (session?.idleTimer) {
      clearTimeout(session.idleTimer);
    }
    this.sessions.delete(meetingId);
  }
}

// Global Singleton
const globalForChunker = globalThis as unknown as {
  conversationChunker?: ConversationChunker;
};

export const conversationChunker =
  globalForChunker.conversationChunker ?? new ConversationChunker();

if (process.env.NODE_ENV !== 'production') {
  globalForChunker.conversationChunker = conversationChunker;
}
