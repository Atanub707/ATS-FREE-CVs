// Plain-text email body → safe HTML with clickable tel: / https: links.
// Used at send time so the candidate's phone and portfolio (from the Master
// CV signature lines) render as tap-to-call / open-links in mail clients.

export function textBodyToHtmlWithLinks(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const lines = String(text).split(/\r?\n/).map((line) => {
    let out = esc(line);
    out = out.replace(/(\+?\d[\d\s\-().]{6,}\d)/g, (m) => `<a href="tel:+${m.replace(/[^\d]/g, '')}">${m}</a>`);
    out = out.replace(/(https?:\/\/[^\s<]+)/g, (m) => `<a href="${m}">${m}</a>`);
    out = out.replace(/(^|[\s(])([a-z0-9][a-z0-9-]*\.(?:in|com|dev|io|me|net|org|co|ai|app)\b(?:[^\s<]*))/gi, (_m, pre, dom) => `${pre}<a href="https://${dom}">${dom}</a>`);
    return out;
  });
  return lines.join('<br/>');
}
