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
    adzunaAppId: '',
    adzunaApiKey: '',
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
        stealthMode: parsed.scraper?.stealthMode === 'false' ? false : true,
        maxRetries: Number(parsed.scraper?.maxRetries ?? DEFAULT_CONFIG.scraper.maxRetries),
        adzunaAppId: parsed.scraper?.adzunaAppId ?? DEFAULT_CONFIG.scraper.adzunaAppId,
        adzunaApiKey: parsed.scraper?.adzunaApiKey ?? DEFAULT_CONFIG.scraper.adzunaApiKey,
      },
    };
  } catch (err) {
    console.error('Failed to load config.ini, using defaults:', err);
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: AppConfig): void {
  try {
    const iniData = ini.stringify({
      thresholds: config.thresholds,
      llm: config.llm,
      storage: config.storage,
      scraper: config.scraper,
    });
    fs.writeFileSync(CONFIG_FILE_PATH, iniData, 'utf-8');
  } catch (err) {
    console.error('Failed to write config.ini:', err);
  }
}
