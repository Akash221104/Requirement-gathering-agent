import type { ZodType } from 'zod';
import type { ILLMProvider, LLMGenerateOptions, LLMMessage, LLMProviderType } from './types';
import { cleanAndRepairJson } from './json-repair';

export class OpenRouterProvider implements ILLMProvider {
  readonly providerType: LLMProviderType = 'openrouter';
  private apiKey: string | undefined;
  private defaultModel: string;
  private baseUrl: string;

  constructor(options?: { apiKey?: string; defaultModel?: string; baseUrl?: string }) {
    this.apiKey = options?.apiKey || process.env.OPENROUTER_API_KEY;
    this.defaultModel = options?.defaultModel || 'meta-llama/llama-3.3-70b-instruct';
    this.baseUrl = options?.baseUrl || 'https://openrouter.ai/api/v1';
  }

  async generateText(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<string> {
    const key = this.apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new Error('OPENROUTER_API_KEY is not configured in environment.');
    }

    const model = options?.model || this.defaultModel;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs || 60000);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://specpilot.ai',
          'X-Title': 'SpecPilot Requirement Engineering',
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
        throw new Error(`OpenRouter API returned HTTP ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenRouter returned empty response content.');
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
        'IMPORTANT: You must return valid JSON only. Do not wrap in markdown or backticks (no ```json). Respond exclusively with a valid JSON object matching the requested schema.',
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
      throw new Error(`OpenRouter output failed Zod schema validation: ${msg}\nRaw: ${cleaned.substring(0, 200)}`);
    }
  }
}
