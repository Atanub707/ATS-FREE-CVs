# AI Assistant Chat — MCP-Powered Job Copilot (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An in-app AI chat where users ask for jobs in natural language ("give me remote jobs from LinkedIn") and get **5 results with reasons**, plus an **Apply All** button that opens all 5 postings in tabs (Tier A — safe tier; no auto-submit, no browser automation, per the earlier user decision).

**Architecture:**
1. **MCP server** — a real MCP server (`@modelcontextprotocol/sdk`, in-process, `InMemoryTransport`) exposing tools: `search_jobs`, `get_job`, `score_job`, `get_cv_summary`. The chat handler acts as an MCP client — genuinely "through MCP", and the same server can later be exposed to external MCP clients (Claude Desktop etc.).
2. **Tool-use loop** — extend `server/llm/llmAdapter.ts` with `askWithTools(messages, tools, execute)` supporting all 3 provider SDK families: OpenAI-compatible (OpenCode Go / OpenRouter / OpenAI / NVIDIA) via `tools`, Gemini via `functionDeclarations`, Anthropic via `tools`. Loop max 5 rounds.
3. **Chat endpoint** `POST /api/chat` — runs the loop; instructs the model to end with a structured block `{"__jobs": [...]}` when job results are present; returns `{ reply, jobs }`.
4. **Chat UI** — `src/components/ChatPanel.tsx`, opened from a navbar chat button: message list, input, job-result cards (title, company, location, score, reason, open link) and an **Apply All** button that opens all result URLs in new tabs.

**Tech Stack:** Existing stack + `@modelcontextprotocol/sdk` (runtime dep). No other new dependencies.

## Global Constraints

- Gate: `npx tsc --noEmit`, `npm test`, `npx vite build` all pass; audit 0 high
- Same BYOK key as the rest of the app — no new key config
- No auto-apply / browser automation anywhere (user-confirmed Tier A only)
- Follow existing patterns: tools in `server/`, routes in `server.ts`, UI components with scoped styles, adapter in `server/llm/llmAdapter.ts`
- All storage reads user-scoped via `getCurrentUserId()`
- Commit per task; never push unless asked

---

### Task 1: MCP tool registry + in-process MCP server

**Files:**
- Create: `server/mcp/registry.ts` — tool definitions (MCP-shaped) + executor map
- Create: `server/mcp/server.ts` — `createMcpServer()` using `@modelcontextprotocol/sdk` + `InMemoryTransport` pair helper
- Modify: `package.json` — add `@modelcontextprotocol/sdk`
- Test: `tests/recruiters/mcp.test.ts`

**Interfaces:**
- Consumes: `queryJobs` / `getAllJobs` from storage (user-scoped), `getMasterCv`, job gap-analysis fields
- Produces (exact signatures used by later tasks):
  - `export const CHAT_TOOLS: ToolDef[]` where `ToolDef = { name: string; description: string; inputSchema: Record<string, any> }`
  - `export const TOOL_EXECUTORS: Record<string, (args: any) => Promise<any>>`
  - `export function createMcpPair(): { server: McpServer; client: Client }` — in-process transport pair
  - `search_jobs({ role?, location?, source?, workMode?, limit? })` → `{ jobs: [{ id, title, company, location, source, url, postedDate, applicantCount }] }` (limit default 10, max 25; source matches exact source name or 'all')
  - `get_job({ id })` → job or error
  - `score_job({ id })` → `{ score, matched, missing, recommendations }` (uses stored gapAnalysis if present, else returns stored analysis fields)
  - `get_cv_summary()` → `{ fullName, summary, skills, yearsExperience, locations, noticePeriod }` (from master CV + candidate profile)

- [ ] **Step 1: Install MCP SDK**

Run: `npm i @modelcontextprotocol/sdk`
Expected: added to dependencies

- [ ] **Step 2: Write failing tests**

