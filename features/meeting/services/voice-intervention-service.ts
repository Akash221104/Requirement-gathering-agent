/**
 * Voice Intervention Service — Phase 4
 *
 * Orchestrates the full Phase 4 pipeline for a single SpecPilotAgent instance:
 *   InterventionDecisionEngine → DeepgramTTSProvider → LiveKit AudioSource publish
 *
 * Responsibilities:
 * 1. Accept intelligence state updates from Phase 3 ConversationChunker.
 * 2. Invoke the InterventionDecisionEngine to decide SILENT / SUGGEST / SPEAK.
 * 3. If SPEAK: synthesize speech via DeepgramTTSProvider and publish PCM frames
 *    to the existing LiveKit room as an audio track on the specpilot-ai participant.
 * 4. If SUGGEST: broadcast the suggestion text to the engineer UI via LiveKit data
 *    channel (topic: 'voice-suggestion').
 * 5. Enforce barge-in: if a human participant starts speaking while SpecPilot is
 *    generating/publishing audio, abort the current speech immediately.
 * 6. Prevent self-listening: the SpecPilotAgent MUST NOT process audio from its
 *    own published track. This is already enforced at the STT layer
 *    (identity !== 'specpilot-ai'), but this service records when SpecPilot is
 *    speaking so ConversationChunker / STT can gate it further if needed.
 *
 * Design constraints (ADR-028, ADR-029):
 * - Server-side only.
 * - Voice intervention can be toggled ON/OFF per meeting. Default: OFF.
 * - The LLM Requirement Intelligence (Phase 3) does NOT call TTS directly.
 * - Secrets (DEEPGRAM_API_KEY) never leave the server.
 */

import { Room, AudioSource, AudioFrame, LocalAudioTrack, TrackPublishOptions, TrackSource } from '@livekit/rtc-node';
import type { MeetingIntelligenceState } from '@/types/requirement';
import { InterventionDecisionEngine } from '@/lib/voice/intervention-decision-engine';
import type {
  InterventionContext,
  InterventionDecision,
  InterventionTranscriptTurn,
} from '@/lib/voice/intervention-decision-engine';
import { DeepgramTTSProvider } from '@/lib/tts/deepgram-tts-provider';

export interface VoiceSuggestion {
  meetingId: string;
  text: string;
  rationale: string;
  timestamp: string;
}

export class VoiceInterventionService {
  private readonly meetingId: string;
  private readonly meetingMode: 'assisted' | 'autonomous';

  // Voice intervention toggle — enabled by default in autonomous mode
  private voiceInterventionEnabled = false;

  // Speaking state — used for barge-in and self-listen prevention
  private isCurrentlySpeaking = false;
  private isActivelyStreamingAudio = false;
  private streamingStartedAt = 0;
  private currentSpeechAbortController: AbortController | null = null;
  private streamingPcmBuffer: Buffer = Buffer.alloc(0);
  private isProcessingStreamingQueue = false;

  // Track when the last human participant spoke
  private lastHumanSpeechAt: number = 0;
  // Track when SpecPilot last spoke
  private lastSpecPilotSpeechAt: number = 0;

  private readonly decisionEngine: InterventionDecisionEngine;
  private readonly ttsProvider: DeepgramTTSProvider;

  // Reference to the shared LiveKit Room (owned by SpecPilotAgent)
  private room: Room | null = null;
  private audioSource: AudioSource | null = null;
  private audioTrack: LocalAudioTrack | null = null;

  constructor(meetingId: string, meetingMode: 'assisted' | 'autonomous' = 'assisted') {
    this.meetingId = meetingId;
    this.meetingMode = meetingMode;
    // Autonomous mode default: voice is ON because SpecPilot leads the interview
    this.voiceInterventionEnabled = meetingMode === 'autonomous';
    this.decisionEngine = new InterventionDecisionEngine();
    this.ttsProvider = new DeepgramTTSProvider();
  }

  /**
   * Attach the LiveKit Room so this service can publish audio tracks.
   * Called by SpecPilotAgent after successfully joining the room.
   */
  public attachRoom(room: Room): void {
    this.room = room;
    // Pre-publish persistent audio track so remote browsers are connected and ready
    this.ensureAudioTrack().catch((err) => {
      console.warn('[VoiceInterventionService] Pre-publish audio track notice:', err);
    });
  }

