import WebSocket from 'ws';
import type { ISTTProvider, STTCallbacks } from './stt-provider';

export interface DeepgramSTTOptions {
  apiKey?: string;
  sampleRate?: number;
  channels?: number;
  model?: string;
  speakerId: string;
  speakerName: string;
  speakerRole: 'CUSTOMER' | 'REQUIREMENT_ENGINEER' | 'SPEC_PILOT' | 'UNKNOWN';
}

export class DeepgramSTTProvider implements ISTTProvider {
  readonly providerName = 'DeepgramSTTProvider';

  private ws: WebSocket | null = null;
  private isConnected = false;
  private callbacks: STTCallbacks | null = null;
  private readonly options: DeepgramSTTOptions;

  constructor(options: DeepgramSTTOptions) {
    this.options = {
      sampleRate: 16000,
      channels: 1,
      model: 'nova-2',
      ...options,
    };
  }

  async start(callbacks: STTCallbacks): Promise<void> {
    this.callbacks = callbacks;
    const apiKey = this.options.apiKey || process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      const err = new Error('DEEPGRAM_API_KEY is not configured in environment.');
      callbacks.onError?.(err);
      throw err;
    }

    const params = new URLSearchParams({
      model: this.options.model || 'nova-2',
      language: 'en',
      smart_format: 'true',
      interim_results: 'true',
      punctuate: 'true',
      encoding: 'linear16',
      sample_rate: String(this.options.sampleRate || 16000),
      channels: String(this.options.channels || 1),
    });

    const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url, {
          headers: {
            Authorization: `Token ${apiKey}`,
          },
        });

        this.ws.on('open', () => {
          this.isConnected = true;
          resolve();
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
          try {
            const raw = data.toString();
            const res = JSON.parse(raw);

            const channel = res.channel;
            const alternative = channel?.alternatives?.[0];
            const transcript = alternative?.transcript;

            if (transcript && transcript.trim().length > 0) {
              const isFinal = Boolean(res.is_final);

              this.callbacks?.onTranscript({
                text: transcript.trim(),
                isFinal,
                speakerId: this.options.speakerId,
                speakerName: this.options.speakerName,
                speakerRole: this.options.speakerRole,
                timestamp: new Date().toISOString(),
              });
            }
          } catch {
            // Ignore non-json or control frames
          }
        });

        this.ws.on('error', (err: Error) => {
          this.callbacks?.onError?.(err);
          if (!this.isConnected) {
            reject(err);
          }
        });

        this.ws.on('close', () => {
          this.isConnected = false;
          this.callbacks?.onClose?.();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  sendAudio(chunk: Buffer | Uint8Array | Int16Array): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      if (chunk instanceof Int16Array) {
        const buf = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        this.ws.send(buf);
      } else if (chunk instanceof Uint8Array) {
        const buf = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        this.ws.send(buf);
      } else {
        this.ws.send(chunk);
      }
    } catch {
      // Audio send dropped safely without throwing
    }
  }

  async stop(): Promise<void> {
    this.isConnected = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        // Send Deepgram close stream frame
        this.ws.send(JSON.stringify({ type: 'CloseStream' }));
        this.ws.close();
      } catch {
        // Fallback
      }
    }
    this.ws = null;
  }
}