`tests/recruiters/mcp.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDb, teardownTestDb } from './initDb';
import { runWithUser, getDb } from '../../server/storage/fileStorage';
import { CHAT_TOOLS, TOOL_EXECUTORS } from '../../server/mcp/registry';

describe('MCP tool registry', () => {
  beforeEach(() => {
    setupTestDb();
    runWithUser('u1', () => {
      getDb().prepare(`INSERT INTO jobs (id, user_id, data) VALUES (?, ?, ?)`).run(
        'j1', 'u1', JSON.stringify({ id: 'j1', title: 'DevOps Engineer', company: 'ACME', location: 'Remote', source: 'LinkedIn', url: 'https://x/j1', description: 'Kubernetes terraform ci cd', state: 'pending', createdAt: new Date().toISOString() })
      );
      getDb().prepare(`INSERT INTO jobs (id, user_id, data) VALUES (?, ?, ?)`).run(
        'j2', 'u1', JSON.stringify({ id: 'j2', title: 'SRE', company: 'BETA', location: 'Berlin', source: 'Indeed', url: 'https://x/j2', description: 'linux', state: 'pending', createdAt: new Date().toISOString() })
      );
    });
  });
  afterEach(() => teardownTestDb());

  it('exposes the four chat tools', () => {
    expect(CHAT_TOOLS.map((t) => t.name)).toEqual(['search_jobs', 'get_job', 'score_job', 'get_cv_summary']);
  });

  it('search_jobs filters by source and role and caps at limit', async () => {
    const out = await runWithUser('u1', () => TOOL_EXECUTORS['search_jobs']({ role: 'DevOps', source: 'LinkedIn', limit: 5 }));
    expect(out.jobs).toHaveLength(1);
    expect(out.jobs[0].company).toBe('ACME');
  });

  it('search_jobs returns all when no filters', async () => {
    const out = await runWithUser('u1', () => TOOL_EXECUTORS['search_jobs']({}));
    expect(out.jobs).toHaveLength(2);
  });

  it('get_cv_summary returns profile fields', async () => {
    const out = await runWithUser('u1', () => TOOL_EXECUTORS['get_cv_summary']({}));
    expect(typeof out.fullName).toBe('string');
    expect(Array.isArray(out.skills)).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests — verify RED** (`TOOL_EXECUTORS is not defined`)
- [ ] **Step 4: Implement registry + server**

`server/mcp/registry.ts` — user-scoped queries (use `runWithUser` implicitly — the route middleware already wraps requests, so executors run inside the request's auth context; in tests we wrap with `runWithUser`):

```ts
import { getAllJobs } from '../storage/fileStorage.js';
import { getMasterCv } from '../storage/fileStorage.js';
import { getCandidateProfile } from '../storage/fileStorage.js';

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export const CHAT_TOOLS: ToolDef[] = [
  {
    name: 'search_jobs',
    description: 'Search the user\'s scraped jobs. Filters: role (title/company substring), location, source (e.g. LinkedIn, Indeed, or all), workMode (remote/onsite/hybrid/all), limit (1-25, default 10).',
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string' }, location: { type: 'string' },
        source: { type: 'string' }, workMode: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_job',
    description: 'Get full details of one job by id.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'score_job',
    description: 'Get the AI match score details for a job (score, matched skills, missing skills, recommendations).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'get_cv_summary',
    description: 'Get the candidate\'s CV summary + job preferences (skills, years of experience, locations, notice period).',
    inputSchema: { type: 'object', properties: {} },
  },
];

function normalizeWorkMode(job: any, wanted?: string): boolean {
  if (!wanted || wanted === 'all') return true;
  const loc = (job.location || '').toLowerCase();
  const desc = (job.description || '').toLowerCase();
  if (wanted === 'remote') return loc.includes('remote') || desc.includes('remote');
  if (wanted === 'hybrid') return loc.includes('hybrid') || desc.includes('hybrid');
  if (wanted === 'onsite') return !loc.includes('remote') && !desc.includes('remote');
  return true;
}

