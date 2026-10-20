export * from './types';
export * from './groq-provider';
export * from './openrouter-provider';
export * from './fallback-provider';

import { FallbackLLMProvider } from './fallback-provider';
import type { ILLMProvider } from './types';

const globalForLLM = globalThis as unknown as {
  defaultLLMProvider?: ILLMProvider;
};

export const defaultLLMProvider =
  globalForLLM.defaultLLMProvider ?? new FallbackLLMProvider();

if (process.env.NODE_ENV !== 'production') {
  globalForLLM.defaultLLMProvider = defaultLLMProvider;
}
