/**
 * SpecPilotAgent — Phase 4 (Voice Intervention)
 *
 * Extends Phase 3 with:
 * - VoiceInterventionService integration (TTS + LiveKit audio publishing)
 * - Barge-in: notifies VoiceInterventionService when a human starts speaking
 * - Self-listen prevention: SpecPilot's own audio track is NEVER sent to STT
 *   (identity guard: participant.identity !== 'specpilot-ai' at STT subscription)
 * - Voice intervention toggle (ON/OFF) — default OFF
 * - Broadcasting 'specpilot-voice-state' topic to the UI
 */

import {
  Room,
  RoomEvent,
  TrackKind,
  AudioStream,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
} from '@livekit/rtc-node';
import { AccessToken } from 'livekit-server-sdk';
import { DeepgramSTTProvider } from '../stt/deepgram-stt-provider';
import { conversationManager } from '../conversation/conversation-manager';
import { conversationChunker } from '@/features/requirements/conversation-chunker';
import { VoiceInterventionService } from './voice-intervention-service';
import { autonomousMeetingManager } from './autonomous-meeting-manager';
import { DeepgramVoiceAgent } from '@/lib/voice/deepgram-voice-agent';
import { projectKnowledgeService } from '@/features/requirements/services/project-knowledge-service';
import type { SpecPilotStatus, TranscriptSegment } from '@/types/meeting';
import type { MeetingIntelligenceState } from '@/types/requirement';

interface SpeakerSession {
  participantIdentity: string;
  abortController: AbortController;
  role?: 'CUSTOMER' | 'REQUIREMENT_ENGINEER' | 'SPEC_PILOT' | 'UNKNOWN';
  name?: string;
  stt?: DeepgramSTTProvider;
}

export class SpecPilotAgent {
  public readonly meetingId: string;
  public readonly projectId: string;
  private room: Room | null = null;
  private status: SpecPilotStatus = 'disconnected';
  private speakerSessions = new Map<string, SpeakerSession>();
  private statusListeners = new Set<(status: SpecPilotStatus) => void>();
  private transcribingResetTimer: NodeJS.Timeout | null = null;
  private intelligenceUnsubscribe: (() => void) | null = null;

  // Real-time conversational voice agent (low latency unified STT + LLM + TTS)
  private voiceAgent: DeepgramVoiceAgent | null = null;
  private lastActiveSpeaker: {
    identity: string;
    name: string;
    role: 'CUSTOMER' | 'REQUIREMENT_ENGINEER' | 'SPEC_PILOT' | 'UNKNOWN';
  } | null = null;

  // Voice Intervention Service (LiveKit audio publishing and queue drain)
  private voiceInterventionService: VoiceInterventionService;

  public readonly meetingMode: 'assisted' | 'autonomous';

  constructor(
    meetingId: string,
    projectId: string = 'project-001',
    mode: 'assisted' | 'autonomous' = 'assisted'
  ) {
    this.meetingId = meetingId;
    this.projectId = projectId;
    this.meetingMode = mode;
    this.voiceInterventionService = new VoiceInterventionService(meetingId, mode);
  }

  public getStatus(): SpecPilotStatus {
    return this.status;
  }

  public isVoiceInterventionEnabled(): boolean {
    return this.voiceInterventionService.isEnabled();
  }

  /**
   * Toggle voice intervention ON or OFF.
   * Called by the API route when the RE flips the voice switch.
   * Default is OFF.
   */
  public setVoiceIntervention(enabled: boolean): void {
    this.voiceInterventionService.setVoiceInterventionEnabled(enabled);
    // Broadcast updated voice state to browsers
    this.broadcastVoiceState(enabled).catch(() => {});
  }

