// Model Router: resolves a ProviderConfig to a concrete ModelProvider.
// Adding a backend = one provider file + one entry here (donor-repo rule:
// never branch on model type in UI code).

import type { ModelProvider, ProviderConfig, ProviderKind } from './types';
import { OpenAICompatibleProvider } from './openai-compatible';
import { ClaudeProvider } from './claude';
import { GeminiProvider } from './gemini';
import { MockProvider } from './mock';

interface ProviderPreset {
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  requiresKey: boolean;
}

export const PROVIDER_PRESETS: Record<ProviderKind, ProviderPreset> = {
  claude: {
    label: 'Claude (Anthropic)',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-5',
    requiresKey: true,
  },
  gemini: {
    label: 'Gemini (Google)',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    requiresKey: true,
  },
  openai: {
    label: 'GPT (OpenAI)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    requiresKey: true,
  },
  deepseek: {
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    requiresKey: true,
  },
  openrouter: {
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4.5',
    requiresKey: true,
  },
  ollama: {
    label: 'Ollama (local)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
    requiresKey: false,
  },
  lmstudio: {
    label: 'LM Studio (local)',
    defaultBaseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    requiresKey: false,
  },
  mock: {
    label: 'Offline mock',
    defaultBaseUrl: '',
    defaultModel: 'mock',
    requiresKey: false,
  },
};

export const createProvider = (config: ProviderConfig): ModelProvider => {
  const baseUrl = config.baseUrl || PROVIDER_PRESETS[config.kind].defaultBaseUrl;
  switch (config.kind) {
    case 'claude':
      return new ClaudeProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'openai':
    case 'deepseek':
    case 'openrouter':
    case 'ollama':
    case 'lmstudio':
      return new OpenAICompatibleProvider(config, baseUrl);
    case 'mock':
      return new MockProvider();
  }
};
