import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { useSettingsStore } from '../../stores/settings-store';
import { useUiStore } from '../../stores/ui-store';
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/input';
import { PROVIDER_PRESETS } from '../../core/providers/model-router';
import type { ProviderConfig, ProviderKind } from '../../core/providers/types';

// Local backends (Ollama / LM Studio) expose /models — list them live.
const useLocalModels = (config: ProviderConfig) => {
  const baseUrl = config.baseUrl || PROVIDER_PRESETS[config.kind].defaultBaseUrl;
  const isLocal = config.kind === 'ollama' || config.kind === 'lmstudio';
  return useQuery({
    queryKey: ['models', config.kind, baseUrl],
    enabled: isLocal,
    retry: false,
    queryFn: async () => {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`);
      if (!response.ok) throw new Error('model list unavailable');
      const data = (await response.json()) as { data?: { id?: string }[] };
      return (data.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
    },
  });
};

export const SettingsScreen = () => {
  const { userName, provider, setUserName, setProvider } = useSettingsStore();
  const navigate = useUiStore((s) => s.navigate);
  const [draft, setDraft] = useState<ProviderConfig>(provider);
  const [name, setName] = useState(userName);
  const [saved, setSaved] = useState(false);
  const models = useLocalModels(draft);

  const patch = (fields: Partial<ProviderConfig>) => setDraft((d) => ({ ...d, ...fields }));

  const selectKind = (kind: ProviderKind) => {
    const preset = PROVIDER_PRESETS[kind];
    setDraft((d) => ({ ...d, kind, model: preset.defaultModel, baseUrl: undefined }));
  };

  const preset = PROVIDER_PRESETS[draft.kind];

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate({ name: 'home' })}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="font-semibold">Settings</h1>
        <Button
          size="sm"
          onClick={() => {
            setUserName(name.trim() || 'You');
            setProvider(draft);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
        >
          <Save size={14} /> {saved ? 'Saved!' : 'Save'}
        </Button>
      </div>

      <div className="space-y-5">
        <section>
          <Label>Your name (how characters address you)</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </section>

        <section>
          <Label>Model provider</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(PROVIDER_PRESETS) as ProviderKind[]).map((kind) => (
              <button
                key={kind}
                className={`rounded-xl px-3 py-2 text-xs font-medium ring-1 transition-colors ${
                  draft.kind === kind
                    ? 'bg-accent-500/20 text-accent-400 ring-accent-500'
                    : 'bg-surface-800 text-zinc-400 ring-surface-700 hover:text-zinc-200'
                }`}
                onClick={() => selectKind(kind)}
              >
                {PROVIDER_PRESETS[kind].label}
              </button>
            ))}
          </div>
        </section>

        {preset.requiresKey && (
          <section>
            <Label>API key (stored only in this browser)</Label>
            <Input
              type="password"
              value={draft.apiKey ?? ''}
              onChange={(e) => patch({ apiKey: e.target.value || undefined })}
              placeholder="sk-…"
            />
          </section>
        )}

        {draft.kind !== 'mock' && (
          <>
            <section>
              <Label>Base URL</Label>
              <Input
                value={draft.baseUrl ?? ''}
                onChange={(e) => patch({ baseUrl: e.target.value || undefined })}
                placeholder={preset.defaultBaseUrl}
              />
            </section>
            <section>
              <Label>Model</Label>
              <Input
                value={draft.model}
                onChange={(e) => patch({ model: e.target.value })}
                placeholder={preset.defaultModel}
                list="local-models"
              />
              {models.data && models.data.length > 0 && (
                <datalist id="local-models">
                  {models.data.map((id) => (
                    <option key={id} value={id} />
                  ))}
                </datalist>
              )}
              {models.isError && (
                <p className="mt-1 text-[10px] text-zinc-500">
                  Could not reach the local server for a model list — type the model name manually.
                </p>
              )}
            </section>
          </>
        )}

        <section className="grid grid-cols-2 gap-3">
          <div>
            <Label>Temperature ({draft.temperature.toFixed(2)})</Label>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={draft.temperature}
              onChange={(e) => patch({ temperature: Number(e.target.value) })}
              className="w-full accent-[#a855f7]"
            />
          </div>
          <div>
            <Label>Max reply tokens</Label>
            <Input
              type="number"
              min={64}
              max={8192}
              value={draft.maxOutputTokens}
              onChange={(e) => patch({ maxOutputTokens: Number(e.target.value) || 1024 })}
            />
          </div>
        </section>

        <p className="rounded-xl bg-surface-800 p-3 text-[11px] leading-relaxed text-zinc-500 ring-1 ring-surface-700">
          NamoChat is local-first: keys and chats never leave this browser except for direct
          requests to your chosen model provider. The offline mock provider works with no
          configuration at all.
        </p>
      </div>
    </div>
  );
};
