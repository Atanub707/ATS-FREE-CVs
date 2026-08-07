import { loadConfig } from '../config.js';
import { askOpenAi } from './providers/openaiProvider.js';
import { askGemini } from './providers/geminiProvider.js';
import { askAnthropic } from './providers/anthropicProvider.js';

const PROVIDER_BASE_URLS: Record<string, string> = {
  'opencode-go': 'https://opencode.ai/zen/go/v1',
  'openrouter': 'https://openrouter.ai/api/v1',
  'openai': 'https://api.openai.com/v1',
  'gemini': '',
  'anthropic': '',
  'nvidia': 'https://integrate.api.nvidia.com/v1',
};

function resolveApiKey(configuredKey: string): string | undefined {
  if (configuredKey) return configuredKey;
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  return undefined;
}

export { resolveApiKey };

export async function ask(prompt: string, temperature?: number): Promise<string> {
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
      return await askOpenAi({ baseUrl, apiKey, model, prompt, temperature: temp });
    }
    case 'gemini':
      return await askGemini(apiKey, model, prompt, temp);
    case 'anthropic':
      return await askAnthropic(apiKey, model, prompt, temp);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
