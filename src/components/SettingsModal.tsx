import React, { useState } from 'react';
import { AppConfig, LlmProvider } from '../types';
import { X, Save, Database, ShieldAlert, Sliders, Key, Cpu, Globe } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSaveConfig: (updated: AppConfig) => Promise<void>;
  onRunMigration: (targetMode: 'sqlite' | 'json') => Promise<{ success: boolean; message: string; count: number }>;
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

function isOpenAiCompatible(provider: LlmProvider): boolean {
  return provider === 'opencode-go' || provider === 'openrouter' || provider === 'openai' || provider === 'nvidia';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onRunMigration,
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<AppConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSaveConfig(formData);
    setIsSaving(false);
    onClose();
  };

  const handleMigrate = async () => {
    setMigrationStatus('Migrating storage engine...');
    const target = formData.storage.mode;
    const res = await onRunMigration(target);
    setMigrationStatus(res.message);
  };

  const provider = formData.llm.provider || 'gemini';
  const models = PROVIDER_MODELS[provider] || PROVIDER_MODELS.gemini;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl shadow-xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">System Configuration</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 text-xs text-slate-800 max-h-[75vh] overflow-y-auto">
          {/* LLM Provider Configuration */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-600" />
              <span>LLM Provider (Bring Your Own Key)</span>
            </h3>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => {
                    const newProvider = e.target.value as LlmProvider;
                    const defaultModels = PROVIDER_MODELS[newProvider] || PROVIDER_MODELS.gemini;
                    const defaultModel = defaultModels[0];
                    setFormData({
                      ...formData,
                      llm: {
                        ...formData.llm,
                        provider: newProvider,
                        model: defaultModel === 'Custom (type below)' ? formData.llm.model : defaultModel,
                        baseUrl: newProvider === 'opencode-go' ? 'https://opencode.ai/zen/go/v1' :
                                 newProvider === 'openrouter' ? 'https://openrouter.ai/api/v1' :
                                 newProvider === 'openai' ? 'https://api.openai.com/v1' :
                                 newProvider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1' : '',
                      },
                    });
                  }}
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-semibold cursor-pointer"
                >
                  {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1 flex items-center space-x-1">
                  <Key className="w-3 h-3 text-amber-600" />
                  <span>API Key</span>
                </label>
                <input
                  type="password"
                  value={formData.llm.apiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, llm: { ...formData.llm, apiKey: e.target.value } })
                  }
                  placeholder={provider === 'gemini' ? 'Leave blank to use GEMINI_API_KEY env var' : provider === 'nvidia' ? 'nvapi-...' : 'sk-...'}
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-mono text-[11px]"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {provider === 'gemini'
                    ? 'Falls back to GEMINI_API_KEY environment variable if blank'
                    : 'Your API key is stored locally in config.ini'}
                </span>
              </div>

              {isOpenAiCompatible(provider) && (
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Base URL</label>
                  <input
                    type="text"
                    value={formData.llm.baseUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, llm: { ...formData.llm, baseUrl: e.target.value } })
                    }
                    className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-mono text-[11px]"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    API endpoint URL for {PROVIDER_LABELS[provider]}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-slate-600 font-medium mb-1">Model</label>
                <select
                  value={models.includes(formData.llm.model) ? formData.llm.model : 'Custom (type below)'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'Custom (type below)') return;
                    setFormData({ ...formData, llm: { ...formData.llm, model: val } });
                  }}
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-semibold cursor-pointer mb-1"
                >
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {!models.includes(formData.llm.model) && (
                  <input
                    type="text"
                    value={formData.llm.model}
                    onChange={(e) =>
                      setFormData({ ...formData, llm: { ...formData.llm, model: e.target.value } })
                    }
                    placeholder="Enter custom model name"
                    className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-mono text-[11px]"
                  />
                )}
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Temperature: {formData.llm.temperature}</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={formData.llm.temperature}
                  onChange={(e) =>
                    setFormData({ ...formData, llm: { ...formData.llm, temperature: Number(e.target.value) } })
                  }
                  className="w-full cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Precise (0)</span>
                  <span>Balanced (0.5)</span>
                  <span>Creative (1)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Thresholds */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>Matching & Tailoring Thresholds</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Early Block Threshold (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.thresholds.earlyBlockThreshold}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      thresholds: { ...formData.thresholds, earlyBlockThreshold: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">Jobs below this score are flagged low match</span>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Min Match for Tailoring (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.thresholds.minMatchForTailor}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      thresholds: { ...formData.thresholds, minMatchForTailor: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">Threshold for batch auto-tailoring</span>
              </div>
            </div>
          </div>

          {/* Adzuna API Config */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>Adzuna Job Search API</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">App ID</label>
                <input
                  type="text"
                  value={formData.scraper.adzunaAppId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      scraper: { ...formData.scraper, adzunaAppId: e.target.value },
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">API Key</label>
                <input
                  type="password"
                  value={formData.scraper.adzunaApiKey}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      scraper: { ...formData.scraper, adzunaApiKey: e.target.value },
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-mono text-[11px]"
                />
              </div>
            </div>
            <span className="text-[10px] text-slate-500 block">Get yours free at <a href="https://developer.adzuna.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">developer.adzuna.com</a></span>
          </div>

          {/* Persistent Storage Config */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>Persistence Engine</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Active Storage Driver</label>
                <select
                  value={formData.storage.mode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      storage: { ...formData.storage, mode: e.target.value as 'sqlite' | 'json' },
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-semibold cursor-pointer"
                >
                  <option value="sqlite">SQLite Database Engine (Primary)</option>
                  <option value="json">JSON File System Fallback (Portable)</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleMigrate}
                  className="px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold transition-colors cursor-pointer"
                >
                  Migrate Records to {formData.storage.mode.toUpperCase()}
                </button>

                {migrationStatus && (
                  <span className="text-[11px] text-blue-700 font-medium truncate max-w-[240px]">
                    {migrationStatus}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Apply Config'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
