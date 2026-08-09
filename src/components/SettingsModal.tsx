import React, { useEffect, useState } from 'react';
import { AppConfig, LlmProvider } from '../types';
import { X, Cpu, Globe, Rocket, Palette, ShieldQuestion, CheckCircle2, AlertTriangle, Loader2, Eye, EyeOff } from 'lucide-react';
import { RECOVERY_QUESTIONS } from '../constants/recoveryQuestions';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSaveConfig: (updated: AppConfig) => Promise<void>;
}

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  'opencode-go': 'OpenCode Go',
  'openrouter': 'OpenRouter',
  'openai': 'OpenAI',
  'gemini': 'Google Gemini',
  'anthropic': 'Anthropic',
  'nvidia': 'NVIDIA (Free Tier)',
};

const PROVIDER_MODELS: Record<LlmProvider, string[]> = {
  'opencode-go': [
    'deepseek-v4-flash',
    'deepseek-v4-pro',
    'kimi-k3',
    'kimi-k2.7-code',
    'kimi-k2.6',
    'qwen3.7-max',
    'qwen3.7-plus',
    'qwen3.6-plus',
    'grok-4.5',
    'glm-5.2',
    'glm-5.1',
    'mimo-v2.5-pro',
    'mimo-v2.5',
    'minimax-m3',
    'minimax-m2.7',
    'hy3',
  ],
  'openrouter': ['Custom (type below)'],
  'openai': ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'Custom (type below)'],
  'gemini': ['gemini-3.6-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'Custom (type below)'],
  'anthropic': ['claude-sonnet-4-20250514', 'claude-3.5-haiku', 'claude-opus-4', 'Custom (type below)'],
  'nvidia': ['deepseek-ai/deepseek-v4-flash', 'deepseek-ai/deepseek-v4-pro', 'meta/llama-3.3-70b-instruct', 'mistralai/mistral-large', 'Custom (type below)'],
};

const PROVIDER_BASE_URLS: Record<LlmProvider, string> = {
  'opencode-go': 'https://opencode.ai/zen/go/v1',
  'openrouter': 'https://openrouter.ai/api/v1',
  'openai': 'https://api.openai.com/v1',
  'gemini': '',
  'anthropic': '',
  'nvidia': 'https://integrate.api.nvidia.com/v1',
};

const PROVIDER_LOGO: Record<LlmProvider, { bg: string; text: string }> = {
  'opencode-go': { bg: '#2563EB', text: 'OG' },
  'openrouter': { bg: '#6D28D9', text: 'OR' },
  'openai': { bg: '#0EA5E9', text: 'OA' },
  'gemini': { bg: '#F59E0B', text: 'G' },
  'anthropic': { bg: '#D97706', text: 'A' },
  'nvidia': { bg: '#10B981', text: 'N' },
};

type Theme = 'light' | 'dark' | 'system';

