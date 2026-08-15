import { ToolDef } from '../mcp/registry.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface NormalizedAskResult {
  reply?: string;
  toolCalls?: { name: string; args: any }[];
}

/**
 * Provider-agnostic tool-use loop. `askFn` is the provider-specific wrapper
 * that turns (messages, tools) into either a final reply or tool calls.
 * Rounds are capped so a misbehaving model can never loop forever.
 */
export function buildToolLoop(
  askFn: (messages: ChatMessage[], tools: ToolDef[]) => Promise<NormalizedAskResult>
) {
  return async (params: {
    messages: ChatMessage[];
    tools: ToolDef[];
    toolExecutor: (name: string, args: any) => Promise<any>;
    maxRounds?: number;
  }): Promise<{ reply: string; toolCalls: { name: string; args: any }[] }> => {
    const max = params.maxRounds || 5;
    const history: ChatMessage[] = [...params.messages];
    const toolCalls: { name: string; args: any }[] = [];
    for (let round = 0; round < max; round++) {
      const res = await askFn(history, params.tools);
      if (res.reply) return { reply: res.reply, toolCalls };
      if (!res.toolCalls?.length) return { reply: '', toolCalls };
      const results: string[] = [];
      for (const tc of res.toolCalls) {
        toolCalls.push(tc);
        try {
          const out = await params.toolExecutor(tc.name, tc.args || {});
          results.push(`[${tc.name} result] ${JSON.stringify(out)}`);
        } catch (e: any) {
          results.push(`[${tc.name} error] ${e?.message || 'tool failed'}`);
        }
      }
      history.push({ role: 'assistant', content: `Tool results:\n${results.join('\n')}` });
    }
    return { reply: '', toolCalls };
  };
}

// ─────────────────── Real provider tool-calling ───────────────────

import { loadConfig } from '../config.js';
import { PROVIDER_BASE_URLS } from '../../src/constants/llmPresets.js';
import { GoogleGenAI } from '@google/genai';
import { resolveApiKey } from './llmAdapter.js';

export const SYSTEM_PROMPT = `You are the Tailor CV assistant. You help the user find and understand jobs from their own scraped database using tools.
- When the user asks for jobs, ALWAYS call search_jobs first (use their filters: role, location, source, workMode).
- Pick the best 5 results, and for each give a one-line reason why it fits (use skills from get_cv_summary, and score_job when useful).
- Keep the reply short and human. Personalize using get_cv_summary.
- If the user asks about a specific job, use get_job / score_job.
- When presenting job results, end with exactly one JSON line (nothing after it) in this shape:
{"__jobs":[{"id":"...","reason":"..."}]}
Include up to 5 jobs. Only include jobs you actually found via search_jobs.`;

export function parseJobsBlock(reply: string): { text: string; jobs: any[] } {
  const match = reply.match(/\{"__jobs":(\[.*?\])\}/s);
  let jobs: any[] = [];
  if (match) {
    try {
      jobs = JSON.parse(match[1]);
    } catch {
      jobs = [];
    }
  }
  return { text: reply.replace(/\{"__jobs":\[.*?\]\}/s, '').trim(), jobs };
}

function toNativeTools(tools: ToolDef[]): any[] {
  return tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
}

function parseOpenAiTools(tools: ToolDef[]): any[] {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
}

export async function chatWithTools(params: {
  messages: ChatMessage[];
  tools: ToolDef[];
  toolExecutor: (name: string, args: any) => Promise<any>;
  maxRounds?: number;
}): Promise<{ reply: string; toolCalls: { name: string; args: any }[] }> {
  const config = loadConfig();
  const provider = config.llm.provider || 'gemini';
  const apiKey = resolveApiKey(config.llm.apiKey);
  const model = config.llm.model || 'gemini-3.6-flash';
  const temp = config.llm.temperature ?? 0.2;

  if (!apiKey) {
    const err = new Error('No API key configured. Set one in Settings or via GEMINI_API_KEY env var.');
    (err as any).code = 'NO_API_KEY';
    throw err;
  }

  const loop = buildToolLoop(askFn);
  return loop(params);

  async function askFn(messages: ChatMessage[], tools: ToolDef[]): Promise<NormalizedAskResult> {
    switch (provider) {
      case 'opencode-go':
      case 'openrouter':
      case 'openai':
      case 'nvidia': {
        const baseUrl = config.llm.baseUrl || PROVIDER_BASE_URLS[provider];
        const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
        const body = {
          model,
          temperature: temp,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          tools: parseOpenAiTools(tools),
        };
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`OpenAI-compatible API error ${res.status}: ${errBody}`);
        }
        const data = await res.json();
        const msg = data.choices?.[0]?.message;
        if (msg?.tool_calls?.length) {
          return {
            toolCalls: msg.tool_calls
              .filter((tc: any) => tc?.function?.name)
              .map((tc: any) => ({ name: tc.function.name, args: safeParse(tc.function.arguments) })),
          };
        }
        return { reply: msg?.content || '' };
      }
      case 'anthropic': {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            max_tokens: 8192,
            temperature: temp,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            tools: toNativeTools(tools),
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`Anthropic API error ${res.status}: ${body}`);
        }
        const data = await res.json();
        const content: any[] = data.content || [];
        const toolUses = content.filter((b: any) => b.type === 'tool_use');
        if (toolUses.length) {
          return { toolCalls: toolUses.map((b: any) => ({ name: b.name, args: b.input || {} })) };
        }
        const text = content.find((b: any) => b.type === 'text')?.text || '';
        return { reply: text };
      }
      case 'gemini': {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });
        const response = await ai.models.generateContent({
          model,
          contents: messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          config: {
            temperature: temp,
            tools: [
              {
                functionDeclarations: tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.inputSchema,
                })),
              },
            ],
          },
        });
        const calls = response.functionCalls;
        if (calls?.length) {
          return { toolCalls: calls.map((c: any) => ({ name: c.name, args: c.args || {} })) };
        }
        return { reply: response.text || '' };
      }
      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
  }
}

function safeParse(s: string): any {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
