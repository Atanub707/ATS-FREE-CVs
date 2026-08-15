const VOICEBOX_URL = process.env.VOICEBOX_URL || 'http://127.0.0.1:17493';
const PROBE_TIMEOUT_MS = 900;

export async function voiceboxAvailable(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`${VOICEBOX_URL}/profiles`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export async function voiceboxProfiles(): Promise<{ id: string; name: string }[]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`${VOICEBOX_URL}/profiles`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return [];
    const data = (await res.json()) as any[];
    return (Array.isArray(data) ? data : []).map((p) => ({ id: String(p.id || p.profile_id || ''), name: String(p.name || p.profile_name || 'Default') }));
  } catch {
    return [];
  }
}

export async function voiceboxTranscribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: mimeType }), 'voice.mp4');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${VOICEBOX_URL}/transcribe`, { method: 'POST', body: form, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Voicebox transcribe failed (${res.status})`);
    const data = (await res.json()) as any;
    return String(data.text || '').trim();
  } finally {
    clearTimeout(t);
  }
}

export async function voiceboxSpeak(text: string): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${VOICEBOX_URL}/speak`, {
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
