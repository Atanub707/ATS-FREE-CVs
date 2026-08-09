import puppeteer from 'puppeteer-core';
import type { Browser, Page } from 'puppeteer-core';
import { renderCvHtml, CvRenderShape } from '../../src/lib/cvHtml.js';

const CHROME_CANDIDATES = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

function findChrome(): string {
  for (const p of CHROME_CANDIDATES) {
    try {
      if (require('fs').existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return CHROME_CANDIDATES[0];
}

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: findChrome(),
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        headless: true,
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

/**
 * Render the CV to a PDF from the EXACT same HTML the in-app preview
 * shows (renderCvHtml) — pixel-identical preview vs download.
 */
export async function renderCvPdf(cv: CvRenderShape, template: string = 'harvard'): Promise<Buffer> {
  const html = renderCvHtml(cv, template as any);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' as const });
    const buf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
    return Buffer.from(buf);
  } finally {
    await page.close();
  }
}
