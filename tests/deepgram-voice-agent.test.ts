import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DeepgramVoiceAgent } from '../lib/voice/deepgram-voice-agent';

describe('DeepgramVoiceAgent (Real-time Conversational Voice Layer)', () => {
  it('instantiates correctly for assisted and autonomous modes', () => {
    const assistedAgent = new DeepgramVoiceAgent({
      meetingId: 'meeting-test-1',
      mode: 'assisted',
      apiKey: 'test-api-key',
    });
    assert.ok(assistedAgent);

    const autonomousAgent = new DeepgramVoiceAgent({
      meetingId: 'meeting-test-2',
      mode: 'autonomous',
      apiKey: 'test-api-key',
    });
    assert.ok(autonomousAgent);
  });

  it('rejects connection when API key is missing', async () => {
    const origKey = process.env.DEEPGRAM_API_KEY;
    delete process.env.DEEPGRAM_API_KEY;
    try {
      const agent = new DeepgramVoiceAgent({
        meetingId: 'meeting-test-3',
        apiKey: '',
      });
      await assert.rejects(
        async () => {
          await agent.connect();
        },
        {
          message: /DEEPGRAM_API_KEY is not configured/,
        }
      );
    } finally {
      if (origKey) process.env.DEEPGRAM_API_KEY = origKey;
    }
  });

  it('safely buffers or drops audio before connection without throwing', () => {
    const agent = new DeepgramVoiceAgent({
      meetingId: 'meeting-test-4',
      apiKey: 'test-api-key',
    });
    const pcmChunk = Buffer.alloc(640); // 20ms of 16kHz audio
    assert.doesNotThrow(() => {
      agent.sendAudio(pcmChunk);
    });
  });

  it('verifies real live connection and settings handshake if DEEPGRAM_API_KEY is present', async () => {
    const apiKey = process.env.DEEPGRAM_API_KEY || 'e4f5da6d50d8cf927b15146b8b0233a75c190680';
    if (!apiKey) return;

    let settingsApplied = false;
    const agent = new DeepgramVoiceAgent({
      meetingId: 'meeting-integration-test',
      mode: 'assisted',
      apiKey,
      onUserStartedSpeaking: () => {},
      onConversationText: () => {},
    });

    try {
      await agent.connect();
      assert.ok(agent.isReady(), 'Agent should be ready after settings are applied');
      settingsApplied = true;
    } finally {
      agent.disconnect();
    }
    assert.equal(settingsApplied, true);
  });
});
