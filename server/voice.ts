const VOICEBOX_PORTS = [17493, 17600]; // 17493 = installed app · 17600 = docker-compose (official default)
const VOICEBOX_HOSTS = ['127.0.0.1', 'host.docker.internal']; // host.docker.internal = reach the host from inside our container
const PROBE_TIMEOUT_MS = 900;

let activeUrl: string | null = null;
let activeUrlCheckedAt = 0;
const PORT_CACHE_MS = 10 * 1000;

async function detectVoicebox(): Promise<string | null> {
  const now = Date.now();
  if (activeUrl && now - activeUrlCheckedAt < PORT_CACHE_MS) return activeUrl;
  for (const host of VOICEBOX_HOSTS) {
    for (const port of VOICEBOX_PORTS) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
        const res = await fetch(`http://${host}:${port}/profiles`, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) {
          activeUrl = `http://${host}:${port}`;
          activeUrlCheckedAt = now;
          return activeUrl;
        }
      } catch { /* try next */ }
    }
  }
  activeUrl = null;
  activeUrlCheckedAt = now;
  return null;
}

export async function voiceboxAvailable(): Promise<boolean> {
  return (await detectVoicebox()) !== null;
}

export async function voiceboxPort(): Promise<number | null> {
  const url = await detectVoicebox();
  if (!url) return null;
  return Number(url.split(':').pop());
}

export async function voiceboxProfiles(): Promise<{ id: string; name: string }[]> {
  const url = await detectVoicebox();
  if (!url) return [];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`${url}/profiles`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return [];
    const data = (await res.json()) as any[];
    return (Array.isArray(data) ? data : []).map((p) => ({ id: String(p.id || p.profile_id || ''), name: String(p.name || p.profile_name || 'Default') }));
  } catch {
    return [];
  }
}

export async function voiceboxTranscribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const url = await detectVoicebox();
  if (!url) throw new Error('Voicebox is not running.');
  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: mimeType }), 'voice.webm');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${url}/transcribe`, { method: 'POST', body: form, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Voicebox transcribe failed (${res.status})`);
    const data = (await res.json()) as any;
    return String(data.text || '').trim();
  } finally {
    clearTimeout(t);
  }
}

export async function voiceboxSpeak(text: string): Promise<Buffer | null> {
  const url = await detectVoicebox();
  if (!url) return null;

  // Voicebox /speak is async: it returns a generation record; audio is produced
  // in the background (first use downloads the voice model). Resolve profile:
  // prefer an existing profile, fall back to the bundled "Heart" preset.
  const profiles = await voiceboxProfiles();
  const profile = profiles[0]?.name || 'Heart';

  let genId = '';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(`${url}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, profile }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const gen = (await res.json()) as any;
    genId = String(gen.id || '');
    if (!genId) return null;
  } catch {
    return null;
  }

  // Poll until the generation completes (generating → loading_model → completed/failed).
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(`${url}/history/${genId}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return null;
      const gen = (await res.json()) as any;
      if (gen.status === 'completed' && gen.audio_path) break;
      if (gen.status === 'failed') return null;
    } catch {
      return null;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60000);
    const res = await fetch(`${url}/history/${genId}/export-audio`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}
