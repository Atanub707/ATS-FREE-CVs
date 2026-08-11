import fs from 'fs';
import path from 'path';
import ini from 'ini';
import { AppConfig } from '../src/types.js';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'config.ini');

const DEFAULT_CONFIG: AppConfig = {
  thresholds: {
    minMatchForTailor: 40,
    earlyBlockThreshold: 30,
  },
  llm: {
    provider: 'gemini',
    apiKey: '',
    baseUrl: '',
    model: 'gemini-3.6-flash',
    temperature: 0.2,
  },
  storage: {
    mode: 'sqlite',
    sqliteDbPath: './data/ats_jobs.sqlite',
    jsonDbPath: './data/jobs_backup.json',
  },
  scraper: {
    stealthMode: true,
    maxRetries: 3,
    respectRobotsTxt: true,
  },
  apify: {
    token: '',
    enabled: false,
  },
  appearance: {
    theme: 'system',
  },
};

export function loadConfig(): AppConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      saveConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
    const parsed = ini.parse(raw);

    return {
      thresholds: {
        minMatchForTailor: Number(parsed.thresholds?.minMatchForTailor ?? DEFAULT_CONFIG.thresholds.minMatchForTailor),
        earlyBlockThreshold: Number(parsed.thresholds?.earlyBlockThreshold ?? DEFAULT_CONFIG.thresholds.earlyBlockThreshold),
      },
      llm: {
        provider: (['opencode-go', 'openrouter', 'openai', 'gemini', 'anthropic', 'nvidia'].includes(parsed.llm?.provider) ? parsed.llm.provider : DEFAULT_CONFIG.llm.provider) as any,
        apiKey: parsed.llm?.apiKey ?? DEFAULT_CONFIG.llm.apiKey,
        baseUrl: parsed.llm?.baseUrl ?? DEFAULT_CONFIG.llm.baseUrl,
        model: parsed.llm?.model ?? DEFAULT_CONFIG.llm.model,
        temperature: Number(parsed.llm?.temperature ?? DEFAULT_CONFIG.llm.temperature),
      },
      storage: {
        mode: (parsed.storage?.mode === 'json' ? 'json' : 'sqlite'),
        sqliteDbPath: parsed.storage?.sqliteDbPath ?? DEFAULT_CONFIG.storage.sqliteDbPath,
        jsonDbPath: parsed.storage?.jsonDbPath ?? DEFAULT_CONFIG.storage.jsonDbPath,
      },
      scraper: {
        // ini.parse coerces true/false into real booleans — handle both.
        stealthMode: String(parsed.scraper?.stealthMode ?? 'true').toLowerCase() !== 'false',
        maxRetries: Number(parsed.scraper?.maxRetries ?? DEFAULT_CONFIG.scraper.maxRetries),
        respectRobotsTxt: String(parsed.scraper?.respectRobotsTxt ?? 'true').toLowerCase() !== 'false',
      },
      apify: {
        token: parsed.apify?.token || '',
        enabled: String(parsed.apify?.enabled ?? 'false').toLowerCase() === 'true',
      },
      appearance: {
        theme: (['light', 'dark', 'system'].includes(parsed.appearance?.theme) ? parsed.appearance.theme : DEFAULT_CONFIG.appearance.theme) as any,
      },
    };
  } catch (err) {
    console.error('Failed to load config.ini, using defaults:', err);
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: AppConfig): void {
  try {
    // Merge instead of blind overwrite: a save that arrives with missing or
    // undefined sections (a partial UI payload) must never clobber the other
    // sections in the file with the literal string "undefined" — which once
    // destroyed every section except apify and lost the LLM key.
    let existing: Record<string, any> = {};
    try {
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        existing = ini.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf-8'));
      }
    } catch { /* ignore — start from scratch */ }
    const valid = (v: any) => v !== undefined && v !== null && typeof v === 'object' && Object.keys(v).length > 0;
    const out: Record<string, any> = {};
    for (const sec of ['thresholds', 'llm', 'storage', 'scraper', 'apify', 'appearance'] as const) {
      const incoming = (config as any)[sec];
      if (valid(incoming)) out[sec] = incoming;
      else if (valid(existing[sec])) out[sec] = existing[sec];
      // else: section omitted — loadConfig re-defaults it on next read
    }
    fs.writeFileSync(CONFIG_FILE_PATH, ini.stringify(out), 'utf-8');
  } catch (err) {
    console.error('Failed to write config.ini:', err);
  }
}
