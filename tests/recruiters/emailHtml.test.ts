import { describe, it, expect } from 'vitest';
import { textBodyToHtmlWithLinks } from '../../server/emailHtml';

describe('textBodyToHtmlWithLinks', () => {
  it('linkifies the phone in the signature with a tel: href', () => {
    const html = textBodyToHtmlWithLinks('Atanu Biswas\n+91 8420205661');
    expect(html).toContain('<a href="tel:+918420205661">+91 8420205661</a>');
  });

  it('linkifies the bare portfolio domain with https://', () => {
    const html = textBodyToHtmlWithLinks('atanubiswas.in');
    expect(html).toContain('<a href="https://atanubiswas.in">atanubiswas.in</a>');
  });

  it('linkifies full URLs as-is', () => {
    const html = textBodyToHtmlWithLinks('See https://github.com/atanu');
    expect(html).toContain('<a href="https://github.com/atanu">https://github.com/atanu</a>');
  });

  it('escapes HTML from the AI body (no injection)', () => {
    const html = textBodyToHtmlWithLinks('I use <b>Kubernetes</b> & CI/CD "daily"');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;Kubernetes&lt;/b&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
  });

  it('does not linkify short date-like numbers', () => {
    const html = textBodyToHtmlWithLinks('Joined in 2024');
    expect(html).not.toContain('tel:');
  });

  it('keeps the name line as plain text', () => {
    const html = textBodyToHtmlWithLinks('Atanu Biswas\n+91 8420205661\natanubiswas.in');
    expect(html).toContain('Atanu Biswas<br/>');
  });
});