export const TOOL_EXECUTORS: Record<string, (args: any) => Promise<any>> = {
  async search_jobs(args) {
    const q = (args?.role || '').toString().toLowerCase().trim();
    const loc = (args?.location || '').toString().toLowerCase().trim();
    const src = (args?.source || '').toString().trim();
    const limit = Math.min(25, Math.max(1, Number(args?.limit) || 10));
    const jobs = getAllJobs().filter((j: any) => {
      if (src && src !== 'all' && (j.source || '') !== src) return false;
      if (q && !((j.title || '').toLowerCase().includes(q) || (j.company || '').toLowerCase().includes(q))) return false;
      if (loc && !(j.location || '').toLowerCase().includes(loc)) return false;
      return normalizeWorkMode(j, args?.workMode);
    });
    return {
      jobs: jobs.slice(0, limit).map((j: any) => ({
        id: j.id, title: j.title, company: j.company, location: j.location,
        source: j.source, url: j.url, postedDate: j.postedDate, applicantCount: j.applicantCount,
      })),
    };
  },
  async get_job(args) {
    const j = getAllJobs().find((x: any) => x.id === args?.id);
    if (!j) return { error: 'Job not found.' };
    return { job: { id: j.id, title: j.title, company: j.company, location: j.location, source: j.source, url: j.url, description: (j.description || '').slice(0, 1500), postedDate: j.postedDate } };
  },
  async score_job(args) {
    const j = getAllJobs().find((x: any) => x.id === args?.id);
    if (!j) return { error: 'Job not found.' };
    const g = j.gapAnalysis;
    return {
      score: g?.score ?? j.analysis?.score ?? null,
      matched: g?.matchedKeywords || [], missing: g?.missingKeywords || [],
      recommendations: g?.recommendations || [],
    };
  },
  async get_cv_summary() {
    const cv = getMasterCv();
    const profile = getCandidateProfile();
    return {
      fullName: cv.fullName, summary: (cv.summary || '').slice(0, 600),
      skills: (cv.skills || []).flatMap((s: any) => s.items || []).slice(0, 40),
      yearsExperience: profile.yearsExperience, locations: profile.preferredLocations, noticePeriod: profile.noticePeriod,
    };
  },
};
```

`server/mcp/server.ts`:

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { CHAT_TOOLS, TOOL_EXECUTORS } from './registry.js';

export function createMcpPair() {
  const server = new McpServer({ name: 'tailor-cv', version: '1.0.0' });
  for (const t of CHAT_TOOLS) {
    server.registerTool(t.name, { title: t.name, description: t.description, inputSchema: t.inputSchema }, async (args: any) => {
      const out = await TOOL_EXECUTORS[t.name](args || {});
      return { content: [{ type: 'text', text: JSON.stringify(out) }] };
    });
  }
  const client = new Client({ name: 'tailor-cv-chat', version: '1.0.0' });
  const pair = InMemoryTransport.createLinkedPair();
  const serverPromise = server.connect(pair.server);
  const clientPromise = client.connect(pair.client);
  return { client, ready: Promise.all([serverPromise, clientPromise]).then(() => undefined) };
}

export async function callMcpTool(pair: { client: Client; ready: Promise<void> }, name: string, args: any): Promise<any> {
  await pair.ready;
  const result = await pair.client.callTool({ name, arguments: args || {} });
  const text = result.content?.find((c: any) => c.type === 'text')?.text || '{}';
  return JSON.parse(text);
}
```

**Note:** import paths for the SDK must match the package's actual exports (`@modelcontextprotocol/sdk/inMemory.js`, `@modelcontextprotocol/sdk/client/index.js`, `@modelcontextprotocol/sdk/server/mcp.js`) — verify with `ls node_modules/@modelcontextprotocol/sdk/dist` and adjust if the layout differs (SDK v1.x).

- [ ] **Step 5: Run tests — GREEN** + `npx tsc --noEmit`
- [ ] **Step 6: Commit** (`git add -A && git commit -m "feat(chat): MCP tool registry + in-process server (search_jobs, get_job, score_job, get_cv_summary)"`)

---

### Task 2: Tool-use loop in the LLM adapter

**Files:**
- Modify: `server/llm/llmAdapter.ts` (or a new `server/llm/tools.ts` importing the provider clients)
- Test: `tests/recruiters/llmTools.test.ts` (mock the provider call — test the loop logic with a fake)

**Interfaces:**
- Consumes: existing provider clients in `server/llm/providers/*`
- Produces:
  - `export async function chatWithTools(params: { messages: ChatMessage[]; tools: ToolDef[]; toolExecutor: (name: string, args: any) => Promise<any>; maxRounds?: number }): Promise<{ reply: string; toolCalls: { name: string; args: any }[] }>`
  - `ChatMessage = { role: 'user' | 'assistant'; content: string }`

- [ ] **Step 1: Write failing tests (loop logic, fake executor)**

`tests/recruiters/llmTools.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { buildToolLoop } from '../../server/llm/tools';

describe('tool loop', () => {
  it('executes tools the model asks for and returns the final reply', async () => {
    const tools = [{ name: 'search_jobs', description: 'x', inputSchema: {} }];
    const calls: string[] = [];
    const fakeAsk = vi.fn()
      .mockResolvedValueOnce(JSON.stringify({ tool_calls: [{ name: 'search_jobs', args: { role: 'DevOps' } }] }))
      .mockResolvedValueOnce(JSON.stringify({ reply: 'Here are 5 jobs…' }));
    const loop = buildToolLoop(fakeAsk);
    const out = await loop({ messages: [{ role: 'user', content: 'remote jobs' }], tools, toolExecutor: async (name) => { calls.push(name); return { jobs: [] }; }, maxRounds: 3 });
    expect(calls).toEqual(['search_jobs']);
    expect(out.reply).toContain('5 jobs');
    expect(fakeAsk).toHaveBeenCalledTimes(2);
  });

  it('stops after maxRounds', async () => {
    const tools = [{ name: 'search_jobs', description: 'x', inputSchema: {} }];
    const fakeAsk = vi.fn().mockResolvedValue(JSON.stringify({ tool_calls: [{ name: 'search_jobs', args: {} }] }));
    const loop = buildToolLoop(fakeAsk);
    const out = await loop({ messages: [], tools, toolExecutor: async () => ({}), maxRounds: 2 });
    expect(fakeAsk).toHaveBeenCalledTimes(2);
    expect(typeof out.reply).toBe('string');
  });
});
```