  /**
   * Ensure the persistent audio track is published to LiveKit.
   * Reusing the track prevents SDP renegotiation delays and audio clipping.
   */
  public async ensureAudioTrack(): Promise<AudioSource | null> {
    if (!this.room || !this.room.localParticipant) return null;
    if (this.audioSource && this.audioTrack) {
      return this.audioSource;
    }

    try {
      // 48,000 Hz matches WebRTC's native Opus audio clock with zero resampling
      const sampleRate = 48000;
      // 30,000ms buffer capacity ensures the WebRTC native queue never overflows or underruns
      const audioSource = new AudioSource(sampleRate, 1, 30_000);
      const track = LocalAudioTrack.createAudioTrack('specpilot-voice', audioSource);

      const publishOptions = new TrackPublishOptions();
      publishOptions.source = TrackSource.SOURCE_MICROPHONE;

      await this.room.localParticipant.publishTrack(track, publishOptions);
      this.audioSource = audioSource;
      this.audioTrack = track;
      console.log(`[VoiceInterventionService] Published persistent audio track for meeting ${this.meetingId}`);
      return audioSource;
    } catch (err) {
      console.warn('[VoiceInterventionService] Failed to pre-publish audio track (will retry on speak):', err);
      return null;
    }
  }

  /**
   * Enable or disable voice intervention for this meeting.
   * Called when the Requirement Engineer toggles the voice switch.
   */
  public setVoiceInterventionEnabled(enabled: boolean): void {
    this.voiceInterventionEnabled = enabled;
    if (!enabled && this.isCurrentlySpeaking) {
      this.abortCurrentSpeech();
    }
    console.log(
      `[VoiceInterventionService] Voice intervention ${enabled ? 'ENABLED' : 'DISABLED'} for meeting ${this.meetingId}`
    );
  }

  public isEnabled(): boolean {
    return this.voiceInterventionEnabled;
  }

  public isSpeaking(): boolean {
    return this.isCurrentlySpeaking;
  }

  public getStreamingStartedAt(): number {
    return this.streamingStartedAt;
  }

  /**
   * Called by SpecPilotAgent when a human participant (CUSTOMER or REQUIREMENT_ENGINEER)
   * sends microphone audio frames.
   */
  public notifyHumanSpeaking(): void {
    this.lastHumanSpeechAt = Date.now();
    // Do NOT trigger abortCurrentSpeech here!
    // Every microphone stream continuously emits frames (even room noise/breathing/silence).
    // Aborting speech here causes severe audio stutter, buffering, and cutoffs.
    // Deepgram Voice Agent's native `onUserStartedSpeaking` already handles true barge-in with VAD.
  }

  /**
   * Evaluate intelligence state and potentially speak or suggest.
   * Called by SpecPilotAgent each time ConversationChunker delivers a new
   * MeetingIntelligenceState.
   *
   * Non-blocking: errors are logged and swallowed to protect the meeting.
   */
  public async handleIntelligenceUpdate(
    state: MeetingIntelligenceState,
    recentTranscript?: InterventionTranscriptTurn[]
  ): Promise<void> {
    if (!this.voiceInterventionEnabled) return;
    if (this.isCurrentlySpeaking) return;

    const secondsSinceLastSpeech = (Date.now() - this.lastSpecPilotSpeechAt) / 1000;
    const secondsSinceHumanSpeech = (Date.now() - this.lastHumanSpeechAt) / 1000;
    // If a human spoke within the last 1.5 seconds, wait to avoid cutting them off
    const humanRecentlySpeaking = secondsSinceHumanSpeech < 1.5;

    const ctx: InterventionContext = {
      intelligenceState: state,
      recentTranscript,
      voiceInterventionEnabled: this.voiceInterventionEnabled,
      isCurrentlySpeaking: this.isCurrentlySpeaking,
      humanSpeaking: humanRecentlySpeaking,
      secondsSinceLastSpeech,
      meetingMode: this.meetingMode,
    };

    let decision: InterventionDecision;
    try {
      decision = await this.decisionEngine.evaluate(ctx);
    } catch (err) {
      console.warn('[VoiceInterventionService] Decision engine error (meeting continues):', err);
      return;
    }

    console.log(
      `[VoiceInterventionService] Decision: ${decision.decision} (confidence: ${decision.confidence}) — ${decision.rationale}`
    );

    if (decision.decision === 'SPEAK' && decision.responseText) {
      await this.speak(decision.responseText, decision);
    } else if (decision.decision === 'SUGGEST' && decision.responseText) {
      await this.broadcastSuggestion(decision.responseText, decision.rationale);
    }
    // SILENT: do nothing
  }

