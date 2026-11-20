import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { ProviderConfig, ProviderId } from '@/types';
import { useAgentStore } from '@/stores/agent';
import { requestHostAccessForBaseUrl } from '@/browser/permissions';
import { uid } from '@/lib/utils';
import { Button, Field, inputClass, providerName } from './ui';

const PROVIDERS: ProviderId[] = ['openai', 'anthropic', 'gemini', 'deepseek', 'compatible'];

const PRESETS: Record<ProviderId, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-5'],
  anthropic: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1', 'claude-3-7-sonnet-latest'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  deepseek: ['deepseek-flash', 'deepseek-v4-pro'],
  compatible: [],
};

export function ProviderForm({ initial, onClose }: { initial?: ProviderConfig; onClose: () => void }) {
  const saveProvider = useAgentStore((s) => s.saveProvider);
  const hasKey = useAgentStore((s) => s.hasKey);
  const [provider, setProvider] = useState<ProviderId>(initial?.provider ?? 'openai');
  const [model, setModel] = useState(initial?.model ?? PRESETS.openai[0]);
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [vision, setVision] = useState<'auto' | 'yes' | 'no'>(
    initial?.visionOverride === undefined ? 'auto' : initial.visionOverride ? 'yes' : 'no',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existingKey = initial ? hasKey[initial.id] : false;

  const changeProvider = (next: ProviderId) => {
    setProvider(next);
    if (!PRESETS[next].includes(model)) setModel(PRESETS[next][0] ?? '');
  };

  const submit = async () => {
    setError(null);
    if (!model.trim()) {
      setError('Add a model name.');
      return;
    }
    if (!initial && !apiKey.trim()) {
      setError('Add an API key.');
      return;
    }
    if (provider === 'compatible' && !baseUrl.trim()) {
      setError('Compatible endpoints need a base URL.');
      return;
    }
    setSaving(true);
    try {
      if (provider === 'compatible' && baseUrl.trim()) {
        const granted = await requestHostAccessForBaseUrl(baseUrl.trim());
        if (!granted) {
          setError('Chrome needs access to your endpoint’s origin. Approve the prompt and save again.');
          setSaving(false);
          return;
        }
      }
      const config: ProviderConfig = {
        id: initial?.id ?? uid('prov'),
        provider,
        model: model.trim(),
        baseUrl: baseUrl.trim() || undefined,
        visionOverride: vision === 'auto' ? undefined : vision === 'yes',
      };
      await saveProvider(config, apiKey.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card animate-rise mt-2 space-y-3 p-3.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-medium">{initial ? 'Edit model' : 'Add a model'}</h3>
        <button onClick={onClose} className="text-[11px] text-[var(--muted)] hover:text-[var(--text)]">
          Cancel
        </button>
      </div>

      <Field label="Provider" htmlFor="provider">
        <select
          id="provider"
          value={provider}
          onChange={(e) => changeProvider(e.target.value as ProviderId)}
          className={inputClass}
        >
          {PROVIDERS.map((id) => (
            <option key={id} value={id}>
              {providerName(id)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Model"
        hint={
          provider === 'deepseek'
            ? 'flash: vision + 1M; v4-pro: text'
            : 'Exact model id'
        }
        htmlFor="model"
      >
        <input
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="e.g. gpt-4o-mini"
          spellCheck={false}
          className={inputClass}
        />
      </Field>
      {PRESETS[provider].length > 0 ? (
        <div className="-mt-1 flex flex-wrap gap-1">
          {PRESETS[provider].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setModel(preset)}
              className={`rounded-full border px-2 py-0.5 text-[10.5px] transition-colors ${
                model === preset
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--faint)] hover:text-[var(--text)]'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      ) : null}

      {provider === 'compatible' ? (
        <Field label="Base URL" hint="OpenAI-compatible" htmlFor="baseUrl">
          <input
            id="baseUrl"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
            spellCheck={false}
            className={inputClass}
          />
        </Field>
      ) : null}

      <Field
        label="API key"
        hint={existingKey ? 'Saved — enter only to replace' : 'Stored locally'}
        htmlFor="apiKey"
      >
        <div className="relative">
          <input
            id="apiKey"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={existingKey ? '••••••••••••' : 'Paste your key'}
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} pr-9`}
          />
          <button
            type="button"
            aria-label={showKey ? 'Hide key' : 'Show key'}
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--faint)] hover:text-[var(--text)]"
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </Field>

      <Field label="Vision" hint="Screenshot understanding" htmlFor="vision">
        <select
          id="vision"
          value={vision}
          onChange={(e) => setVision(e.target.value as 'auto' | 'yes' | 'no')}
          className={inputClass}
        >
          <option value="auto">Auto-detect</option>
          <option value="yes">Supported</option>
          <option value="no">Text only</option>
        </select>
      </Field>

      {error ? <p className="text-[11.5px] leading-snug text-[var(--danger)]">{error}</p> : null}

      <div className="flex justify-end gap-2 pt-0.5">
        <Button size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" loading={saving} onClick={() => void submit()}>
          Save
        </Button>
      </div>
    </div>
  );
}
