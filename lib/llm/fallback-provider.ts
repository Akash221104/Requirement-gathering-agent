import type { ZodType } from 'zod';
import type { ILLMProvider, LLMGenerateOptions, LLMMessage, LLMProviderType } from './types';
import { GroqProvider } from './groq-provider';
import { OpenRouterProvider } from './openrouter-provider';

export class FallbackLLMProvider implements ILLMProvider {
  readonly providerType: LLMProviderType = 'fallback';
  private primary: ILLMProvider;
  private fallback: ILLMProvider;
  private primaryDisabled = false;

  constructor(primary?: ILLMProvider, fallback?: ILLMProvider) {
    this.primary = primary ?? new GroqProvider();
    this.fallback = fallback ?? new OpenRouterProvider();
  }

  async generateText(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<string> {
    if (this.primaryDisabled) {
      return await this.fallback.generateText(messages, options);
    }
    try {
      return await this.primary.generateText(messages, options);
    } catch (primaryErr: unknown) {
      const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      if (msg.includes('401') || msg.includes('404') || msg.includes('invalid_api_key') || msg.includes('model_not_found')) {
        this.primaryDisabled = true;
      }
      console.warn(`[FallbackLLMProvider] Primary (${this.primary.providerType}) failed: ${msg}. Trying fallback (${this.fallback.providerType})...`);
      return await this.fallback.generateText(messages, options);
    }
  }

  async generateStructured<T>(
    messages: LLMMessage[],
    schema: ZodType<T>,
    options?: LLMGenerateOptions
  ): Promise<T> {
    if (this.primaryDisabled) {
      return await this.fallback.generateStructured(messages, schema, options);
    }
    try {
      return await this.primary.generateStructured(messages, schema, options);
    } catch (primaryErr: unknown) {
      const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      if (msg.includes('401') || msg.includes('404') || msg.includes('invalid_api_key') || msg.includes('model_not_found')) {
        this.primaryDisabled = true;
      }
      console.warn(`[FallbackLLMProvider] Primary (${this.primary.providerType}) failed: ${msg}. Trying fallback (${this.fallback.providerType})...`);
      return await this.fallback.generateStructured(messages, schema, options);
    }
  }
}
