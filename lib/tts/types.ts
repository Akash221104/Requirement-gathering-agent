/**
 * TTS Provider abstraction for SpecPilot Phase 4.
 *
 * Design constraints (ADR-027):
 * - Server-side only. No browser bundles or client-side access.
 * - PCM audio is returned as a Buffer so the caller can publish it to LiveKit.
 * - The interface is provider-agnostic; Deepgram is the initial implementation.
 */

export type TTSEncoding = 'linear16' | 'mp3' | 'opus';

export interface TTSSynthesisOptions {
  /** Text to convert to speech. */
  text: string;
  /** Voice/model identifier (provider-specific). */
  voice?: string;
  /** Target sample rate in Hz. Defaults to 16000 (linear16). */
  sampleRate?: number;
  /** Output encoding. Defaults to 'linear16' (raw PCM). */
  encoding?: TTSEncoding;
}

export interface TTSSynthesisResult {
  /** Raw audio bytes (PCM linear16 by default). */
  audioBuffer: Buffer;
  /** Duration estimate in milliseconds (may be 0 if provider does not expose it). */
  durationMs: number;
  /** Actual encoding returned by the provider. */
  encoding: TTSEncoding;
  /** Sample rate of the returned audio. */
  sampleRate: number;
}

export interface ITTSProvider {
  readonly providerName: string;

  /**
   * Synthesize text into audio.
   * Must be called server-side only.
   * Never expose the provider or this call path to browser bundles.
   */
  synthesize(options: TTSSynthesisOptions): Promise<TTSSynthesisResult>;
}
