import { ToolDef } from '../mcp/registry.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  /** Provider-native assistant message (tool_calls etc.) to replay verbatim. */
  raw?: any;
  /** Provider tool-call ids, aligned 1:1 with the tool result lines. */
  ids?: (string | null)[];
}

export interface NormalizedAskResult {
  reply?: string;
  toolCalls?: { name: string; args: any }[];
  /** Raw assistant message (with tool_calls) — replayed so round 2+ is protocol-valid. */
  rawAssistant?: any;
  /** Tool-call ids for the results, aligned with toolCalls order. */
  toolIds?: (string | null)[];
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
    const toolResultsText: string[] = [];
    for (let round = 0; round < max; round++) {
      const res = await askFn(history, params.tools);
      if (res.reply) return { reply: res.reply, toolCalls };
      if (!res.toolCalls?.length) {
        // Some models end the turn with NO text after tool calls.
        // Synthesize a reply from the tool results so the user never
        // sees an empty bubble.
        return { reply: synthesizeReply(toolResultsText), toolCalls };
      }
      // CRITICAL: replay the assistant's tool-call turn verbatim — without it,
      // the next request is protocol-invalid and models return empty replies.
      history.push({ role: 'assistant', content: '', raw: res.rawAssistant });
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
      toolResultsText.push(...results);
      // Tool results ride in as a pseudo-'tool' role so each provider can
      // serialize them with the correct protocol (tool messages with
      // tool_call_id, tool_result blocks, or functionResponse parts).
      history.push({ role: 'tool', content: `Tool results:\n${results.join('\n')}`, ids: res.toolIds });
    }
    return { reply: synthesizeReply(toolResultsText), toolCalls };
  };
}

// If the model ended without writing a reply, build one from what the tools
// returned: job listings become a __jobs block (the server enriches the cards),
// otherwise a plain "done" line.
function synthesizeReply(toolResultsText: string[]): string {
  const all = toolResultsText.join('\n');
  const ids: { id: string; reason: string }[] = [];
  for (const line of all.split('\n')) {
    const m = line.match(/^\[(search_jobs|scrape_jobs) result\] (.*)$/);
    if (!m) continue;
    try {
      const parsed = JSON.parse(m[2]);
      const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
      for (const j of jobs) {
        if (j?.id && !ids.some((x) => x.id === j.id)) {
          ids.push({ id: String(j.id), reason: j?.company ? `at ${j.company}` : '' });
        }
      }
    } catch { /* skip */ }
  }
  if (ids.length) {
    return `Here ${ids.length === 1 ? 'is' : 'are'} ${ids.length} matching job${ids.length === 1 ? '' : 's'}:\n{"__jobs":[${ids.map((j) => JSON.stringify(j)).join(',')}]}`;
  }
  if (all.includes('error]')) return 'I ran into an issue with the tools — please try again.';
  return 'Done.';
}

// ─────────────────── Real provider tool-calling ───────────────────

import { loadConfig } from '../config.js';
import { PROVIDER_BASE_URLS } from '../../src/constants/llmPresets.js';
import { GoogleGenAI } from '@google/genai';
import { resolveApiKey } from './llmAdapter.js';

export const SYSTEM_PROMPT = `You are the Tailor CV assistant. You help the user find and understand jobs from their own scraped database using tools.
- NEVER speak the user's side of the conversation. Only ever output YOUR own reply — never greetings or lines that sound like the user wrote them. Do not answer "how are you" questions on the user's behalf; respond directly to what they said.
- Always write the answer text first, BEFORE any JSON line.
- After the tools run, ALWAYS write your answer to the user. Never end the conversation with an empty message.
- READ THE USER'S INTENT (think psychologically): when they ask for jobs ("give me last 24 hours' jobs", "show me X roles"), they want to see the jobs and open the links — NOT an essay. Deliver: title, company, location, source. That's it. No scores, no match talk, no "fits your CV" analysis, no reasons — unless they EXPLICITLY ask you to score, analyze, or rank them ("score these", "which fits me best", "why does this fit").
- When the user asks for scoring/analysis, THEN use score_job (and get_cv_summary) and explain with scores + reasons.
- When the user asks to scrape/find NEW jobs (e.g. "scrape remote DevOps jobs", "find me new jobs"), call scrape_jobs FIRST (it runs their scrapers and stores new jobs in their list), then search_jobs on the stored list to answer.
- Respect time filters literally: if they say "last 24 hours", filter by postedDate within the last 24 hours; "last 7 days" → 7 days. If search_jobs cannot filter by time, say honestly how many of the results are within that window.
- Do NOT call search_jobs again with the same filters once you have results — write the answer.
- Result count rules: if the user asks for a specific number N, return up to min(N, 10). If fewer than N match, say exactly how many matched, honestly.
- If the user asks what to add to their CV or what skills are missing, call analyze_skill_gaps first, then explain the top gaps. Offer to add them: ask the user to confirm, then call apply_gaps_to_cv with the chosen keywords.
- If the user asks about a specific job, use get_job / score_job.
- Formatting: PLAIN TEXT ONLY. No markdown symbols (*, **, #, -, >), no emojis, no bullet lists. Use simple numbered lines (1. 2. 3.) when listing jobs.
- When presenting job results, end with exactly one JSON line (nothing after it) in this shape:
{"__jobs":[{"id":"...","reason":"..."}]}
Include up to 10 jobs. Only include jobs you actually found via search_jobs. Set "withScore": true on an entry ONLY when the user explicitly asked for scoring — otherwise omit it.
- When you generated a CV via generate_cv, end your reply with exactly one JSON line (nothing after it) in this shape, with the token returned by the tool:
{"__cv":{"token":"...","template":"..."}}`;

