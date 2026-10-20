/**
 * DeepgramTTSProvider — Phase 4
 *
 * Calls Deepgram Aura REST TTS API to synthesize text into raw linear16 PCM audio.
 * This is a SERVER-SIDE only module. Never import from client components.
 *
 * Design notes:
 * - Uses Deepgram Aura model (aura-asteria-en by default).
 * - Returns raw PCM at 16 kHz mono for direct LiveKit audio frame publishing.
 * - DEEPGRAM_API_KEY is consumed from process.env; never passed to browsers.
 */

import type { ITTSProvider, TTSSynthesisOptions, TTSSynthesisResult } from './types';

export class DeepgramTTSProvider implements ITTSProvider {
  readonly providerName = 'DeepgramTTSProvider';

  private readonly apiKey: string | undefined;
  private readonly defaultVoice: string;

  constructor(options?: { apiKey?: string; voice?: string }) {
    this.apiKey = options?.apiKey || process.env.DEEPGRAM_API_KEY;
    this.defaultVoice = options?.voice || process.env.DEEPGRAM_VOICE || 'aura-2-asteria-en';
  }

  async synthesize(options: TTSSynthesisOptions): Promise<TTSSynthesisResult> {
    const apiKey = this.apiKey || process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY is not configured in environment.');
    }

    const voice = options.voice || this.defaultVoice;
    const sampleRate = options.sampleRate ?? 48000;
    // Deepgram Aura TTS REST endpoint (48kHz linear16 PCM matches WebRTC native Opus rate)
    const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voice)}&encoding=linear16&sample_rate=${sampleRate}&container=none`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: options.text }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Deepgram TTS returned HTTP ${response.status}: ${errorBody}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Estimate duration: linear16 at sampleRate Hz, mono (1 channel), 2 bytes per sample
    const bytesPerSample = 2;
    const channels = 1;
    const totalSamples = audioBuffer.byteLength / (bytesPerSample * channels);
    const durationMs = Math.round((totalSamples / sampleRate) * 1000);

    return {
      audioBuffer,
      durationMs,
      encoding: 'linear16',
      sampleRate,
    };
  }
}

// Global singleton (server-side process scope)
const globalForTTS = globalThis as unknown as {
  deepgramTTSProvider?: DeepgramTTSProvider;
};

export const deepgramTTSProvider: DeepgramTTSProvider =
  globalForTTS.deepgramTTSProvider ?? new DeepgramTTSProvider();

if (process.env.NODE_ENV !== 'production') {
  globalForTTS.deepgramTTSProvider = deepgramTTSProvider;
}
