import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DeepgramTTSProvider } from '../lib/tts/deepgram-tts-provider';

describe('DeepgramTTSProvider (Phase 4)', () => {
  it('instantiates with custom voice and provider name', () => {
    const provider = new DeepgramTTSProvider({
      apiKey: 'test-key',
      voice: 'aura-asteria-en',
    });
    assert.equal(provider.providerName, 'DeepgramTTSProvider');
  });

  it('fails gracefully when no API key is provided and synthesizes speech', async () => {
    const origKey = process.env.DEEPGRAM_API_KEY;
    delete process.env.DEEPGRAM_API_KEY;
    try {
      const provider = new DeepgramTTSProvider({ apiKey: '' });
      await assert.rejects(
        async () => {
          await provider.synthesize({ text: 'Hello world' });
        },
        {
          message: /DEEPGRAM_API_KEY is not configured/,
        }
      );
    } finally {
      if (origKey) process.env.DEEPGRAM_API_KEY = origKey;
    }
  });

  it('returns valid PCM buffer on mock fetch response', async () => {
    const originalFetch = globalThis.fetch;
    try {
      // Mock 100ms of 16kHz 16-bit mono PCM (3200 bytes)
      const mockPcm = Buffer.alloc(3200, 0x12);
      globalThis.fetch = async () => {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => mockPcm.buffer.slice(mockPcm.byteOffset, mockPcm.byteOffset + mockPcm.byteLength),
        } as unknown as Response;
      };

      const provider = new DeepgramTTSProvider({ apiKey: 'mock-key' });
      const result = await provider.synthesize({ text: 'Test speech', sampleRate: 16000 });
      assert.equal(result.audioBuffer.length, 3200);
      assert.equal(result.sampleRate, 16000);
      assert.equal(result.encoding, 'linear16');
      assert.equal(result.durationMs, 100);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
