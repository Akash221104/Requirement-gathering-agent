import type { ZodType } from 'zod';
import type { ILLMProvider, LLMGenerateOptions, LLMMessage, LLMProviderType } from './types';
import { cleanAndRepairJson } from './json-repair';

export class GroqProvider implements ILLMProvider {
  readonly providerType: LLMProviderType = 'groq';
  private apiKey: string | undefined;
  private defaultModel: string;
  private baseUrl: string;

  constructor(options?: { apiKey?: string; defaultModel?: string; baseUrl?: string }) {
    this.apiKey = options?.apiKey || process.env.GROQ_API_KEY;
    this.defaultModel = options?.defaultModel || 'llama-3.3-70b-versatile';
    this.baseUrl = options?.baseUrl || 'https://api.groq.com/openai/v1';
  }

  async generateText(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<string> {
    const key = this.apiKey || process.env.GROQ_API_KEY;
    if (!key) {
      throw new Error('GROQ_API_KEY is not configured in environment.');
    }

    const model = options?.model || this.defaultModel;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(options?.timeoutMs || 15000, 15000));

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 2048,
          response_format: options?.responseFormat,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Groq API returned HTTP ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Groq returned empty response content.');
      }
      return content.trim();
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateStructured<T>(
    messages: LLMMessage[],
    schema: ZodType<T>,
    options?: LLMGenerateOptions
  ): Promise<T> {
    const systemPromptAddition: LLMMessage = {
      role: 'system',
      content:
        'IMPORTANT: You must return valid JSON only. Do not include markdown code block backticks (like ```json). Respond with a raw JSON object conforming strictly to the requested schema.',
    };

    const combinedMessages = [systemPromptAddition, ...messages];

    const raw = await this.generateText(combinedMessages, {
      ...options,
      responseFormat: { type: 'json_object' },
    });

    const cleaned = cleanAndRepairJson(raw);

    try {
      const parsed = JSON.parse(cleaned);
      return schema.parse(parsed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'JSON validation failed';
      throw new Error(`Groq output failed Zod schema validation: ${msg}\nRaw: ${cleaned.substring(0, 200)}`);
    }
  }
}
