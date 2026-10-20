/**
 * Deepgram Voice Agent Client — Phase 5 / Voice Engine
 *
 * Implements a real-time conversational voice layer using official Deepgram Voice Agent API:
 * - Low-latency WebSocket connection to `wss://agent.deepgram.com/v1/agent/converse`
 * - Unified real-time STT, turn detection, conversational reasoning, and streaming TTS
 * - Sub-second response latency (~300-800ms)
 * - Native barge-in: interrupts speech when user speaks (`UserStartedSpeaking`)
 * - Emits `ConversationText` for asynchronous Requirement Intelligence chunking
 * - Streams 48kHz linear16 PCM audio directly to LiveKit AudioSource
 */

import WebSocket from 'ws';

export interface DeepgramVoiceAgentOptions {
  meetingId: string;
  projectId?: string;
  mode?: 'assisted' | 'autonomous';
  apiKey?: string;
  voice?: string;
  systemPrompt?: string;
  onUserStartedSpeaking?: () => void;
  onConversationText?: (role: 'user' | 'assistant', text: string) => void;
  onAudioChunk?: (pcmBuffer: Buffer) => void;
  onAgentStartedSpeaking?: () => void;
  onAgentAudioDone?: () => void;
  onError?: (err: Error) => void;
  onClose?: (code: number, reason: string) => void;
}

export class DeepgramVoiceAgent {
  private readonly meetingId: string;
  private readonly projectId: string;
  private readonly mode: 'assisted' | 'autonomous';
  private readonly apiKey: string;
  private readonly voice: string;
  private systemPrompt: string;

  private ws: WebSocket | null = null;
  private isConnected = false;
  private isSettingsApplied = false;
  private isClosing = false;
  private pendingAudioQueue: Buffer[] = [];

  private readonly callbacks: DeepgramVoiceAgentOptions;

  constructor(options: DeepgramVoiceAgentOptions) {
    this.meetingId = options.meetingId;
    this.projectId = options.projectId || 'project-001';
    this.mode = options.mode || 'assisted';
    this.apiKey = options.apiKey || process.env.DEEPGRAM_API_KEY || '';
    this.voice = options.voice || process.env.DEEPGRAM_VOICE || 'aura-2-asteria-en';
    this.callbacks = options;

    this.systemPrompt =
      options.systemPrompt ||
      (this.mode === 'autonomous'
        ? `You are SpecPilot, an Agentic AI Requirement Engineering Co-Pilot leading a requirement elicitation session. ` +
          `Your goal is to gather complete, unambiguous requirements from the customer. ` +
          `Guide the customer through feature requirements, user roles, business rules, edge cases, and constraints. ` +
          `Keep your spoken responses natural, professional, and concise (1 to 2 sentences max). ` +
          `Ask one clear, focused question at a time to prevent overwhelming the user.`
        : `You are SpecPilot, an Agentic AI Requirement Engineering Co-Pilot assisting a human Requirement Engineer and Customer. ` +
          `Listen attentively. When addressed or asked for input, provide crisp, high-value requirement engineering insights. ` +
          `Keep your spoken responses clear, professional, and concise (1 to 2 sentences max).`);
  }

  /**
   * Connect to Deepgram Voice Agent WebSocket endpoint
   */
  public async connect(): Promise<void> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (!this.apiKey) {
      throw new Error('[DeepgramVoiceAgent] DEEPGRAM_API_KEY is not configured');
    }

    this.isClosing = false;

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = 'wss://agent.deepgram.com/v1/agent/converse';
        console.log(`[DeepgramVoiceAgent] Connecting to ${wsUrl} for meeting ${this.meetingId}...`);

        this.ws = new WebSocket(wsUrl, {
          headers: {
            Authorization: `Token ${this.apiKey}`,
          },
        });

        this.ws.on('open', () => {
          console.log(`[DeepgramVoiceAgent] WebSocket open for meeting ${this.meetingId}`);
          this.isConnected = true;
          // Connection resolves once SettingsApplied is confirmed, or on open
        });

