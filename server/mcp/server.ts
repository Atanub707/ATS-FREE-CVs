import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { z } from 'zod';
import { CHAT_TOOLS, TOOL_EXECUTORS } from './registry.js';

const ZOD_SHAPES: Record<string, z.ZodRawShape> = {
  search_jobs: {
    role: z.string().optional(),
    location: z.string().optional(),
    source: z.string().optional(),
    workMode: z.string().optional(),
    limit: z.number().optional(),
  },
  get_job: { id: z.string() },
  score_job: { id: z.string() },
  get_cv_summary: {},
};

export interface McpPair {
  client: Client;
  ready: Promise<void>;
}

export function createMcpPair(): McpPair {
  const server = new McpServer({ name: 'tailor-cv', version: '1.0.0' });
  for (const t of CHAT_TOOLS) {
    server.registerTool(
      t.name,
      { title: t.name, description: t.description, inputSchema: ZOD_SHAPES[t.name] || {} },
      async (args: any) => {
        const out = await TOOL_EXECUTORS[t.name](args || {});
        return { content: [{ type: 'text', text: JSON.stringify(out) }] };
      }
    );
  }
  const client = new Client({ name: 'tailor-cv-chat', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const serverReady = server.connect(serverTransport);
  const clientReady = client.connect(clientTransport);
  return { client, ready: Promise.all([serverReady, clientReady]).then(() => undefined) };
}

export async function callMcpTool(pair: McpPair, name: string, args: any): Promise<any> {
  await pair.ready;
  const result = await pair.client.callTool({ name, arguments: args || {} });
  const content = result.content as any[];
  const text = content?.find((c: any) => c.type === 'text')?.text || '{}';
  return JSON.parse(text);
}
