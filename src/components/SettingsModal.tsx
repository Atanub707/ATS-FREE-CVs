import React, { useState } from 'react';
import { AppConfig, LlmProvider } from '../types';
import { ArrowLeft, X, Cpu, Globe, Rocket, Palette, ShieldQuestion, CheckCircle2, AlertTriangle, Loader2, Eye, EyeOff, Mail } from 'lucide-react';
import { RECOVERY_QUESTIONS } from '../constants/recoveryQuestions';
import { PROVIDER_BASE_URLS as LLM_PRESETS } from '../constants/llmPresets';
import { APIFY_SOURCES } from '../constants/sources';
import { startTour } from './OnboardingTour';
import pkg from '../../package.json';

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

const PROVIDER_TAG: Record<LlmProvider, string> = {
  'opencode-go': 'DeepSeek · Kimi',
  'openrouter': '100+ models',
  'openai': 'GPT series',
  'gemini': 'Google AI',
  'anthropic': 'Claude series',
  'nvidia': 'Free tier',
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

const PROVIDER_BASE_URLS = LLM_PRESETS;

const PROVIDER_LOGO: Record<LlmProvider, { bg: string; text: string }> = {
  'opencode-go': { bg: 'linear-gradient(135deg,#3B82F6,#2563EB)', text: 'OG' },
  'openrouter': { bg: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', text: 'OR' },
  'openai': { bg: 'linear-gradient(135deg,#38BDF8,#0EA5E9)', text: 'OA' },
  'gemini': { bg: 'linear-gradient(135deg,#FBBF24,#F59E0B)', text: 'G' },
  'anthropic': { bg: 'linear-gradient(135deg,#F59E0B,#D97706)', text: 'A' },
  'nvidia': { bg: 'linear-gradient(135deg,#34D399,#10B981)', text: 'N' },
};


export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<AppConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showApify, setShowApify] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [savedToast, setSavedToast] = useState(false);

  // Recovery questions (password accounts only)
  const [recCurrentPassword, setRecCurrentPassword] = useState('');
  const [recQ1, setRecQ1] = useState(RECOVERY_QUESTIONS[0]);
  const [recA1, setRecA1] = useState('');
  const [recQ2, setRecQ2] = useState(RECOVERY_QUESTIONS[1]);
  const [recA2, setRecA2] = useState('');
  const [recMsg, setRecMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [recSaving, setRecSaving] = useState(false);

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

  const handleSave = async () => {
    setIsSaving(true);
    await onSaveConfig(formData);
    setIsSaving(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2400);
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

  const [emailTestState, setEmailTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [emailTestMsg, setEmailTestMsg] = useState('');

  const testEmailConnection = async () => {
    setEmailTestState('testing'); setEmailTestMsg('');
    try {
      const res = await fetch('/api/emails/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData.email),
      });
      const data = await res.json();
      if (data.ok) {
        setEmailTestState('ok');
        setEmailTestMsg(data.note || 'SMTP connected');
      } else {
        setEmailTestState('error'); setEmailTestMsg(data.error || 'Connection failed.');
      }
    } catch (e: any) {
      setEmailTestState('error'); setEmailTestMsg(e.message || 'Connection failed.');
    }
  };

  return (
    <div className="set-screen">
      {/* ── Header ── */}
      <header className="set-hdr">
        <button className="set-back" onClick={onClose}>← Back</button>
        <div className="set-ttl">
          <b>Settings</b>
          <span>Workspace configuration</span>
        </div>
        <div className="set-spacer" />
      </header>

      {/* ── Content ── */}
      <div className="set-wrap">

        <div className="set-sec-label"><span>Artificial Intelligence</span></div>
        <div className="set-grid">
          {/* LLM & AI */}
          <div className="set-card set-full">
            <div className="set-card-head">
              <div className="set-ico" style={{ background: 'linear-gradient(135deg,#EFF4FF,#E4ECFE)', color: 'var(--accent)' }}>
                <Cpu size={17} />
              </div>
              <div><b>LLM &amp; AI</b><span className="set-d">Bring your own key — powers scoring, analysis and tailoring.</span></div>
              {testState === 'ok' && <span className="set-tag"><span className="set-dot" />Connected</span>}
            </div>

            <div className="set-row">
              <label>Provider</label>
              <div className="set-providers">
                {(Object.keys(PROVIDER_LABELS) as LlmProvider[]).map((p) => (
                  <button key={p} type="button" className={`set-provider ${provider === p ? 'on' : ''}`} onClick={() => selectProvider(p)}>
                    <span className="set-pl" style={{ background: PROVIDER_LOGO[p].bg }}>{PROVIDER_LOGO[p].text}</span>
                    <span className="set-pm">
                      <b>{PROVIDER_LABELS[p]}</b>
                      <span>{PROVIDER_TAG[p]}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="set-grid set-inner">
              <div className="set-row" style={{ borderTop: 0 }}>
                <label>API key</label>
                <div className="set-input-wrap">
                  <input type={showKey ? 'text' : 'password'} className="set-mono" value={formData.llm.apiKey}
                    onChange={(e) => setFormData({ ...formData, llm: { ...formData.llm, apiKey: e.target.value } })}
                    placeholder={provider === 'gemini' ? 'Leave blank to use GEMINI_API_KEY env var' : 'sk-…'} />
                  <button className="set-eye" type="button" onClick={() => setShowKey((v) => !v)} title="Show / hide">
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="set-row" style={{ borderTop: 0 }}>
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
              <div className="set-row">
                <label>Base URL</label>
                <input type="text" className="set-mono" value={formData.llm.baseUrl}
                  onChange={(e) => setFormData({ ...formData, llm: { ...formData.llm, baseUrl: e.target.value } })}
                  placeholder={PROVIDER_BASE_URLS[provider] || 'Not required for this provider'} />
              </div>
              <div className="set-row">
                <label>&nbsp;</label>
                <div className="set-test-row">
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
            </div>
          </div>
        </div>

        <div className="set-sec-label"><span>Data Collection</span></div>
        <div className="set-grid">
          {/* Scraper */}
          <div className="set-card">
            <div className="set-card-head">
              <div className="set-ico" style={{ background: 'linear-gradient(135deg,#E9F5FE,#DCEFFD)', color: '#0284C7' }}>
                <Globe size={17} />
              </div>
              <div><b>Scraper</b><span className="set-d">How jobs are collected.</span></div>
            </div>
            <div className="set-trow">
              <div className="set-t"><b>Respect robots.txt</b><span>Skips sites that disallow automated access. Recommended ON.</span></div>
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

          {/* Apify */}
          <div className="set-card">
            <div className="set-card-head">
              <div className="set-ico" style={{ background: 'linear-gradient(135deg,#EEF0FF,#E4E8FE)', color: '#6366F1' }}>
                <Rocket size={17} />
              </div>
              <div><b>Apify</b><span className="set-d">Reliable LinkedIn scraping.</span></div>
              {formData.apify.enabled && <span className="set-tag"><span className="set-dot" />Configured</span>}
            </div>
            <div className="set-trow">
              <div className="set-t"><b>Use Apify for LinkedIn</b><span>No more "No results found" blocks. Falls back automatically.</span></div>
              <div className={`set-switch ${formData.apify.enabled ? 'on' : ''}`}
                onClick={() => setFormData({ ...formData, apify: { ...formData.apify, enabled: !formData.apify.enabled } })} />
            </div>
            {formData.apify.enabled && (
              <div className="set-row" style={{ paddingBottom: 2 }}>
                <label>API token</label>
                <div className="set-input-wrap">
                  <input type={showApify ? 'text' : 'password'} className="set-mono" value={formData.apify.token}
                    onChange={(e) => setFormData({ ...formData, apify: { ...formData.apify, token: e.target.value } })}
                    placeholder="apify_api_…" />
                  <button className="set-eye" type="button" onClick={() => setShowApify((v) => !v)} title="Show / hide">
                    {showApify ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <div className="set-hint">console.apify.com → Settings → Integrations</div>
              </div>
            )}
            {formData.apify.enabled && (
              <div style={{ padding: '4px 2px 2px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 }}>
                  Powered by your Apify API key
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {APIFY_SOURCES.map((s) => (
                    <span key={s.id} title={`${s.label} — ${s.pricePer1K}/1K jobs`}
                      style={{ fontSize: 11, fontWeight: 600, color: '#6366F1', background: '#EEF0FF', border: '1px solid #E0E4FE', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                      {s.label} <span style={{ fontWeight: 400, color: '#94A3B8' }}>· {s.pricePer1K}/1K</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {formData.apify.referralUrl && (
              <div className="set-trow" style={{ background: '#FDF4FF', border: '1px solid #F5D0FE', borderRadius: 10, marginTop: 10, padding: '10px 12px' }}>
                <div className="set-t">
                  <b>New to Apify?</b>
                  <span>Start with the free $5 monthly trial. This referral link supports development — same price for you, no extra cost.</span>
                </div>
                <a href={formData.apify.referralUrl} target="_blank" rel="noopener noreferrer"
                  style={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, color: '#A21CAF', background: '#FAE8FF', border: '1px solid #F0ABFC', borderRadius: 8, padding: '7px 12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  Open Apify ↗
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="set-sec-label"><span>Preferences</span></div>
        <div className="set-grid">
          {/* Email (cold outreach via the user's own SMTP) */}
          <div className="set-card">
            <div className="set-card-head">
              <div className="set-ico" style={{ background: 'linear-gradient(135deg,#FDF2F8,#FCE7F3)', color: '#DB2777' }}>
                <Mail size={17} />
              </div>
              <div><b>Email</b><span className="set-d">Send cold emails to recruiters from your own mailbox.</span></div>
              {formData.email.host && <span className="set-tag"><span className="set-dot" />Configured</span>}
            </div>
            <div className="set-row">
              <label>SMTP host</label>
              <input type="text" className="set-mono" value={formData.email.host}
                onChange={(e) => setFormData({ ...formData, email: { ...formData.email, host: e.target.value } })}
                placeholder="smtp.gmail.com" />
            </div>
            <div className="set-row">
              <label>Port</label>
              <input type="text" className="set-mono" style={{ maxWidth: 90 }} value={formData.email.port}
                onChange={(e) => {
                  const port = Number(e.target.value) || 0;
                  // Port 465 = implicit SSL; 587/25 = STARTTLS (no SSL toggle).
                  // Auto-set the toggle so a mismatch can't happen by accident.
                  const secure = port === 465 ? true : port === 587 || port === 25 ? false : formData.email.secure;
                  setFormData({ ...formData, email: { ...formData.email, port, secure } });
                }}
                placeholder="587" />
              <div className={`set-switch ${formData.email.secure ? 'on' : ''}`}
                onClick={() => setFormData({ ...formData, email: { ...formData.email, secure: !formData.email.secure } })}
                style={{ marginLeft: 10 }} />
              <span className="set-d" style={{ marginLeft: 8 }}>SSL/TLS</span>
            </div>
            <div className="set-row">
              <label>Username</label>
              <input type="text" className="set-mono" value={formData.email.user}
                onChange={(e) => setFormData({ ...formData, email: { ...formData.email, user: e.target.value } })}
                placeholder="you@gmail.com" />
            </div>
            <div className="set-row">
              <label>Password / app password</label>
              <input type="password" className="set-mono" value={formData.email.password}
                onChange={(e) => setFormData({ ...formData, email: { ...formData.email, password: e.target.value } })}
                placeholder="••••••••" />
            </div>
            <div className="set-row">
              <label>From name</label>
              <input type="text" className="set-mono" value={formData.email.fromName}
                onChange={(e) => setFormData({ ...formData, email: { ...formData.email, fromName: e.target.value } })}
                placeholder="Atanu Biswas" />
            </div>
            <div className="set-row">
              <label>&nbsp;</label>
              <div className="set-test-row">
                <button type="button" className={`set-btn set-btn-sm ${emailTestState === 'ok' ? 'ok' : ''}`}
                  onClick={testEmailConnection} disabled={emailTestState === 'testing'}>
                  {emailTestState === 'testing' ? (
                    <><Loader2 size={12} className="set-spin" /> Testing…</>
                  ) : emailTestState === 'ok' ? (
                    <><CheckCircle2 size={12} /> Connected</>
                  ) : (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg> Test connection</>
                  )}
                </button>
                {emailTestState === 'error' && (
                  <span className="set-test-err"><AlertTriangle size={12} /> {emailTestMsg}</span>
                )}
                {emailTestState === 'ok' && <span className="set-test-ok"><CheckCircle2 size={12} /> {emailTestMsg}</span>}
              </div>
            </div>
            <div className="set-hint" style={{ marginTop: 8 }}>Gmail: enable 2FA, then create an App Password in your Google account — your normal password won't work.</div>
            <details className="set-details">
              <summary className="set-details-sum">How to set up SMTP — step by step</summary>
              <div className="set-details-body">
                <p className="set-details-note">Tip: the SSL/TLS toggle sets itself — port <b>465</b> turns SSL ON, port <b>587</b> or <b>25</b> turns it OFF (STARTTLS). Test connection also auto-corrects it.</p>
                <p className="set-details-head">Gmail (free, recommended)</p>
                <ol className="set-details-list">
                  <li>Turn on <b>2-Step Verification</b>: myaccount.google.com → Security → 2-Step Verification.</li>
                  <li>Search "Google App passwords" → create one for <b>Mail</b>.</li>
                  <li>Copy the 16-character password into <b>Password / app password</b> above.</li>
                  <li>Host: <b>smtp.gmail.com</b> · Port: <b>587</b> · SSL/TLS: OFF (auto) · Username: your Gmail address.</li>
                </ol>
                <p className="set-details-head">Outlook / Microsoft 365</p>
                <ol className="set-details-list">
                  <li>Host: <b>smtp.office365.com</b> · Port: <b>587</b> · SSL/TLS: OFF (auto) · Username: your full email.</li>
                  <li>If 2FA is on, create an app password: myaccount.microsoft.com → Security → App passwords.</li>
                </ol>
                <p className="set-details-head">Any other provider</p>
                <ol className="set-details-list">
                  <li>Look up your provider's SMTP settings (search "<i>your provider</i> SMTP settings").</li>
                  <li>Fill Host and Port exactly as documented. Port <b>465</b> = SSL ON, port <b>587</b> = SSL OFF — the toggle follows the port automatically.</li>
                  <li>Click <b>Test connection</b> — if a TLS mismatch is detected it retries with the right mode automatically.</li>
                </ol>
                <p className="set-details-note">The app never sees your password after you save it — it is stored only in your local config.ini, never committed or logged.</p>
              </div>
            </details>
          </div>

          {/* Appearance */}
          <div className="set-card">
            <div className="set-card-head">
              <div className="set-ico" style={{ background: 'linear-gradient(135deg,#FEF4E7,#FDECDA)', color: '#EA580C' }}>
                <Palette size={17} />
              </div>
              <div><b>Appearance</b><span className="set-d">Theme &amp; matching thresholds.</span></div>
            </div>
            <div className="set-trow">
              <div className="set-t"><b>Auto-tailor minimum</b><span>Min match % to tailor automatically.</span></div>
              <input type="text" className="set-mono" style={{ width: 60, textAlign: 'center' }} value={formData.thresholds.minMatchForTailor}
                onChange={(e) => setFormData({ ...formData, thresholds: { ...formData.thresholds, minMatchForTailor: Number(e.target.value) || 0 } })} />
            </div>
            <div className="set-trow">
              <div className="set-t"><b>Early block</b><span>Scores below this are blocked.</span></div>
              <input type="text" className="set-mono" style={{ width: 60, textAlign: 'center' }} value={formData.thresholds.earlyBlockThreshold}
                onChange={(e) => setFormData({ ...formData, thresholds: { ...formData.thresholds, earlyBlockThreshold: Number(e.target.value) || 0 } })} />
            </div>
          </div>

          {/* Security */}
          <div className="set-card">
            <div className="set-card-head">
              <div className="set-ico" style={{ background: 'linear-gradient(135deg,#EAF9F0,#DCF4E6)', color: '#16A34A' }}>
                <ShieldQuestion size={17} />
              </div>
              <div><b>Security</b><span className="set-d">Local account recovery.</span></div>
            </div>
            <div className="set-trow">
              <div className="set-t"><b>Question 1</b><span>Used if you forget your password.</span></div>
              <select className="set-inline" style={{ width: 150 }} value={recQ1} onChange={(e) => setRecQ1(e.target.value)}>
                {RECOVERY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div className="set-trow">
              <div className="set-t"><b>Answer 1</b></div>
              <input type="password" className="set-mono" placeholder="••••••••" style={{ width: 150 }} value={recA1}
                onChange={(e) => setRecA1(e.target.value)} />
            </div>
            <div className="set-trow">
              <div className="set-t"><b>Question 2</b></div>
              <select className="set-inline" style={{ width: 150 }} value={recQ2} onChange={(e) => setRecQ2(e.target.value)}>
                {RECOVERY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div className="set-trow">
              <div className="set-t"><b>Answer 2</b></div>
              <input type="password" className="set-mono" placeholder="••••••••" style={{ width: 150 }} value={recA2}
                onChange={(e) => setRecA2(e.target.value)} />
            </div>
            <div className="set-row" style={{ borderTop: 0, paddingBottom: 2 }}>
              <label>Current password</label>
              <input type="password" className="set-mono" placeholder="••••••••" value={recCurrentPassword}
                onChange={(e) => setRecCurrentPassword(e.target.value)} />
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
        </div>
      </div>

      {/* ── Sticky action bar ── */}
      <div className="set-actbar">
        <span className="set-ver">Tailor CV v{pkg.version}</span>
        <button type="button" className="set-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="set-btn set-btn-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <><Loader2 size={13} className="set-spin" /> Saving…</> : <>Apply Config <span className="set-kbd">⌘S</span></>}
        </button>
      </div>

      {/* About / attribution — persistent branding (part of the license) */}
      <div className="set-about">
        Tailor CV v1.2.0 — created by <b>Atanu Biswas</b> · © 2026 Atanu Biswas.
        All rights reserved. This software is licensed for personal use only —
        redistribution or white-labeling is prohibited (see LICENSE).
        <div style={{ marginTop: 8 }}>
          <button type="button" onClick={startTour} className="set-btn set-btn-sm" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
            ▶ Replay the tutorial
          </button>
        </div>
      </div>

      {/* Saved toast */}
      <div className={`set-toast ${savedToast ? 'show' : ''}`}>
        <CheckCircle2 size={14} /> Configuration saved
      </div>

      <style>{`
        .set-screen {
          --bg: #F4F6FA; --card: #FFFFFF; --border: #E6EAF2; --divider: #F2F4F8;
          --text: #0B1220; --muted: #5B6472; --faint: #97A0AE;
          --accent: #2563EB; --accent-2: #7C3AED; --accent-soft: #EFF4FF; --accent-border: #C7D8FB;
          --green: #15803D; --green-soft: #ECF7F0; --green-border: #C3E6D0;
          --red: #DC2626; --red-soft: #FEF2F2; --red-border: #F5C6C6;
          --track: #E4E8EF; --shadow-sm: 0 1px 2px rgba(11,18,32,.05);
          --shadow-md: 0 1px 2px rgba(11,18,32,.04), 0 10px 30px -12px rgba(11,18,32,.12);
          position: fixed; inset: 0; z-index: 60; background: var(--bg); color: var(--text);
          display: flex; flex-direction: column; font-family: 'Inter', system-ui, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .set-hdr { display: flex; align-items: center; gap: 14px; padding: 0 32px; height: 60px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--card) 88%, transparent); backdrop-filter: blur(10px); flex-shrink: 0; }
        .set-back { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 8px; border: 1px solid var(--border); background: var(--card); color: var(--muted); font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all .15s ease; font-family: inherit; }
        .set-back:hover { color: var(--text); border-color: var(--accent-border); background: var(--accent-soft); }
        .set-ttl b { font-size: 15px; font-weight: 700; letter-spacing: -.01em; display: block; line-height: 1.2; }
        .set-ttl span { font-size: 11px; color: var(--faint); font-weight: 500; }
        .set-spacer { flex: 1; }
        .set-wrap { max-width: 1080px; width: 100%; margin: 0 auto; padding: 30px 32px 48px; flex: 1; overflow-y: auto; }
        .set-sec-label { display: flex; align-items: center; gap: 10px; margin: 22px 0 10px; }
        .set-sec-label:first-child { margin-top: 0; }
        .set-sec-label span { font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--faint); }
        .set-sec-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .set-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
        .set-inner { grid-template-columns: 1fr 1fr; gap: 0 18px; align-items: stretch; }
        .set-full { grid-column: 1 / -1; }

        .set-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-sm); padding: 22px 24px; transition: box-shadow .2s ease; display: flex; flex-direction: column; }
        .set-card:hover { box-shadow: var(--shadow-md); }
        .set-card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
        .set-ico { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 15%, transparent); }
        .set-card-head b { font-size: 14.5px; font-weight: 700; letter-spacing: -.01em; }
        .set-d { font-size: 12px; color: var(--muted); font-weight: 500; display: block; margin-top: 2px; }
        .set-tag { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; background: var(--green-soft); color: var(--green); border: 1px solid var(--green-border); flex-shrink: 0; }
        .set-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

        .set-row { padding: 14px 0; }
        .set-row + .set-row { border-top: 1px solid var(--divider); }
        .set-row label { display: block; font-size: 12.5px; font-weight: 600; margin-bottom: 8px; }
        .set-hint { font-size: 11px; color: var(--faint); margin-top: 8px; line-height: 1.55; }
        .set-details { margin-top: 10px; border: 1px solid var(--border); border-radius: 10px; background: #FAFBFC; }
        .set-details-sum { cursor: pointer; font-size: 11.5px; font-weight: 700; color: var(--accent); padding: 9px 12px; user-select: none; list-style: none; }
        .set-details-sum::-webkit-details-marker { display: none; }
        .set-details-sum::before { content: '▸ '; }
        .set-details[open] .set-details-sum::before { content: '▾ '; }
        .set-details-body { padding: 2px 12px 12px; }
        .set-details-head { font-size: 11px; font-weight: 800; color: var(--muted); margin: 8px 0 4px; text-transform: uppercase; letter-spacing: .3px; }
        .set-details-list { margin: 0 0 4px 16px; font-size: 11.5px; color: var(--muted); line-height: 1.7; }
        .set-details-note { font-size: 10.5px; color: var(--faint); margin-top: 6px; line-height: 1.55; }

        .set-hint b { color: var(--muted); font-weight: 600; }
        .set-row input[type="text"], .set-row input[type="password"], .set-row select, .set-inline {
          width: 100%; height: 38px; padding: 0 12px; border: 1px solid var(--border); border-radius: 9px;
          background: var(--bg); color: var(--text); font-size: 12.5px; font-family: inherit; outline: none;
          transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
        }
        .set-row input::placeholder { color: var(--faint); }
        .set-row input:hover, .set-row select:hover, .set-inline:hover { border-color: color-mix(in srgb, var(--muted) 40%, var(--border)); }
        .set-row input:focus, .set-row select:focus, .set-inline:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent); background: var(--card); }
        .set-mono { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 12px; }
        .set-input-wrap { position: relative; }
        .set-eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border: 0; border-radius: 7px; background: none; color: var(--faint); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color .15s ease, background .15s ease; }
        .set-eye:hover { color: var(--muted); background: var(--divider); }

        .set-providers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .set-provider { display: flex; align-items: center; gap: 9px; padding: 9px 11px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--muted); font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all .15s ease; font-family: inherit; text-align: left; }
        .set-provider:hover { border-color: var(--accent-border); color: var(--text); background: var(--card); }
        .set-provider.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 9%, transparent); }
        .set-pl { width: 22px; height: 22px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: 800; color: #fff; flex-shrink: 0; box-shadow: inset 0 -1px 2px rgba(0,0,0,.2); }
        .set-pm { min-width: 0; }
        .set-pm b { display: block; font-size: 12px; font-weight: 700; color: var(--text); line-height: 1.15; }
        .set-provider.on .set-pm b { color: var(--accent); }
        .set-pm span { font-size: 10px; color: var(--faint); }

        .set-trow { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; }
        .set-trow + .set-trow { border-top: 1px solid var(--divider); }
        .set-t b { display: block; font-size: 13px; font-weight: 600; }
        .set-t span { font-size: 11.5px; color: var(--muted); line-height: 1.5; display: block; margin-top: 3px; }
        .set-switch { position: relative; width: 40px; height: 23px; border-radius: 20px; background: var(--track); cursor: pointer; transition: background .2s ease; flex-shrink: 0; }
        .set-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 19px; height: 19px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform .2s ease; }
        .set-switch.on { background: var(--accent); }
        .set-switch.on::after { transform: translateX(17px); }

        .set-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 8px 15px; border-radius: 9px; border: 1px solid var(--border); background: var(--card); color: var(--text); font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all .15s ease; font-family: inherit; }
        .set-btn:hover { border-color: var(--accent-border); }
        .set-btn:disabled { opacity: .55; cursor: not-allowed; }
        .set-about { margin-top: 14px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 10px; background: #FAFBFC; font-size: 10.5px; color: var(--faint); line-height: 1.6; text-align: center; }
        .set-about b { color: var(--muted); }
        .set-btn-primary { background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 85%, var(--accent-2))); border-color: transparent; color: #fff; box-shadow: 0 1px 3px color-mix(in srgb, var(--accent) 45%, transparent); }
        .set-btn-primary:hover { filter: brightness(1.07); }
        .set-btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 8px; }
        .set-btn.ok { background: var(--green-soft); border-color: var(--green-border); color: var(--green); }
        .set-btn-green { border-color: var(--green-border); color: var(--green); background: var(--green-soft); }
        .set-kbd { font-size: 10px; border: 1px solid rgba(255,255,255,.35); border-radius: 4px; padding: 1px 4px; opacity: .9; font-family: inherit; }
        .set-test-err { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: var(--red); max-width: 320px; }
        .set-test-row { display: flex; align-items: center; gap: 10px; height: 38px; }
        .set-test-row .set-btn { height: 38px; }
        .set-rec-msg { display: flex; align-items: flex-start; gap: 7px; font-size: 11.5px; font-weight: 600; padding: 9px 12px; border-radius: 9px; margin-top: 10px; }
        .set-rec-msg.ok { color: var(--green); background: var(--green-soft); border: 1px solid var(--green-border); }
        .set-rec-msg.err { color: var(--red); background: var(--red-soft); border: 1px solid var(--red-border); }

        .set-actbar { position: sticky; bottom: 0; background: color-mix(in srgb, var(--card) 90%, transparent); backdrop-filter: blur(12px); border-top: 1px solid var(--border); padding: 12px 32px; display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-shrink: 0; }
        .set-ver { margin-right: auto; font-size: 11px; color: var(--faint); font-weight: 500; }

        .set-toast { position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%) translateY(90px); background: var(--text); color: var(--bg); font-size: 12.5px; font-weight: 600; padding: 11px 18px; border-radius: 12px; display: flex; align-items: center; gap: 8px; box-shadow: 0 10px 30px rgba(0,0,0,.3); transition: transform .3s cubic-bezier(.2,.8,.3,1); z-index: 70; opacity: 0; }
        .set-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }

        .set-spin { animation: set-spin .8s linear infinite; }
        @keyframes set-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
