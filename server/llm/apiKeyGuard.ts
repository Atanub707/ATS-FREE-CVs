import { resolveApiKey } from './llmAdapter.js';
import { loadConfig } from '../config.js';

export type LlmErrorCode = 'no_api_key' | 'invalid_key' | 'llm_error';

export interface LlmErrorInfo {
  code: LlmErrorCode;
  status: number;
  message: string;
}

const NO_KEY_MESSAGE = 'No API token configured — add your API key in Settings. This process will not run.';
const INVALID_KEY_MESSAGE = 'Your API key appears to be expired or invalid — update it in Settings.';

// Pre-flight audit: is an LLM API token available at all?
export function hasApiKeyConfigured(): boolean {
  return !!resolveApiKey(loadConfig().llm.apiKey);
}

// Map a thrown LLM/provider error to a structured, user-facing response.
// Never a fallback result — always an explicit alert.
export function mapLlmError(err: any): LlmErrorInfo {
  if (err && err.code === 'NO_API_KEY') {
    return { code: 'no_api_key', status: 428, message: NO_KEY_MESSAGE };
  }

  const message: string = err?.message || String(err || 'Unknown LLM error');

  // Providers embed the HTTP status in their messages:
  // "OpenAI-compatible API error 401: ..." / "Anthropic API error 403: ..."
  // Gemini throws e.g. "400 INVALID_ARGUMENT: API key not valid. ..."
  const statusMatch = message.match(/\b(401|403)\b/);
  const mentionsKey = /api\s*key/i.test(message);
  if (statusMatch || (mentionsKey && /\b(400|401|403|invalid|expired|not valid)\b/i.test(message))) {
    return { code: 'invalid_key', status: 401, message: INVALID_KEY_MESSAGE };
  }

  return { code: 'llm_error', status: 502, message: `LLM service error: ${message}` };
}