function effectiveTheme(t: Theme): 'light' | 'dark' {
  if (t === 'dark') return 'dark';
  if (t === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<AppConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState<Theme>(config.appearance?.theme || 'system');
  const [showKey, setShowKey] = useState(false);
  const [showApify, setShowApify] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');

  // Recovery questions (password accounts only)
  const [recCurrentPassword, setRecCurrentPassword] = useState('');
  const [recQ1, setRecQ1] = useState(RECOVERY_QUESTIONS[0]);
  const [recA1, setRecA1] = useState('');
  const [recQ2, setRecQ2] = useState(RECOVERY_QUESTIONS[1]);
  const [recA2, setRecA2] = useState('');
  const [recMsg, setRecMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [recSaving, setRecSaving] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme(theme);
  }, [theme]);

  const handleSaveRecovery = async () => {
    setRecMsg(null);
    if (!recCurrentPassword || recA1.trim().length < 3 || recA2.trim().length < 3) {
      setRecMsg({ ok: false, text: 'Enter your current password and answers of at least 3 characters.' });
      return;
    }
    setRecSaving(true);
    try {
      const res = await fetch('/api/auth/recovery-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: recCurrentPassword, recoveryQ1: recQ1, recoveryA1: recA1, recoveryQ2: recQ2, recoveryA2: recA2 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRecMsg({ ok: false, text: data.error || 'Failed to save recovery questions.' });
      } else {
        setRecMsg({ ok: true, text: 'Recovery questions saved.' });
        setRecCurrentPassword(''); setRecA1(''); setRecA2('');
      }
    } catch (e: any) {
      setRecMsg({ ok: false, text: e.message || 'Failed to save recovery questions.' });
    } finally {
      setRecSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSaveConfig({ ...formData, appearance: { theme } });
    setIsSaving(false);
    onClose();
  };

  const selectProvider = (p: LlmProvider) => {
    const defaults = PROVIDER_MODELS[p];
    const defaultModel = defaults[0];
    setFormData({
      ...formData,
      llm: {
        ...formData.llm,
        provider: p,
        model: defaultModel === 'Custom (type below)' ? formData.llm.model : defaultModel,
        baseUrl: PROVIDER_BASE_URLS[p],
      },
    });
  };

  const testConnection = async () => {
    setTestState('testing'); setTestMsg('');
    try {
      const res = await fetch('/api/settings/test-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData.llm),
      });
      const data = await res.json();
      if (data.ok) {
        setTestState('ok'); setTestMsg(`${data.latencyMs}ms`);
      } else {
        setTestState('error'); setTestMsg(data.error || 'Connection failed.');
      }
    } catch (e: any) {
      setTestState('error'); setTestMsg(e.message || 'Connection failed.');
    }
  };

  const provider = formData.llm.provider || 'opencode-go';
  const models = PROVIDER_MODELS[provider] || PROVIDER_MODELS['opencode-go'];
  const showCustomModel = !models.includes(formData.llm.model);
  const logo = PROVIDER_LOGO[provider];

  return (
    <div className="set-overlay">
      <div className="set-col">
        <div className="set-top">
          <div>
            <h1>Settings</h1>
            <p>Everything runs locally — keys and data never leave your machine.</p>
          </div>
          <div className="set-top-actions">
            <button
              className="set-btn set-icon-btn"
              title={effectiveTheme(theme) === 'dark' ? 'Switch to light' : 'Switch to dark'}
              onClick={() => setTheme(effectiveTheme(theme) === 'dark' ? 'light' : 'dark')}
            >
              {effectiveTheme(theme) === 'dark' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>
            <button className="set-btn set-icon-btn" onClick={onClose} aria-label="Close settings" title="Close">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── LLM & AI ── */}
        <div className="set-card">
          <div className="set-card-head">
            <div className="set-ico" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <Cpu size={16} />
            </div>
            <div>
              <b>LLM &amp; AI</b>
              <span className="set-d">Bring your own key — powers scoring, analysis and tailoring.</span>
            </div>
            {testState === 'ok' && <span className="set-tag">● Connected</span>}
          </div>

          <div className="set-row">
            <label>Provider</label>
            <div className="set-providers">
              {(Object.keys(PROVIDER_LABELS) as LlmProvider[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`set-provider ${provider === p ? 'on' : ''}`}
                  onClick={() => selectProvider(p)}
                >
                  <span className="set-pl" style={{ background: PROVIDER_LOGO[p].bg }}>{PROVIDER_LOGO[p].text}</span>
                  {PROVIDER_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="set-row">
            <label>API key</label>
            <div className="set-input-wrap">
              <input type={showKey ? 'text' : 'password'} className="set-mono" value={formData.llm.apiKey}
                onChange={(e) => setFormData({ ...formData, llm: { ...formData.llm, apiKey: e.target.value } })}
                placeholder={provider === 'gemini' ? 'Leave blank to use GEMINI_API_KEY env var' : 'sk-…'} />
              <button className="set-eye" type="button" onClick={() => setShowKey((v) => !v)} title="Show / hide">
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div className="set-hint">Stored in <b>config.ini</b> — never committed, never sent anywhere but to your provider.</div>
          </div>

          <div className="set-row">
            <label>Base URL</label>
            <input type="text" className="set-mono" value={formData.llm.baseUrl}
              onChange={(e) => setFormData({ ...formData, llm: { ...formData.llm, baseUrl: e.target.value } })}
              placeholder="https://api.example.com/v1" />
            <div className="set-hint">Filled automatically per provider. Change only for custom OpenAI-compatible endpoints.</div>
          </div>

          <div className="set-row">
            <label>Model</label>
            <select value={models.includes(formData.llm.model) ? formData.llm.model : 'Custom (type below)'}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== 'Custom (type below)') setFormData({ ...formData, llm: { ...formData.llm, model: val } });
              }}>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {showCustomModel && (
              <input type="text" className="set-mono" style={{ marginTop: 8 }} placeholder="Enter custom model name"
                value={formData.llm.model}
                onChange={(e) => setFormData({ ...formData, llm: { ...formData.llm, model: e.target.value } })} />
            )}
          </div>

          <div style={{ paddingTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className={`set-btn set-btn-sm ${testState === 'ok' ? 'ok' : ''}`} onClick={testConnection} disabled={testState === 'testing'}>
              {testState === 'testing' ? (
                <><Loader2 size={12} className="set-spin" /> Testing…</>
              ) : testState === 'ok' ? (
                <><CheckCircle2 size={12} /> Connected · {testMsg}</>
              ) : (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg> Test connection</>
              )}
            </button>
            {testState === 'error' && (
              <span className="set-test-err"><AlertTriangle size={12} /> {testMsg}</span>
            )}
          </div>
        </div>

        {/* ── Scraper ── */}
        <div className="set-card">
          <div className="set-card-head">
            <div className="set-ico" style={{ background: '#EAF4FE', color: '#0284C7' }}>
              <Globe size={16} />
            </div>
            <div>
              <b>Scraper</b>
              <span className="set-d">How Tailor CV collects jobs from its sources.</span>
            </div>
          </div>
          <div className="set-trow">
            <div className="set-t"><b>Respect robots.txt</b><span>Skips sites that disallow automated access. Recommended ON — disabling means you take responsibility for each site's ToS.</span></div>
            <div className={`set-switch ${formData.scraper.respectRobotsTxt !== false ? 'on' : ''}`}
              onClick={() => setFormData({ ...formData, scraper: { ...formData.scraper, respectRobotsTxt: formData.scraper.respectRobotsTxt === false } })} />
          </div>
          <div className="set-trow">
            <div className="set-t"><b>Stealth mode</b><span>Randomizes request patterns to avoid rate-limit blocks.</span></div>
            <div className={`set-switch ${formData.scraper.stealthMode !== false ? 'on' : ''}`}
              onClick={() => setFormData({ ...formData, scraper: { ...formData.scraper, stealthMode: formData.scraper.stealthMode === false } })} />
          </div>
          <div className="set-row" style={{ paddingBottom: 2 }}>
            <label>Max retries per source</label>
            <input type="text" className="set-mono" style={{ maxWidth: 110 }} value={formData.scraper.maxRetries}
              onChange={(e) => setFormData({ ...formData, scraper: { ...formData.scraper, maxRetries: Number(e.target.value) || 0 } })} />
          </div>
        </div>

        {/* ── Apify ── */}
        <div className="set-card">
          <div className="set-card-head">
            <div className="set-ico" style={{ background: '#EEF2FF', color: '#6366F1' }}>
              <Rocket size={16} />
            </div>
            <div>
              <b>Apify</b>
              <span className="set-d">Reliable LinkedIn scraping — optional, falls back automatically.</span>
            </div>
            {formData.apify.enabled && <span className="set-tag">● Configured</span>}
          </div>
          <div className="set-trow">
            <div className="set-t"><b>Use Apify for LinkedIn</b><span>No more "No results found" blocks, plus the true work mode for every job. Paid per event from Apify's free $5 monthly credit.</span></div>
            <div className={`set-switch ${formData.apify.enabled ? 'on' : ''}`}
              onClick={() => setFormData({ ...formData, apify: { ...formData.apify, enabled: !formData.apify.enabled } })} />
          </div>
          {formData.apify.enabled && (
            <div className="set-row">
              <label>API token</label>
              <div className="set-input-wrap">
                <input type={showApify ? 'text' : 'password'} className="set-mono" value={formData.apify.token}
                  onChange={(e) => setFormData({ ...formData, apify: { ...formData.apify, token: e.target.value } })}
                  placeholder="apify_api_…" />
                <button className="set-eye" type="button" onClick={() => setShowApify((v) => !v)} title="Show / hide">
                  {showApify ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div className="set-hint">console.apify.com → Settings → Integrations → API token (starts with <b>apify_api_</b>).</div>
            </div>
          )}
        </div>

        {/* ── Appearance ── */}
        <div className="set-card">
          <div className="set-card-head">
            <div className="set-ico" style={{ background: '#FFF7ED', color: '#EA580C' }}>
              <Palette size={16} />
            </div>
            <div>
              <b>Appearance</b>
              <span className="set-d">Theme and ATS matching thresholds.</span>
            </div>
          </div>
          <div className="set-trow">
            <div className="set-t"><b>Theme</b><span>Follows your system by default.</span></div>
            <select className="set-select-inline" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div className="set-trow">
            <div className="set-t"><b>Minimum match % to auto-tailor</b><span>Jobs below this are never tailored automatically.</span></div>
            <input type="text" className="set-mono" style={{ width: 70, textAlign: 'center' }} value={formData.thresholds.minMatchForTailor}
              onChange={(e) => setFormData({ ...formData, thresholds: { ...formData.thresholds, minMatchForTailor: Number(e.target.value) || 0 } })} />
          </div>
          <div className="set-trow">
            <div className="set-t"><b>Early block threshold</b><span>Scores under this are blocked from tailoring entirely.</span></div>
            <input type="text" className="set-mono" style={{ width: 70, textAlign: 'center' }} value={formData.thresholds.earlyBlockThreshold}
              onChange={(e) => setFormData({ ...formData, thresholds: { ...formData.thresholds, earlyBlockThreshold: Number(e.target.value) || 0 } })} />
          </div>
        </div>

        {/* ── Security ── */}
        <div className="set-card">
          <div className="set-card-head">
            <div className="set-ico" style={{ background: '#F0FDF4', color: '#16A34A' }}>
              <ShieldQuestion size={16} />
            </div>
            <div>
              <b>Security</b>
              <span className="set-d">Local account recovery — no email service needed.</span>
            </div>
          </div>
          <div className="set-row">
            <label>Current password</label>
            <input type="password" className="set-mono" placeholder="••••••••" value={recCurrentPassword}
              onChange={(e) => setRecCurrentPassword(e.target.value)} />
          </div>
          <div className="set-row">
            <label>Question 1</label>
            <select value={recQ1} onChange={(e) => setRecQ1(e.target.value)}>
              {RECOVERY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
          <div className="set-row">
            <label>Answer 1</label>
            <input type="password" className="set-mono" placeholder="••••••••" value={recA1}
              onChange={(e) => setRecA1(e.target.value)} />
          </div>
          <div className="set-row">
            <label>Question 2</label>
            <select value={recQ2} onChange={(e) => setRecQ2(e.target.value)}>
              {RECOVERY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
          <div className="set-row" style={{ paddingBottom: 2 }}>
            <label>Answer 2</label>
            <input type="password" className="set-mono" placeholder="••••••••" value={recA2}
              onChange={(e) => setRecA2(e.target.value)} />
          </div>
          {recMsg && (
            <div className={`set-rec-msg ${recMsg.ok ? 'ok' : 'err'}`}>
              {recMsg.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {recMsg.text}
            </div>
          )}
          <div style={{ paddingTop: 8 }}>
            <button type="button" className="set-btn set-btn-sm set-btn-green" onClick={handleSaveRecovery} disabled={recSaving}>
              {recSaving ? <><Loader2 size={12} className="set-spin" /> Saving…</> : <><CheckCircle2 size={12} /> Save recovery questions</>}
            </button>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="set-foot">
          <span className="set-note">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Saved locally · config.ini
          </span>
          <div className="set-spacer" />
          <button type="button" className="set-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="set-btn set-btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <><Loader2 size={13} className="set-spin" /> Saving…</> : <>Apply Config <span className="set-kbd">⌘S</span></>}
          </button>
        </div>
      </div>

      <style>{`
        .set-overlay {
          --bg: #F5F6F8; --card: #FFFFFF; --border: #E7E9EE; --divider: #F1F2F5;
          --text: #111418; --muted: #5F6672; --faint: #9AA1AC;
          --accent: #2563EB; --accent-soft: #EFF4FF; --accent-border: #C7D8FB;
          --green: #1A7F4E; --green-soft: #E8F7EF; --green-border: #BDEAD2;
          --red: #DC2626; --red-soft: #FEF2F2;
          --track: #E3E6EB; --shadow: 0 1px 2px rgba(17,20,24,.04), 0 6px 20px rgba(17,20,24,.05);
          position: fixed; inset: 0; z-index: 60; background: rgba(15,17,21,.55);
          display: flex; justify-content: center; overflow: auto; padding: 28px 16px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif; color: var(--text);
          transition: background .25s ease, color .25s ease;
        }
        html[data-theme="dark"] .set-overlay {
          --bg: #101216; --card: #1A1D23; --border: #2A2E37; --divider: #23272F;
          --text: #F2F3F5; --muted: #A5ABB7; --faint: #6B7280;
          --accent: #60A5FA; --accent-soft: #14243F; --accent-border: #1E3A5F;
          --green: #4ADE80; --green-soft: #0E2B1D; --green-border: #14532D;
          --red: #F87171; --red-soft: #3B1111;
          --track: #2E333D; --shadow: 0 1px 2px rgba(0,0,0,.35), 0 6px 20px rgba(0,0,0,.35);
        }
        .set-col { max-width: 680px; width: 100%; margin: auto; display: flex; flex-direction: column; gap: 14px; }
        .set-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
        .set-top h1 { font-size: 24px; font-weight: 800; letter-spacing: -.02em; margin: 0; }
        .set-top p { font-size: 13px; color: var(--muted); margin-top: 4px; }
        .set-top-actions { display: flex; gap: 8px; }
        .set-card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow); padding: 22px 24px; }
        .set-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .set-ico { width: 30px; height: 30px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .set-card-head b { font-size: 14px; font-weight: 700; }
        .set-d { font-size: 12px; color: var(--muted); font-weight: 500; display: block; margin-top: 1px; }
        .set-card-head .set-tag { margin-left: auto; }
        .set-tag { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; background: var(--green-soft); color: var(--green); border: 1px solid var(--green-border); flex-shrink: 0; }
        .set-row { padding: 13px 0; }
        .set-row + .set-row { border-top: 1px solid var(--divider); }
        .set-row label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 7px; }
        .set-hint { font-size: 11.5px; color: var(--faint); margin-top: 7px; line-height: 1.5; }
        .set-hint b { color: var(--muted); font-weight: 600; }
        .set-row input[type="text"], .set-row input[type="password"], .set-row select, .set-select-inline {
          width: 100%; padding: 10px 13px; border: 1px solid var(--border); border-radius: 10px;
          background: var(--bg); color: var(--text); font-size: 13px; font-family: inherit; outline: none;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .set-row input:focus, .set-row select:focus, .set-select-inline:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent); }
        .set-mono { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 12px; }
        .set-input-wrap { position: relative; }
        .set-eye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); border: 0; background: none; color: var(--faint); cursor: pointer; padding: 4px; display: flex; }
        .set-eye:hover { color: var(--muted); }
        .set-providers { display: flex; flex-wrap: wrap; gap: 8px; }
        .set-provider { display: inline-flex; align-items: center; gap: 8px; padding: 8px 13px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--muted); font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all .15s ease; font-family: inherit; }
        .set-provider:hover { border-color: var(--accent-border); color: var(--text); }
        .set-provider.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent); }
        .set-pl { width: 20px; height: 20px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: #fff; flex-shrink: 0; }
        .set-trow { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 14px 0; }
        .set-trow + .set-trow { border-top: 1px solid var(--divider); }
        .set-t b { display: block; font-size: 13px; font-weight: 600; }
        .set-t span { font-size: 12px; color: var(--muted); line-height: 1.5; display: block; margin-top: 3px; }
        .set-switch { position: relative; width: 42px; height: 25px; border-radius: 20px; background: var(--track); cursor: pointer; transition: background .2s ease; flex-shrink: 0; }
        .set-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 21px; height: 21px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform .2s ease; }
        .set-switch.on { background: var(--accent); }
        .set-switch.on::after { transform: translateX(17px); }
        .set-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 9px 16px; border-radius: 10px; border: 1px solid var(--border); background: var(--card); color: var(--text); font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s ease; font-family: inherit; }
        .set-btn:hover { border-color: var(--accent-border); }
        .set-btn:disabled { opacity: .55; cursor: not-allowed; }
        .set-btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; box-shadow: 0 1px 2px rgba(37,99,235,.35); }
        .set-btn-primary:hover { filter: brightness(1.08); }
        .set-btn-sm { padding: 7px 13px; font-size: 12px; border-radius: 9px; }
        .set-btn.ok { background: var(--green-soft); border-color: var(--green-border); color: var(--green); }
        .set-btn-green { border-color: var(--green-border); color: var(--green); background: var(--green-soft); }
        .set-icon-btn { width: 34px; height: 34px; padding: 0; border-radius: 10px; }
        .set-kbd { font-size: 10.5px; border: 1px solid rgba(255,255,255,.35); border-radius: 4px; padding: 0 4px; opacity: .85; }
        .set-test-err { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: var(--red); max-width: 380px; }
        .set-rec-msg { display: flex; align-items: flex-start; gap: 7px; font-size: 11.5px; font-weight: 600; padding: 9px 12px; border-radius: 10px; margin-top: 10px; }
        .set-rec-msg.ok { color: var(--green); background: var(--green-soft); border: 1px solid var(--green-border); }
        .set-rec-msg.err { color: var(--red); background: var(--red-soft); border: 1px solid color-mix(in srgb, var(--red) 30%, transparent); }
        .set-foot { display: flex; align-items: center; gap: 10px; padding-top: 6px; }
        .set-note { font-size: 11.5px; color: var(--faint); display: flex; align-items: center; gap: 6px; }
        .set-spacer { flex: 1; }
        .set-spin { animation: set-spin .8s linear infinite; }
        @keyframes set-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