export function parseJobsBlock(reply: string): { text: string; jobs: any[]; cv?: { token: string; template?: string } } {
  const match = reply.match(/\{"__jobs":(\[.*?\])\}/s);
  let jobs: any[] = [];
  if (match) {
    try {
      jobs = JSON.parse(match[1]);
    } catch {
      jobs = [];
    }
  }
  let text = reply.replace(/\{"__jobs":\[.*?\]\}/s, '').trim();
  const cvMatch = text.match(/\{"__cv":\{(?:[^{}])*\}\}/);
  let cv: { token: string; template?: string } | undefined;
  if (cvMatch) {
    try {
      cv = JSON.parse(cvMatch[0]).__cv;
    } catch {
      cv = undefined;
    }
    text = text.replace(/\{"__cv":\{(?:[^{}])*\}\}/, '').trim();
  }
  return { text, jobs, cv };
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
  system: string;
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
          messages: [
            { role: 'system', content: params.system },
            ...messages.flatMap((m) => {
              // Replay the provider-native assistant message (tool_calls) verbatim.
              if (m.raw) return [m.raw];
              if (m.role === 'tool') {
                const lines = m.content.split('\n').filter((l) => l.trim().startsWith('['));
                return lines.map((l, i) => {
                  const mm = l.match(/^\[(.*?)\s(result|error)\]\s*([\s\S]*)$/);
                  const id = m.ids?.[i] || '';
                  return { role: 'tool', tool_call_id: id, content: (mm?.[3] || '{}').trim() };
                });
              }
              return [{ role: m.role, content: m.content }];
            }),
          ],
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
          const calls = msg.tool_calls.filter((tc: any) => tc?.function?.name);
          return {
            toolCalls: calls.map((tc: any) => ({ name: tc.function.name, args: safeParse(tc.function.arguments) })),
            rawAssistant: msg,
            toolIds: calls.map((tc: any) => tc.id || null),
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
            system: params.system,
            messages: messages.flatMap((m) => {
              if (m.raw) return [m.raw];
              if (m.role === 'tool') {
                const lines = m.content.split('\n').filter((l) => l.trim().startsWith('['));
                return [{
                  role: 'user',
                  content: lines.map((l, i) => {
                    const mm = l.match(/^\[(.*?)\s(result|error)\]\s*([\s\S]*)$/);
                    return {
                      type: 'tool_result',
                      tool_use_id: m.ids?.[i] || '',
                      content: (mm?.[3] || '{}').trim(),
                    };
                  }),
                }];
              }
              return [{ role: m.role, content: m.content }];
            }),
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
          return {
            toolCalls: toolUses.map((b: any) => ({ name: b.name, args: b.input || {} })),
            rawAssistant: data.message || data,
            toolIds: toolUses.map((b: any) => b.id || null),
          };
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
          contents: messages.flatMap((m) => {
            // Replay the model's own function-call turn verbatim (protocol-required).
            if (m.raw) return [m.raw];
            if (m.role === 'tool') {
              // Serialize tool results as proper functionResponse parts —
              // Gemini returns EMPTY responses when results come as plain text.
              const parts = m.content.split('\n').filter((l) => l.trim().startsWith('[')).map((line) => {
                const mm = line.match(/^\[(.*?)\s(result|error)\]\s*(.*)$/s);
                const name = mm?.[1] || 'tool';
                let response: any = {};
                if (mm?.[2] === 'error') {
                  response = { error: mm[3] || 'tool failed' };
                } else {
                  try { response = JSON.parse(mm?.[3] || '{}'); } catch { response = { raw: mm?.[3] }; }
                }
                return { functionResponse: { name, response } };
              });
              return [{ role: 'user', parts: parts.length ? parts : [{ text: m.content }] }];
            }
            return [{ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }];
          }),
          config: {
            systemInstruction: { parts: [{ text: params.system }] },
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
          return {
            toolCalls: calls.map((c: any) => ({ name: c.name, args: c.args || {} })),
            rawAssistant: response.candidates?.[0]?.content,
            toolIds: calls.map(() => null),
          };
        }
        // response.text can be empty even when parts carry the reply (Gemini
        // quirk after tool turns) — extract text from the parts directly.
        const partsText = (response.candidates?.[0]?.content?.parts || [])
          .map((p: any) => p.text || '')
          .join('');
        return { reply: partsText || response.text || '' };
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
