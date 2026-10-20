import type { ZodType } from 'zod';

export type LLMProviderType = 'groq' | 'openrouter' | 'fallback';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  responseFormat?: { type: 'json_object' };
}

export interface ILLMProvider {
  readonly providerType: LLMProviderType;
  generateText(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<string>;
  generateStructured<T>(
    messages: LLMMessage[],
    schema: ZodType<T>,
    options?: LLMGenerateOptions
  ): Promise<T>;
}