        this.ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
          if (isBinary) {
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
            this.callbacks.onAudioChunk?.(buf);
          } else {
            this.handleJsonMessage(data.toString(), resolve);
          }
        });

        this.ws.on('error', (err: Error) => {
          console.error(`[DeepgramVoiceAgent] WebSocket error:`, err.message);
          this.callbacks.onError?.(err);
          if (!this.isConnected) {
            reject(err);
          }
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          console.log(`[DeepgramVoiceAgent] WebSocket closed (${code}): ${reason.toString()}`);
          this.isConnected = false;
          this.isSettingsApplied = false;
          this.callbacks.onClose?.(code, reason.toString());
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleJsonMessage(rawJson: string, onReady?: () => void): void {
    try {
      const msg = JSON.parse(rawJson);
      switch (msg.type) {
        case 'Welcome':
          console.log(`[DeepgramVoiceAgent] Welcome received, applying settings...`);
          this.sendSettings();
          break;

        case 'SettingsApplied':
          console.log(`[DeepgramVoiceAgent] Settings applied successfully`);
          this.isSettingsApplied = true;
          // Flush any pending microphone audio queued during handshake
          while (this.pendingAudioQueue.length > 0) {
            const chunk = this.pendingAudioQueue.shift();
            if (chunk) this.sendAudio(chunk);
          }
          if (onReady) onReady();
          break;

        case 'UserStartedSpeaking':
          console.log(`[DeepgramVoiceAgent] UserStartedSpeaking (barge-in trigger)`);
          this.callbacks.onUserStartedSpeaking?.();
          break;

        case 'ConversationText':
          if (msg.role && msg.content) {
            console.log(`[DeepgramVoiceAgent] ConversationText [${msg.role}]: "${msg.content.slice(0, 60)}..."`);
            this.callbacks.onConversationText?.(
              msg.role === 'assistant' ? 'assistant' : 'user',
              msg.content
            );
          }
          break;

        case 'AgentStartedSpeaking':
          console.log(`[DeepgramVoiceAgent] AgentStartedSpeaking`);
          this.callbacks.onAgentStartedSpeaking?.();
          break;

        case 'AgentAudioDone':
          console.log(`[DeepgramVoiceAgent] AgentAudioDone`);
          this.callbacks.onAgentAudioDone?.();
          break;

        case 'Warning':
          console.warn(`[DeepgramVoiceAgent] Warning:`, msg.description || msg.message);
          break;

        case 'Error':
          console.error(`[DeepgramVoiceAgent] Error message:`, msg.description || msg.message);
          this.callbacks.onError?.(new Error(msg.description || msg.message || 'Deepgram Voice Agent Error'));
          break;

        default:
          // Informational message (e.g. History, LatencyReport)
          break;
      }
    } catch (e) {
      console.warn(`[DeepgramVoiceAgent] Failed to parse message JSON:`, e);
    }
  }

  private sendSettings(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const settingsPayload = {
      type: 'Settings',
      audio: {
        input: {
          encoding: 'linear16',
          sample_rate: 16000,
        },
        output: {
          encoding: 'linear16',
          sample_rate: 48000,
          container: 'none',
        },
      },
      agent: {
        listen: {
          provider: {
            type: 'deepgram',
            model: 'nova-3',
          },
        },
        think: {
          provider: {
            type: 'open_ai',
            model: 'gpt-4o-mini',
          },
          prompt: this.systemPrompt,
        },
        speak: {
          provider: {
            type: 'deepgram',
            model: this.voice,
          },
        },
      },
    };

    this.ws.send(JSON.stringify(settingsPayload));
  }

  /**
   * Send microphone PCM audio (16kHz linear16 mono) into the Voice Agent
   */
  public sendAudio(chunk: Buffer | Uint8Array | Int16Array): void {
    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSettingsApplied) {
      if (!this.isClosing && this.pendingAudioQueue.length < 50) {
        this.pendingAudioQueue.push(buf);
      }
      return;
    }

    try {
      this.ws.send(buf);
    } catch (err) {
      console.warn(`[DeepgramVoiceAgent] Error sending audio chunk:`, err);
    }
  }

  /**
   * Inject a user prompt/message into the voice conversation
   */
  public injectUserMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: 'InjectUserMessage',
        content: text,
      })
    );
  }

  /**
   * Inject an agent speech/message to speak immediately
   */
  public injectAgentMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: 'InjectAgentMessage',
        content: text,
      })
    );
  }

  /**
   * Update system prompt on the fly (e.g. when agenda topic advances)
   */
  public updatePrompt(newPrompt: string): void {
    this.systemPrompt = newPrompt;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSettingsApplied) return;
    this.ws.send(
      JSON.stringify({
        type: 'UpdatePrompt',
        prompt: newPrompt,
      })
    );
  }

  public isReady(): boolean {
    return this.isConnected && this.isSettingsApplied;
  }

  public disconnect(): void {
    this.isClosing = true;
    this.pendingAudioQueue = [];
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close(1000, 'Meeting ended');
        }
      } catch {
        // Safe close
      }
      this.ws = null;
    }
    this.isConnected = false;
    this.isSettingsApplied = false;
  }
}
