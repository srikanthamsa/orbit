import { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import type { ProviderConfig, ProviderId } from '@/types';
import { useAgentStore } from '@/stores/agent';
import { requestHostAccessForBaseUrl } from '@/browser/permissions';
import { cn, uid } from '@/lib/utils';
import { Button, Field, IconButton, Input, Select, providerName } from './ui';
import { ConnectedOverlay } from './ConnectedOverlay';

const PROVIDERS: ProviderId[] = ['openai', 'anthropic', 'gemini', 'deepseek', 'compatible'];

// Says what the field accepts, in the user's words — the chips below are shortcuts,
// not the whole list, and "id" is provider jargon.
const MODEL_HINT: Record<ProviderId, string> = {
  openai: 'Presets or any GPT model',
  anthropic: 'Presets or any Claude model',
  gemini: 'Presets or any Gemini model',
  deepseek: 'flash: vision + 1M · v4-pro: text',
  compatible: 'Match the endpoint’s name',
};

const PRESETS: Record<ProviderId, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-5'],
  anthropic: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1', 'claude-3-7-sonnet-latest'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  deepseek: ['deepseek-flash', 'deepseek-v4-pro'],
  compatible: [],
};

export function ProviderForm({ initial, onClose }: { initial?: ProviderConfig; onClose: () => void }) {
  const saveProvider = useAgentStore((s) => s.saveProvider);
  const runTest = useAgentStore((s) => s.runTest);
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
  const [connected, setConnected] = useState<ProviderConfig | null>(null);
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

      // Verify the key the moment it is stored, so a wrong one never reaches a task.
      await runTest(config.id);
      const result = useAgentStore.getState().testStates[config.id];
      if (result?.status === 'ok') {
        setConnected(config);
      } else {
        setError(
          `Saved, but the connection test failed. ${result?.message ?? 'The endpoint did not respond.'}`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn('animate-rise mt-2 rounded-md border border-line bg-surface p-3')}
    >
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-label font-medium text-fg">
          {initial ? 'Edit model' : 'Add a model'}
        </h3>
        <IconButton label="Close" onClick={onClose}>
          <X size={13} />
        </IconButton>
      </div>

      <div className="mt-2 space-y-2.5">
        <Field label="Provider" htmlFor="provider">
          <Select
            id="provider"
            value={provider}
            onChange={(e) => changeProvider(e.target.value as ProviderId)}
          >
            {PROVIDERS.map((id) => (
              <option key={id} value={id}>
                {providerName(id)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Model"
          hint={MODEL_HINT[provider]}
          htmlFor="model"
        >
          <Input
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={`e.g. ${PRESETS[provider][0] ?? 'your-model-name'}`}
            spellCheck={false}
          />
        </Field>

        {PRESETS[provider].length > 0 ? (
          <div className="-mt-1 flex flex-wrap gap-1">
            {PRESETS[provider].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setModel(preset)}
                className={cn(
                  'focus-ring-inset rounded-sm border px-1.5 py-0.5 text-micro transition-colors',
                  model === preset
                    ? 'border-accent-line bg-accent-tint text-accent'
                    : 'border-transparent text-faint hover:bg-raised hover:text-fg',
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        ) : null}

        {provider === 'compatible' ? (
          <Field label="Base URL" hint="OpenAI-compatible" htmlFor="baseUrl">
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              spellCheck={false}
            />
          </Field>
        ) : null}

        <Field
          label="API key"
          hint={existingKey ? 'Saved — enter only to replace' : 'Stored locally'}
          htmlFor="apiKey"
        >
          <span className="relative block">
            <Input
              id="apiKey"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={existingKey ? '••••••••••••' : 'Paste your key'}
              autoComplete="off"
              spellCheck={false}
              className="pr-8"
            />
            <button
              type="button"
              aria-label={showKey ? 'Hide key' : 'Show key'}
              onClick={() => setShowKey((v) => !v)}
              className="focus-ring absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-faint transition-colors hover:text-fg"
            >
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </span>
        </Field>

        <Field label="Vision" hint="Screenshot understanding" htmlFor="vision">
          <Select
            id="vision"
            value={vision}
            onChange={(e) => setVision(e.target.value as 'auto' | 'yes' | 'no')}
          >
            <option value="auto">Auto-detect</option>
            <option value="yes">Supported</option>
            <option value="no">Text only</option>
          </Select>
        </Field>
      </div>

      {error ? (
        <p className="mt-2 rounded-sm border border-danger-line bg-danger-tint px-2 py-1.5 text-caption leading-[1.45] text-danger">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-micro leading-[1.5] text-faint">
          Saving tests the connection.
        </p>
      )}

      <div className="mt-2.5 flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" loading={saving} onClick={() => void submit()}>
          {saving ? 'Testing…' : 'Save'}
        </Button>
      </div>

      {connected ? (
        <ConnectedOverlay
          provider={providerName(connected.provider)}
          model={connected.model}
          onDone={onClose}
        />
      ) : null}
    </div>
  );
}