  /**
   * Directly speak given text (used in autonomous meeting mode).
   */
  public async synthesizeAndSpeak(text: string): Promise<void> {
    return this.speak(text, {
      decision: 'SPEAK',
      confidence: 1,
      rationale: 'Direct autonomous speech',
      responseText: text,
    });
  }

  // ─── Private: Speech Publishing ───────────────────────────────────────────

  private async speak(text: string, decision: InterventionDecision): Promise<void> {
    if (!this.room || !this.room.localParticipant) {
      console.warn('[VoiceInterventionService] Cannot speak: room not attached.');
      return;
    }
    if (this.isCurrentlySpeaking) return;

    console.log(`[VoiceInterventionService] Speaking (conf: ${decision.confidence}): "${text.slice(0, 60)}..."`);

    this.isCurrentlySpeaking = true;
    this.isActivelyStreamingAudio = false;
    this.currentSpeechAbortController = new AbortController();
    const { signal } = this.currentSpeechAbortController;

    // Broadcast speaking status to UI
    await this.broadcastSpeakingStatus(true, text);

    try {
      // Synthesize TTS at studio-quality 48kHz matching WebRTC
      const ttsResult = await this.ttsProvider.synthesize({
        text,
        sampleRate: 48000,
        encoding: 'linear16',
      });

      if (signal.aborted) {
        console.log('[VoiceInterventionService] Speech aborted after TTS synthesis (barge-in).');
        return;
      }

      // Mark audio streaming active
      this.isActivelyStreamingAudio = true;
      this.streamingStartedAt = Date.now();

      // Publish audio to LiveKit
      await this.publishAudioBuffer(ttsResult.audioBuffer, ttsResult.sampleRate, signal);

      this.lastSpecPilotSpeechAt = Date.now();
    } catch (err) {
      if (!signal.aborted) {
        console.warn('[VoiceInterventionService] TTS/publish error (meeting continues):', err);
      }
    } finally {
      this.isCurrentlySpeaking = false;
      this.isActivelyStreamingAudio = false;
      this.currentSpeechAbortController = null;
      await this.broadcastSpeakingStatus(false, '');
      // Keep persistent audio track alive so next speech requires 0ms renegotiation
    }
  }

  private async publishAudioBuffer(
    pcmBuffer: Buffer,
    sampleRate: number,
    signal: AbortSignal
  ): Promise<void> {
    const audioSource = await this.ensureAudioTrack();
    if (!audioSource) {
      console.warn('[VoiceInterventionService] AudioSource unavailable, cannot publish audio');
      return;
    }

    // 20ms chunks (standard WebRTC audio frame duration)
    // At 16kHz mono (1 channel), 20ms is: 16000 * 0.020 = 320 samples (640 bytes)
    const FRAME_MS = 20;
    const SAMPLES_PER_FRAME = Math.floor((sampleRate * FRAME_MS) / 1000); // 320 samples

    const totalSamples = Math.floor(pcmBuffer.length / 2);
    let sampleOffset = 0;

    console.log(
      `[VoiceInterventionService] Streaming ${totalSamples} samples (${pcmBuffer.length} bytes, ~${Math.round(
        (totalSamples / sampleRate) * 1000
      )}ms) to AudioSource`
    );

    while (sampleOffset < totalSamples && !signal.aborted) {
      // Only throttle if internal native queue exceeds 10,000ms buffered ahead
      while (audioSource.queuedDuration > 10_000 && !signal.aborted) {
        await this.sleep(50, signal);
      }
      if (signal.aborted) break;

      const samplesInChunk = Math.min(SAMPLES_PER_FRAME, totalSamples - sampleOffset);
      // Create dedicated AudioFrame with its own Int16Array memory buffer
      const frame = AudioFrame.create(sampleRate, 1, SAMPLES_PER_FRAME);
      for (let i = 0; i < samplesInChunk; i++) {
        frame.data[i] = pcmBuffer.readInt16LE((sampleOffset + i) * 2);
      }
      for (let i = samplesInChunk; i < SAMPLES_PER_FRAME; i++) {
        frame.data[i] = 0;
      }
      sampleOffset += samplesInChunk;

      await audioSource.captureFrame(frame);
    }

    if (!signal.aborted) {
      console.log('[VoiceInterventionService] Waiting for playout drain...');
      await audioSource.waitForPlayout();
      console.log('[VoiceInterventionService] Playout complete');
    }
  }

