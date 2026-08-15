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