- [ ] **Step 2: Implement `server/llm/tools.ts`**

The loop is provider-agnostic if each provider wrapper returns a normalized shape: `{ reply?: string; toolCalls?: [{ name, args }] }`. `buildToolLoop(askFn)` runs: ask → if toolCalls → execute all → append assistant(tool results) → repeat. The real provider integration in Task 3 wraps each provider's native tool-calling into this shape.

```ts
import { ToolDef } from '../mcp/registry.js';

export interface ChatMessage { role: 'user' | 'assistant'; content: string; }
export interface NormalizedAskResult { reply?: string; toolCalls?: { name: string; args: any }[]; }

export function buildToolLoop(askFn: (messages: ChatMessage[], tools: ToolDef[]) => Promise<NormalizedAskResult>) {
  return async (params: { messages: ChatMessage[]; tools: ToolDef[]; toolExecutor: (name: string, args: any) => Promise<any>; maxRounds?: number }): Promise<{ reply: string; toolCalls: { name: string; args: any }[] }> => {
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
```

- [ ] **Step 3: Run tests — GREEN**
- [ ] **Step 4: Commit** (`feat(chat): provider-agnostic tool-use loop with round cap`)

---

### Task 3: Provider wrappers + /api/chat endpoint

**Files:**
- Modify: `server/llm/tools.ts` — add `chatWithTools` that switches on provider and uses the real provider SDKs, wrapping native tool-calling into the normalized shape
- Modify: `server.ts` — add `POST /api/chat`
- Modify: `src/constants/llmPresets.ts` — no change (reuse)
- Test: `tests/recruiters/chat.test.ts` (endpoint-level with mocked adapter via vi.mock)

**Interfaces:**
- Consumes: `createMcpPair`, `callMcpTool` (Task 1), `buildToolLoop` (Task 2), existing provider SDKs
- Produces: `POST /api/chat` body `{ messages: [{ role, content }] }` → `{ reply: string, jobs: JobCard[] }` where `JobCard = { id, title, company, location, source, url, score?, reason }`

- [ ] **Step 1: Provider wrappers in `server/llm/tools.ts`**

For each provider family, call the native SDK with tool schemas and map to `NormalizedAskResult`:

- **OpenAI-compatible** (opencode-go, openrouter, openai, nvidia): use the existing OpenAI-compatible client path (check `server/llm/providers/openaiProvider.ts` — reuse its client construction), add `tools` to the chat request; parse `response.choices[0].message.tool_calls`.
- **Gemini**: `@google/genai` — add `config.tools = [{ functionDeclarations }]`, parse `response.functionCalls`.
- **Anthropic**: `@anthropic-ai/sdk` (check how llmAdapter calls it — reuse) — add `tools`, parse `message.content` blocks of type `tool_use`.

Each returns `{ reply }` when content present, else `{ toolCalls }`.

- [ ] **Step 2: Add the system prompt + job-format instruction**

System prompt for the chat:

```
You are the Tailor CV assistant. You help the user find and understand jobs from their own scraped database using tools.
- When the user asks for jobs, ALWAYS call search_jobs first (use their filters: role, location, source, workMode).
- Pick the best 5 results, and for each give: a one-line reason why it fits (mention a skill from get_cv_summary or the score when available via score_job).
- Keep the reply short and human. Use the user's CV data (get_cv_summary) to personalize.
- If the user asks about a specific job, use get_job / score_job.
- When job results are presented, append a final JSON line exactly like this (nothing after it):
{"__jobs":[{"id":"...","reason":"..."}]}
  Include up to 5 jobs. Include title/company/location/url from the search result. Only include jobs you actually found.
```

- [ ] **Step 3: `/api/chat` route in server.ts**