  private async unpublishAudioTrack(): Promise<void> {
    try {
      if (this.audioTrack?.sid && this.room?.localParticipant) {
        await this.room.localParticipant.unpublishTrack(this.audioTrack.sid);
      }
    } catch {
      // Non-blocking
    } finally {
      this.audioTrack = null;
      this.audioSource = null;
    }
  }

  /**
   * Queue and stream a 48kHz PCM audio chunk directly to LiveKit AudioSource.
   * Called by DeepgramVoiceAgent in real time.
   *
   * Audio Clarity Fix:
   * Deepgram streams chunks in varying sizes (e.g. 960 bytes = 480 samples).
   * We accumulate the bytes continuously and slice out exact 20ms frames (960 samples @ 48kHz).
   * This completely eliminates zero-padding in the middle of utterances, removing the
   * stuttering/buzzing/robotic distortion and delivering smooth, crystal-clear speech.
   */
  public queueStreamingChunk(pcmChunk: Buffer): void {
    if (!this.isCurrentlySpeaking) {
      this.isCurrentlySpeaking = true;
      this.isActivelyStreamingAudio = true;
      this.streamingStartedAt = Date.now();
      this.broadcastSpeakingStatus(true, '').catch(() => {});
    }

    // Append new chunk to accumulator
    this.streamingPcmBuffer = Buffer.concat([this.streamingPcmBuffer, pcmChunk]);
    this.drainStreamingBuffer().catch((err) => {
      console.warn('[VoiceInterventionService] Streaming drain error:', err);
    });
  }

  /**
   * Dedicated sequential worker: slices exact 20ms frames and captures them one-by-one.
   * Eliminates concurrent slicing and out-of-order frame delivery.
   */
  private async drainStreamingBuffer(): Promise<void> {
    if (this.isProcessingStreamingQueue) return;
    this.isProcessingStreamingQueue = true;

    try {
      const audioSource = await this.ensureAudioTrack();
      if (!audioSource) return;

      const sampleRate = 48000;
      const FRAME_MS = 20;
      const SAMPLES_PER_FRAME = Math.floor((sampleRate * FRAME_MS) / 1000); // 960 samples
      const BYTES_PER_FRAME = SAMPLES_PER_FRAME * 2; // 1920 bytes (16-bit LE mono)

      while (this.streamingPcmBuffer.length >= BYTES_PER_FRAME) {
        if (!this.isActivelyStreamingAudio) break;

        // If the native WebRTC buffer is over 10 seconds ahead, yield briefly to avoid memory blowup
        if (audioSource.queuedDuration > 10_000) {
          await this.sleep(30);
          if (!this.isActivelyStreamingAudio) break;
        }

        const frameBuf = this.streamingPcmBuffer.subarray(0, BYTES_PER_FRAME);
        this.streamingPcmBuffer = this.streamingPcmBuffer.subarray(BYTES_PER_FRAME);

        const frame = AudioFrame.create(sampleRate, 1, SAMPLES_PER_FRAME);
        for (let i = 0; i < SAMPLES_PER_FRAME; i++) {
          frame.data[i] = frameBuf.readInt16LE(i * 2);
        }

        await audioSource.captureFrame(frame);
      }
    } finally {
      this.isProcessingStreamingQueue = false;
      // If more chunks arrived during async captureFrame, trigger next drain cycle
      const sampleRate = 48000;
      const FRAME_MS = 20;
      const SAMPLES_PER_FRAME = Math.floor((sampleRate * FRAME_MS) / 1000);
      const BYTES_PER_FRAME = SAMPLES_PER_FRAME * 2;
      if (this.streamingPcmBuffer.length >= BYTES_PER_FRAME && this.isActivelyStreamingAudio) {
        this.drainStreamingBuffer().catch(() => {});
      }
    }
  }

