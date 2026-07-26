import React, { useState } from 'react';
import { AppConfig, LlmProvider } from '../types';
import { X, Save, Sliders, Key, Cpu } from 'lucide-react';

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

function isOpenAiCompatible(provider: LlmProvider): boolean {
  return provider === 'opencode-go' || provider === 'openrouter' || provider === 'openai' || provider === 'nvidia';
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSaveConfig(formData);
    setIsSaving(false);
    onClose();
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
