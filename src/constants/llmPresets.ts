import { LlmProvider } from '../types';

// Per-provider LLM presets — the SINGLE source of truth for default base
// URLs, consumed by BOTH the Settings UI (auto-filled when the user picks a
// provider) and the server's LLM adapter (fallback when baseUrl is empty).
// Empty string = the provider's SDK does not need a base URL (Gemini,
// Anthropic use their official SDKs).
export const PROVIDER_BASE_URLS: Record<LlmProvider, string> = {
  'opencode-go': 'https://opencode.ai/zen/go/v1',
  'openrouter': 'https://openrouter.ai/api/v1',
  'openai': 'https://api.openai.com/v1',
  'gemini': '',
  'anthropic': '',
  'nvidia': 'https://integrate.api.nvidia.com/v1',
};