```ts
  app.post('/api/chat', async (req, res) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) return res.status(401).json({ error: 'Not signed in.' });
      const messages: { role: string; content: string }[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
      if (!messages.length) return res.status(400).json({ error: 'Messages are required.' });

      const pair = createMcpPair();
      const executor = (name: string, args: any) => callMcpTool(pair, name, args);
      const reply = await chatWithTools({
        messages: [{ role: 'user', content: SYSTEM_PROMPT }, ...messages],
        tools: CHAT_TOOLS,
        toolExecutor: executor,
        maxRounds: 5,
      });

      // Parse the __jobs block from the reply
      const match = reply.match(/\{"__jobs":(\[.*\])\}/s);
      let jobs: any[] = [];
      if (match) {
        try { jobs = JSON.parse(match[1]); } catch { jobs = []; }
      }
      res.json({ reply: reply.replace(/\{"__jobs":\[.*\]\}/s, '').trim(), jobs });
    } catch (err: any) {
      console.error('Chat error:', err);
      res.status(500).json({ error: 'Chat failed.' });
    }
  });
```

- [ ] **Step 4: Tests** — `tests/recruiters/chat.test.ts`: mock `chatWithTools` (vi.mock the module) and assert the route parses `__jobs` and returns `{ reply, jobs }`. Use a supertest-style call? The repo has no supertest; test the parse helper instead: extract `parseJobsBlock(reply)` into `server/llm/tools.ts` and unit-test it (valid block, no block, malformed).
- [ ] **Step 5: Gates + commit** (`feat(chat): provider tool-calling wrappers + POST /api/chat with structured job results`)

---

### Task 4: Chat UI — panel, job cards, Apply All

**Files:**
- Create: `src/components/ChatPanel.tsx`
- Modify: `src/components/Navbar.tsx` (chat button), `src/App.tsx` (mount panel)

**Interfaces:**
- Consumes: `POST /api/chat`
- Produces: navbar chat icon toggles `ChatPanel`; panel sends messages, renders reply + job cards; **Apply All** opens all job URLs in new tabs (`window.open` each); per-card "Open" link; loading state; error state when no LLM key configured (surface the standard llmError message)

- [ ] **Step 1: ChatPanel component** (scoped styles, whitish theme, matches app design):
  - Header: title "AI Assistant", close button
  - Messages area: user bubbles right (brand), AI left (surface)
  - Job cards: when the response has `jobs`, render below the AI reply: title, company · location · source, score badge if present, reason text, "Open" link; **Apply All** button in the card list header
  - Input row: textarea/input + Send button (Enter to send, Shift+Enter newline)
  - States: busy (sending indicator), error banner
- [ ] **Step 2: Navbar button** — chat icon (`ChatCircleDots` from Phosphor) next to Recruiters; App state `chatOpen`
- [ ] **Step 3: Wire in App.tsx** — render `{chatOpen && <ChatPanel onClose={...} />}` with the same z-index pattern as other modals
- [ ] **Step 4: Gates + commit** (`feat(chat): AI assistant chat panel with job cards and Apply All`)

---

### Task 5: Docs + E2E + final gate

**Files:**
- Modify: `docs/recruiters.md` (new `## AI Assistant` section), `CHANGELOG.md`, `README.md`

**Interfaces:**
- Consumes: everything

- [ ] **Step 1: Docs** — AI Assistant section: how it works (MCP tools, same BYOK key), example prompts, Apply All behavior (opens postings, no auto-submit), API contract `POST /api/chat`
- [ ] **Step 2: E2E in browser** — Docker rebuild; open chat; ask "show me 5 remote DevOps jobs from LinkedIn"; verify 5 cards with reasons; click Apply All → 5 tabs open; verify error path when key missing (if removable)
- [ ] **Step 3: Full gate** — `npx tsc --noEmit && npm test && npm audit --audit-level=high && npx vite build`
- [ ] **Step 4: Commit** (`docs: AI assistant — docs, changelog, README`)

---

## Self-Review Checklist

- [ ] Real MCP (SDK + InMemoryTransport) — not a fake
- [ ] Tool-use loop capped (max 5 rounds) — no infinite loops
- [ ] All three provider families wired (OpenAI-compatible, Gemini, Anthropic)
- [ ] Apply All = open tabs only — no auto-submit anywhere
- [ ] Structured `__jobs` parse is defensive (malformed JSON never crashes the route)
- [ ] Per-user scoping (route 401 + registry uses getAllJobs which is user-scoped)
- [ ] No new secrets; same BYOK key
- [ ] Gates green; no push without user request