  public onStatusChange(listener: (status: SpecPilotStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(newStatus: SpecPilotStatus): void {
    if (this.status === newStatus) return;
    this.status = newStatus;
    for (const listener of this.statusListeners) {
      try {
        listener(newStatus);
      } catch {
        // Safe callback execution
      }
    }
    this.broadcastStatus(newStatus);
  }

  private async broadcastStatus(status: SpecPilotStatus): Promise<void> {
    if (!this.room || !this.room.localParticipant) return;
    try {
      const payload = Buffer.from(JSON.stringify({ status, meetingId: this.meetingId }));
      await this.room.localParticipant.publishData(payload, {
        reliable: true,
        topic: 'specpilot-status',
      });
    } catch {
      // Non-blocking if broadcast drops
    }
  }

  private async broadcastVoiceState(voiceEnabled: boolean): Promise<void> {
    if (!this.room || !this.room.localParticipant) return;
    try {
      const payload = Buffer.from(
        JSON.stringify({
          meetingId: this.meetingId,
          voiceInterventionEnabled: voiceEnabled,
        })
      );
      await this.room.localParticipant.publishData(payload, {
        reliable: true,
        topic: 'specpilot-voice-state',
      });
    } catch {
      // Non-blocking
    }
  }

  private async broadcastTranscript(segment: TranscriptSegment): Promise<void> {
    if (!this.room || !this.room.localParticipant) return;
    try {
      const payload = Buffer.from(JSON.stringify(segment));
      await this.room.localParticipant.publishData(payload, {
        reliable: true,
        topic: 'transcript',
      });
    } catch {
      // Non-blocking
    }
  }

  private async broadcastIntelligence(state: MeetingIntelligenceState): Promise<void> {
    if (!this.room || !this.room.localParticipant) return;
    try {
      const payload = Buffer.from(JSON.stringify(state));
      await this.room.localParticipant.publishData(payload, {
        reliable: true,
        topic: 'requirement-intelligence',
      });
    } catch {
      // Non-blocking
    }
  }

  public async start(): Promise<void> {
    if (
      this.status === 'listening' ||
      this.status === 'connecting' ||
      this.status === 'transcribing' ||
      this.status === 'speaking'
    ) {
      return;
    }

    this.setStatus('connecting');

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      this.setStatus('error');
      throw new Error('LiveKit credentials are not configured on server.');
    }

    try {
      // Create token for SpecPilot AI participant
      // canPublish: true is required in Phase 4 so we can publish TTS audio
      const at = new AccessToken(apiKey, apiSecret, {
        identity: 'specpilot-ai',
        name: 'SpecPilot AI',
        metadata: JSON.stringify({ role: 'SPEC_PILOT' }),
        ttl: '6h',
      });

      at.addGrant({
        roomJoin: true,
        room: this.meetingId,
        canPublish: true,     // Phase 4: needed to publish TTS audio track
        canSubscribe: true,
        canPublishData: true,
      });

      const token = await at.toJwt();

      let connectSuccess = false;
      let lastConnectError: unknown = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (this.room) {
            try { await this.room.disconnect(); } catch {}
          }
          this.room = new Room();
          this.voiceInterventionService.attachRoom(this.room);
          this.setupRoomListeners();

          console.log(`[SpecPilotAgent] Connecting to LiveKit room ${this.meetingId} (attempt ${attempt}/3)...`);
          await this.room.connect(wsUrl, token, {
            autoSubscribe: true,
            dynacast: false,
          });

          connectSuccess = true;
          console.log(`[SpecPilotAgent] Successfully joined LiveKit room ${this.meetingId} as SpecPilot AI`);
          break;
        } catch (connErr) {
          lastConnectError = connErr;
          console.warn(`[SpecPilotAgent] Connect attempt ${attempt}/3 failed:`, connErr);
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1200 * attempt));
          }
        }
      }

      if (!connectSuccess) {
        throw lastConnectError || new Error(`Failed to connect to LiveKit room ${this.meetingId} after 3 attempts`);
      }

      this.setStatus('listening');

      // Initialize Deepgram Voice Agent with Continuous Cross-Meeting Knowledge Base
      try {
        let knowledgePrompt = '';
        try {
          knowledgePrompt = await projectKnowledgeService.buildVoiceAgentKnowledgePrompt(
            this.projectId,
            this.meetingId,
            this.meetingMode
          );
          console.log(`[SpecPilotAgent] Injected continuous cross-meeting knowledge base for project ${this.projectId}`);
        } catch (e) {
          console.warn('[SpecPilotAgent] Could not build knowledge prompt, using default:', e);
        }

        this.voiceAgent = new DeepgramVoiceAgent({
          meetingId: this.meetingId,
          projectId: this.projectId,
          mode: this.meetingMode,
          systemPrompt: knowledgePrompt || undefined,
          onUserStartedSpeaking: () => {
            // Echo guard: Never abort during the first 2000ms of agent speaking
            // (prevents acoustic speaker echo from immediately cutting off the AI)
            if (this.voiceInterventionService.isSpeaking()) {
              console.log('[SpecPilotAgent] UserStartedSpeaking received while speaking');
            }
            this.voiceInterventionService.abortCurrentSpeech(false);
            this.setStatus('listening');
          },
          onConversationText: (role, text) => {
            this.setStatus('transcribing');
            if (this.transcribingResetTimer) clearTimeout(this.transcribingResetTimer);
            this.transcribingResetTimer = setTimeout(() => {
              if (this.status === 'transcribing') {
                this.setStatus('listening');
              }
            }, 3000);

            if (role === 'assistant') {
              this.voiceInterventionService.broadcastSpeakingStatus(true, text).catch(() => {});
              const segment = conversationManager.handleSTTEvent(
                this.meetingId,
                {
                  speakerId: 'specpilot-ai',
                  speakerName: 'SpecPilot AI',
                  speakerRole: 'SPEC_PILOT',
                  text,
                  isFinal: true,
                  timestamp: new Date().toISOString(),
                },
                this.projectId
              );
              this.broadcastTranscript(segment);
            } else {
              // Verified human speech arrived from user
              this.voiceInterventionService.notifyHumanSpeaking();

              const speaker = this.lastActiveSpeaker || {
                identity: 'customer',
                name: 'Customer',
                role: 'CUSTOMER' as const,
              };
              const segment = conversationManager.handleSTTEvent(
                this.meetingId,
                {
                  speakerId: speaker.identity,
                  speakerName: speaker.name,
                  speakerRole: speaker.role,
                  text,
                  isFinal: true,
                  timestamp: new Date().toISOString(),
                },
                this.projectId
              );
              this.broadcastTranscript(segment);

              // Asynchronously update autonomous session context if in autonomous mode
              if (this.meetingMode === 'autonomous') {
                autonomousMeetingManager
                  .handleCustomerTurn(this.meetingId, text, this.projectId)
                  .then(async (decision) => {
                    if (decision.action === 'MOVE_NEXT' || decision.topic) {
                      const ctx = await autonomousMeetingManager.getOrCreateContext(this.meetingId, this.projectId);
                      const currentTopic = decision.topic || ctx.topics[ctx.currentTopicIndex] || '';
                      if (currentTopic && this.voiceAgent) {
                        this.voiceAgent.updatePrompt(
                          `You are SpecPilot leading an autonomous requirement discovery session. ` +
                            `The current discussion topic is "${currentTopic}". ` +
                            `Ask the customer clear, focused requirement-gathering questions about this topic.`
                        );
                      }
                    }
                  })
                  .catch((err) => {
                    console.warn('[SpecPilotAgent] Autonomous tracking notice:', err);
                  });
              }
            }
          },
          onAudioChunk: (buf) => {
            // Stream 48kHz audio directly into LiveKit persistent track
            this.setStatus('speaking');
            this.voiceInterventionService.queueStreamingChunk(buf);
          },
          onAgentStartedSpeaking: () => {
            this.setStatus('speaking');
          },
          onAgentAudioDone: () => {
            this.voiceInterventionService.onVoiceAgentAudioDone().catch(() => {});
            this.setStatus('listening');
          },
          onError: (err) => {
            console.warn('[SpecPilotAgent] Deepgram Voice Agent error (meeting continues):', err.message);
          },
        });

        await this.voiceAgent.connect();
      } catch (err) {
        console.warn('[SpecPilotAgent] Failed to connect Deepgram Voice Agent (fallback mode):', err);
      }

      // Phase 5: In autonomous mode, SpecPilot leads the session and introduces the agenda
      if (this.meetingMode === 'autonomous') {
        setTimeout(async () => {
          try {
            const greeting = await autonomousMeetingManager.startSession(this.meetingId, this.projectId);
            if (this.voiceAgent && this.voiceAgent.isReady()) {
              this.voiceAgent.injectAgentMessage(greeting);
            } else {
              await this.voiceInterventionService.synthesizeAndSpeak(greeting);
            }
          } catch (err) {
            console.warn('[SpecPilotAgent] Autonomous session start notice:', err);
          }
        }, 1200);
      }

      // Subscribe to Phase 3 intelligence updates:
      // 1. Broadcast via LiveKit data channel to browsers
      // 2. Phase 4: Pass to VoiceInterventionService for speaking decision
      this.intelligenceUnsubscribe = conversationChunker.onIntelligenceUpdate(
        this.meetingId,
        (state) => {
          this.broadcastIntelligence(state);
          const segments = conversationManager.getSegments(this.meetingId, this.projectId);
          const recentTurns = segments
            .slice(-5)
            .map((s: TranscriptSegment) => ({
              speakerName: s.speakerName,
              role: s.speakerRole,
              text: s.text,
              timestamp: s.timestamp,
            }));

          // Phase 4: Non-blocking evaluation with conversational transcript context
          this.voiceInterventionService.handleIntelligenceUpdate(state, recentTurns).catch((err) => {
            console.warn('[SpecPilotAgent] Voice intervention error (meeting continues):', err);
          });
        },
        this.projectId
      );
    } catch (err) {
      console.error(`[SpecPilotAgent] Failed to join meeting ${this.meetingId}:`, err);
      this.setStatus('error');
      this.cleanup();
      // Non-blocking: human meeting continues
    }
  }

  private async handleAudioTrackSubscribed(
    track: RemoteTrack,
    participant: RemoteParticipant
  ): Promise<void> {
    const identity = participant.identity;
    const name = participant.name || identity;

    // Parse participant role from metadata
    let role: 'CUSTOMER' | 'REQUIREMENT_ENGINEER' | 'SPEC_PILOT' | 'UNKNOWN' = 'CUSTOMER';
    try {
      if (participant.metadata) {
        const parsed = JSON.parse(participant.metadata);
        const rawRole = String(parsed.role || '').toUpperCase();
        if (rawRole.includes('ENGINEER')) {
          role = 'REQUIREMENT_ENGINEER';
        } else if (rawRole.includes('PILOT') || rawRole.includes('AGENT')) {
          role = 'SPEC_PILOT';
        } else {
          role = 'CUSTOMER';
        }
      }
    } catch {
      // Fallback role detection
      if (identity.toLowerCase().includes('engineer')) {
        role = 'REQUIREMENT_ENGINEER';
      }
    }

    // Clean up any existing session for this participant
    this.handleAudioTrackUnsubscribed(identity);

    const abortController = new AbortController();

    this.speakerSessions.set(identity, {
      participantIdentity: identity,
      abortController,
      role,
      name,
    });

    try {
      // Stream audio frames directly to Deepgram Voice Agent (16kHz linear16 PCM)
      const audioStream = new AudioStream(track, 16000, 1);
      const reader = audioStream.getReader();

      (async () => {
        try {
          while (!abortController.signal.aborted) {
            const { done, value } = await reader.read();
            if (done || !value) break;

            if (role !== 'SPEC_PILOT') {
              this.lastActiveSpeaker = { identity, name, role };
            }

            // Acoustic Echo Gating:
            // When SpecPilot is speaking, avoid feeding the opening echo of the AI back into Deepgram.
            // If the agent started speaking in the last 1500ms, suppress microphone feed to Deepgram.
            const isSpeakingEchoWindow =
              this.voiceInterventionService.isSpeaking() &&
              Date.now() - this.voiceInterventionService.getStreamingStartedAt() < 1500;

            if (this.voiceAgent && !isSpeakingEchoWindow) {
              this.voiceAgent.sendAudio(value.data);
            }
          }
        } catch {
          // Audio reader ended
        } finally {
          try {
            reader.releaseLock();
          } catch {
            // Safe release
          }
        }
      })();
    } catch (err) {
      console.error(`[SpecPilotAgent] Failed to stream audio for ${identity}:`, err);
    }
  }

  private handleAudioTrackUnsubscribed(identity: string): void {
    const session = this.speakerSessions.get(identity);
    if (session) {
      session.abortController.abort();
      this.speakerSessions.delete(identity);
    }
  }

  public async stop(): Promise<void> {
    this.setStatus('disconnected');
    this.cleanup();
    if (this.room) {
      try {
        await this.room.disconnect();
      } catch {
        // Disconnect gracefully
      }
      this.room = null;
    }
  }

  private setupRoomListeners(): void {
    if (!this.room) return;

    // Listen for incoming audio tracks from participants
    this.room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        // SELF-LISTEN PREVENTION: Never process audio from SpecPilot's own identity.
        if (track.kind === TrackKind.KIND_AUDIO && participant.identity !== 'specpilot-ai') {
          this.handleAudioTrackSubscribed(track, participant);
        }
      }
    );

    this.room.on(
      RoomEvent.TrackUnsubscribed,
      (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        this.handleAudioTrackUnsubscribed(participant.identity);
      }
    );

    this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      this.handleAudioTrackUnsubscribed(participant.identity);
    });

    this.room.on(RoomEvent.Disconnected, () => {
      this.setStatus('disconnected');
      this.cleanup();
    });
  }

  private cleanup(): void {
    if (this.intelligenceUnsubscribe) {
      this.intelligenceUnsubscribe();
      this.intelligenceUnsubscribe = null;
    }
    if (this.transcribingResetTimer) {
      clearTimeout(this.transcribingResetTimer);
      this.transcribingResetTimer = null;
    }
    for (const [, session] of this.speakerSessions) {
      session.abortController.abort();
      if (session.stt) session.stt.stop().catch(() => {});
    }
    this.speakerSessions.clear();
    if (this.voiceAgent) {
      this.voiceAgent.disconnect();
      this.voiceAgent = null;
    }
    // Phase 4: clean up voice intervention service
    this.voiceInterventionService.cleanup();

    if (this.room) {
      try {
        this.room.disconnect().catch(() => {});
      } catch {}
      this.room = null;
    }
  }
}

