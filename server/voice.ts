const VOICEBOX_PORTS = [17493, 17600]; // 17493 = installed app · 17600 = docker-compose (official default)
const PROBE_TIMEOUT_MS = 900;

let activePort: number | null = null;
let activePortCheckedAt = 0;
const PORT_CACHE_MS = 10 * 1000;

async function detectVoicebox(): Promise<number | null> {
  const now = Date.now();
  if (activePort && now - activePortCheckedAt < PORT_CACHE_MS) return activePort;
  for (const port of VOICEBOX_PORTS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
      const res = await fetch(`http://127.0.0.1:${port}/profiles`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        activePort = port;
        activePortCheckedAt = now;
        return port;
      }
    } catch { /* try next */ }
  }
  activePort = null;
  activePortCheckedAt = now;
  return null;
}

function baseUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

export async function voiceboxAvailable(): Promise<boolean> {
  return (await detectVoicebox()) !== null;
}

export async function voiceboxPort(): Promise<number | null> {
  return detectVoicebox();
}

export async function voiceboxProfiles(): Promise<{ id: string; name: string }[]> {
  const port = await detectVoicebox();
  if (!port) return [];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`${baseUrl(port)}/profiles`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return [];
    const data = (await res.json()) as any[];
    return (Array.isArray(data) ? data : []).map((p) => ({ id: String(p.id || p.profile_id || ''), name: String(p.name || p.profile_name || 'Default') }));
  } catch {
    return [];
  }
}

export async function voiceboxTranscribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const port = await detectVoicebox();
  if (!port) throw new Error('Voicebox is not running.');
  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: mimeType }), 'voice.webm');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${baseUrl(port)}/transcribe`, { method: 'POST', body: form, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Voicebox transcribe failed (${res.status})`);
    const data = (await res.json()) as any;
    return String(data.text || '').trim();
  } finally {
    clearTimeout(t);
  }
}

export async function voiceboxSpeak(text: string): Promise<Buffer | null> {
  const port = await detectVoicebox();
  if (!port) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${baseUrl(port)}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? buf : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
