export function splitSentences(text: string, maxChunks = 14, maxChunkLen = 280): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const raw = cleaned.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  for (const part of raw) {
    if (part.length > maxChunkLen) {
      let rest = part;
      while (rest.length > maxChunkLen) {
        chunks.push(rest.slice(0, maxChunkLen));
        rest = rest.slice(maxChunkLen);
      }
      chunks.push(rest);
      continue;
    }
    chunks.push(part);
  }
  return chunks.slice(0, maxChunks);
}