// Global Agent Manager Singleton for server processes
class SpecPilotAgentManager {
  private agents = new Map<string, SpecPilotAgent>();

  public getOrCreateAgent(
    meetingId: string,
    projectId: string = 'project-001',
    mode: 'assisted' | 'autonomous' = 'assisted'
  ): SpecPilotAgent {
    let agent = this.agents.get(meetingId);
    if (!agent) {
      agent = new SpecPilotAgent(meetingId, projectId, mode);
      this.agents.set(meetingId, agent);
    }
    return agent;
  }

  public getAgent(meetingId: string): SpecPilotAgent | undefined {
    return this.agents.get(meetingId);
  }

  public async rebuildAgent(
    meetingId: string,
    projectId: string = 'project-001',
    mode: 'assisted' | 'autonomous' = 'assisted'
  ): Promise<SpecPilotAgent> {
    const existing = this.agents.get(meetingId);
    if (existing) {
      await existing.stop().catch(() => {});
      this.agents.delete(meetingId);
    }
    const freshAgent = new SpecPilotAgent(meetingId, projectId, mode);
    this.agents.set(meetingId, freshAgent);
    await freshAgent.start().catch((err) => {
      console.warn(`[SpecPilotAgentManager] Rebuilt agent start error:`, err);
    });
    return freshAgent;
  }

  public async removeAgent(meetingId: string): Promise<void> {
    const agent = this.agents.get(meetingId);
    if (agent) {
      await agent.stop();
      this.agents.delete(meetingId);
    }
  }
}

const globalForAgent = globalThis as unknown as {
  agentManager?: SpecPilotAgentManager;
};

export const agentManager = globalForAgent.agentManager ?? new SpecPilotAgentManager();
if (process.env.NODE_ENV !== 'production') {
  globalForAgent.agentManager = agentManager;
}
