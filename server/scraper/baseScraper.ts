import { Job, ScraperParams, JobSource } from '../../src/types.js';

export abstract class BaseScraper {
  abstract readonly source: JobSource;

  protected getStealthHeaders(): Record<string, string> {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    const randomUa = userAgents[Math.floor(Math.random() * userAgents.length)];

    return {
      'User-Agent': randomUa,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1'
    };
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected extractSalaryFromString(text: string): { min?: number; max?: number; text?: string } {
    if (!text) return {};
    const salaryRegex = /(\$|\bUSD\b|\bEUR\b|\bGBP\b)?\s*(\d{2,3}(?:,\d{3})+|\d{2,3}k)\s*(?:-|to|\b–\b)\s*(\$|\bUSD\b|\bEUR\b|\bGBP\b)?\s*(\d{2,3}(?:,\d{3})+|\d{2,3}k)/i;
    const match = text.match(salaryRegex);
    if (match) {
      const minRaw = match[2].toLowerCase().replace(/,/g, '');
      const maxRaw = match[4].toLowerCase().replace(/,/g, '');
      const min = minRaw.endsWith('k') ? parseFloat(minRaw) * 1000 : parseFloat(minRaw);
      const max = maxRaw.endsWith('k') ? parseFloat(maxRaw) * 1000 : parseFloat(maxRaw);
      return {
        min: isNaN(min) ? undefined : min,
        max: isNaN(max) ? undefined : max,
        text: match[0]
      };
    }
    const singleRegex = /(\$|\bUSD\b)?\s*(\d{2,3}(?:,\d{3})+|\d{2,3}k)\s*(?:\/yr|\/year|\bannually\b|\ba year\b)/i;
    const singleMatch = text.match(singleRegex);
    if (singleMatch) {
      const raw = singleMatch[2].toLowerCase().replace(/,/g, '');
      const val = raw.endsWith('k') ? parseFloat(raw) * 1000 : parseFloat(raw);
      return {
        min: isNaN(val) ? undefined : val,
        max: isNaN(val) ? undefined : val,
        text: singleMatch[0]
      };
    }
    return {};
  }

  abstract scrape(params: ScraperParams): Promise<Job[]>;
}
