import { loadConfig } from '../config.js';
import { askOpenAi } from './providers/openaiProvider.js';
import { askGemini } from './providers/geminiProvider.js';
import { askAnthropic } from './providers/anthropicProvider.js';
import { PROVIDER_BASE_URLS } from '../../src/constants/llmPresets.js';

function resolveApiKey(configuredKey: string): string | undefined {
  if (configuredKey) return configuredKey;
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  return undefined;
}

export { resolveApiKey };

export async function ask(prompt: string, temperature?: number, responseFormat: 'json' | 'text' = 'json'): Promise<string> {
  const config = loadConfig();
  const temp = temperature ?? config.llm.temperature ?? 0.2;
  const provider = config.llm.provider || 'gemini';
  const apiKey = resolveApiKey(config.llm.apiKey);
  const model = config.llm.model || 'gemini-3.6-flash';

  if (!apiKey) {
    const err = new Error('No API key configured. Set one in Settings or via GEMINI_API_KEY env var.');
    (err as any).code = 'NO_API_KEY';
    throw err;
  }

  switch (provider) {
    case 'opencode-go':
    case 'openrouter':
    case 'openai': {
      const baseUrl = config.llm.baseUrl || PROVIDER_BASE_URLS[provider];
      return await askOpenAi({ baseUrl, apiKey, model, prompt, temperature: temp, responseFormat });
    }
    case 'gemini':
      return await askGemini(apiKey, model, prompt, temp);
    case 'anthropic':
      return await askAnthropic(apiKey, model, prompt, temp);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
