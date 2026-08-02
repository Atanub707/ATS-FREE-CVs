import * as cheerio from 'cheerio';

const STEALTH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Cache-Control': 'no-cache',
};

export async function scrapeJobDescription(jobUrl: string): Promise<{ text: string; source: string } | null> {
  try {
    const response = await fetch(jobUrl, {
      headers: STEALTH_HEADERS,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`Generic scrape HTTP ${response.status} for ${jobUrl}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let rawText = '';

    // Try platform-specific selectors first
    const selectors = [
      '#jobDescriptionText',
      '[data-test="jobDescriptionText"]',
      '.jobsearch-JobComponent-description',
      '.job-description',
      '.ad-description',
      '.job_description',
      '.jobDescriptionSection',
      '.description__text',
      '.show-more-less-html__markup',
      '.jobs-description',
      'article',
      'main',
      '.description',
    ];

    for (const sel of selectors) {
      const el = $(sel);
      if (el.length > 0) {
        rawText = el.text();
        if (rawText.trim().length > 200) break;
      }
    }

    // If no selector matched, try getting the largest text block
    if (!rawText || rawText.trim().length < 200) {
      $('p, li, span, div').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 100) {
          rawText += text + '\n';
        }
      });
    }

    const cleaned = rawText.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').trim();

    if (cleaned.length < 150) {
      console.warn(`Generic scrape extracted too little text from ${jobUrl}`);
      return null;
    }

    // Determine source name from URL
    let source = 'Web';
    const hostname = new URL(jobUrl).hostname.toLowerCase();
    if (hostname.includes('linkedin')) source = 'LinkedIn';
    else if (hostname.includes('arbeitnow')) source = 'Arbeitnow';

    return { text: cleaned, source };
  } catch (err: any) {
    console.warn(`Generic scrape error for ${jobUrl}:`, err?.message || err);
    return null;
  }
}
