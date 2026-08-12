// Display a URL without the protocol/leading www — "https://expenzee.app/"
// shows as "expenzee.app" in previews and PDFs (the link itself keeps the
// full URL). Used by the CV renderers so raw protocols never clutter the UI.
export function displayUrl(url: string | undefined | null): string {
  return String(url || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}