  /**
   * Called when Deepgram Voice Agent finishes streaming audio for the current turn.
   */
  public async onVoiceAgentAudioDone(): Promise<void> {
    if (!this.isCurrentlySpeaking) return;
    try {
      // Allow any in-flight buffer frames to finish draining
      while (this.isProcessingStreamingQueue) {
        await this.sleep(10);
      }

      if (this.audioSource) {
        // Flush any trailing samples remaining in the buffer
        if (this.streamingPcmBuffer.length > 0) {
          const sampleRate = 48000;
          const FRAME_MS = 20;
          const SAMPLES_PER_FRAME = Math.floor((sampleRate * FRAME_MS) / 1000);
          const remainingSamples = Math.floor(this.streamingPcmBuffer.length / 2);
          if (remainingSamples > 0) {
            const frame = AudioFrame.create(sampleRate, 1, SAMPLES_PER_FRAME);
            for (let i = 0; i < remainingSamples; i++) {
              frame.data[i] = this.streamingPcmBuffer.readInt16LE(i * 2);
            }
            for (let i = remainingSamples; i < SAMPLES_PER_FRAME; i++) {
              frame.data[i] = 0;
            }
            this.streamingPcmBuffer = Buffer.alloc(0);
            await this.audioSource.captureFrame(frame);
          }
        }

        // Wait for WebRTC audio pipeline to finish playing the buffered frames
        await this.audioSource.waitForPlayout();
      }
    } catch {
      // Non-blocking
    } finally {
      this.isCurrentlySpeaking = false;
      this.isActivelyStreamingAudio = false;
      this.streamingPcmBuffer = Buffer.alloc(0);
      this.lastSpecPilotSpeechAt = Date.now();
      await this.broadcastSpeakingStatus(false, '');
    }
  }

  public abortCurrentSpeech(force: boolean = false): void {
    // Acoustic Echo Protection:
    // If SpecPilot started speaking within the last 2000ms, do not abort unless forced.
    // When the customer is using laptop speakers without headphones, the AI's own voice
    // leaks back into the customer's microphone. Without this window, the echo immediately
    // kills the AI's audio, causing severe stutter and total audio dropout.
    if (!force && this.isCurrentlySpeaking && Date.now() - this.streamingStartedAt < 2000) {
      console.log('[VoiceInterventionService] Echo immunity active (< 2000ms) — ignoring abort');
      return;
    }

    if (this.currentSpeechAbortController) {
      this.currentSpeechAbortController.abort();
    }
    this.streamingPcmBuffer = Buffer.alloc(0);
    this.isActivelyStreamingAudio = false;

    // Only wipe native playout queue if force is explicitly true (e.g. room disconnect / user mute).
    // During conversational barge-in, let the currently playing short frame finish naturally
    // rather than abruptly clearing the buffer mid-audio-packet which causes audio clicks & stutter.
    if (force && this.audioSource) {
      try {
        this.audioSource.clearQueue();
      } catch {
        // Non-blocking
      }
    }

    this.isCurrentlySpeaking = false;
    this.broadcastSpeakingStatus(false, '').catch(() => {});
  }

  // ─── Data Channel Broadcasts ───────────────────────────────────────────

  public async broadcastSpeakingStatus(isSpeaking: boolean, text: string): Promise<void> {
    if (!this.room?.localParticipant) return;
    try {
      const payload = Buffer.from(
        JSON.stringify({
          meetingId: this.meetingId,
          isSpeaking,
          text,
          timestamp: new Date().toISOString(),
        })
      );
      await this.room.localParticipant.publishData(payload, {
        reliable: true,
        topic: 'specpilot-speaking',
      });
    } catch {
      // Non-blocking
    }
  }

  private async broadcastSuggestion(text: string, rationale: string): Promise<void> {
    if (!this.room?.localParticipant) return;
    try {
      const suggestion: VoiceSuggestion = {
        meetingId: this.meetingId,
        text,
        rationale,
        timestamp: new Date().toISOString(),
      };
      const payload = Buffer.from(JSON.stringify(suggestion));
      await this.room.localParticipant.publishData(payload, {
        reliable: true,
        topic: 'voice-suggestion',
      });
    } catch {
      // Non-blocking
    }
  }

  // ─── Utility ─────────────────────────────────────────────────────────────

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  }

  public cleanup(): void {
    this.abortCurrentSpeech();
    this.isCurrentlySpeaking = false;
    this.unpublishAudioTrack().catch(() => {});
  }
}
