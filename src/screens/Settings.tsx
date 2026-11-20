import { useEffect, useState } from 'react';
import { Check, Globe, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ProviderConfig } from '@/types';
import { useAgentStore } from '@/stores/agent';
import { capabilitiesFor } from '@/providers/capabilities';
import {
  grantedSiteOrigins,
  hasBroadSiteAccess,
  requestBroadSiteAccess,
  revokeSiteAccess,
} from '@/browser/permissions';
import { Button, Field, IconButton, Segmented, Spinner, Toggle, inputClass, providerName } from '@/components/ui';
import { ProviderForm } from '@/components/ProviderForm';
import { hostnameOf } from '@/lib/utils';

function ProviderRow({ config, onEdit }: { config: ProviderConfig; onEdit: () => void }) {
  const settings = useAgentStore((s) => s.settings);
  const setActiveProvider = useAgentStore((s) => s.setActiveProvider);
  const removeProvider = useAgentStore((s) => s.removeProvider);
  const runTest = useAgentStore((s) => s.runTest);
  const hasKey = useAgentStore((s) => s.hasKey);
  const test = useAgentStore((s) => s.testStates[config.id]);
  const isActive = settings.activeProviderId === config.id;
  const caps = capabilitiesFor(config);
  const keyed = !!hasKey[config.id];

  return (
    <div className="card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] font-medium">{providerName(config.provider)}</span>
            {isActive ? (
              <span className="flex items-center gap-0.5 rounded-full bg-[var(--accent-soft)] px-1.5 py-[1px] text-[9.5px] font-medium text-[var(--accent)]">
                <Check size={9} strokeWidth={3} /> Active
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{config.model}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[9.5px] text-[var(--faint)]">
            <span className="rounded-full border border-[var(--border)] px-1.5 py-[1px]">
              {caps.vision ? 'Vision' : 'Text only'}
            </span>
            <span className="rounded-full border border-[var(--border)] px-1.5 py-[1px]">
              {keyed ? 'Key stored' : 'No key'}
            </span>
            {config.baseUrl ? (
              <span className="max-w-[150px] truncate rounded-full border border-[var(--border)] px-1.5 py-[1px]">
                {hostnameOf(config.baseUrl)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {!isActive ? (
            <Button size="sm" variant="ghost" onClick={() => void setActiveProvider(config.id)}>
              Use
            </Button>
          ) : null}
          <IconButton label="Edit model" onClick={onEdit}>
            <Pencil size={13} />
          </IconButton>
          <IconButton
            label="Remove model"
            onClick={() => {
              if (window.confirm(`Remove ${providerName(config.provider)} (${config.model})?`)) {
                void removeProvider(config.id);
              }
            }}
          >
            <Trash2 size={13} />
          </IconButton>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className="truncate text-[10.5px]"
          style={{
            color:
              test?.status === 'ok'
                ? 'var(--success)'
                : test?.status === 'error'
                  ? 'var(--danger)'
                  : 'var(--faint)',
          }}
          title={test?.message}
        >
          {test?.status === 'testing'
            ? 'Testing connection…'
            : test?.status === 'ok'
              ? 'Connected'
              : test?.message ?? 'Connection not tested'}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={!keyed || test?.status === 'testing'}
          onClick={() => void runTest(config.id)}
        >
          {test?.status === 'testing' ? <Spinner size={11} /> : null}
          Test
        </Button>
      </div>
    </div>
  );
}

const buildVersion =
  typeof chrome !== 'undefined' && chrome.runtime?.getManifest
    ? chrome.runtime.getManifest().version
    : '0.1.4';

export function Settings() {
  const providers = useAgentStore((s) => s.providers);
  const settings = useAgentStore((s) => s.settings);
  const patchSettings = useAgentStore((s) => s.patchSettings);
  const deleteHistory = useAgentStore((s) => s.deleteHistory);
  const deleteCredentials = useAgentStore((s) => s.deleteCredentials);
  const historyLength = useAgentStore((s) => s.history.length);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderConfig | undefined>(undefined);
  const [broadAccess, setBroadAccess] = useState(false);
  const [grantedSites, setGrantedSites] = useState(0);
  const [accessBusy, setAccessBusy] = useState(false);

  const refreshAccess = async () => {
    setBroadAccess(await hasBroadSiteAccess());
    setGrantedSites((await grantedSiteOrigins()).length);
  };

  useEffect(() => {
    void refreshAccess();
  }, []);

  const allowAllSites = async () => {
    setAccessBusy(true);
    const granted = await requestBroadSiteAccess();
    await refreshAccess();
    setAccessBusy(false);
    if (!granted) {
      window.setTimeout(() => void refreshAccess(), 800);
    }
  };

  const revokeAccess = async () => {
    if (!window.confirm('Remove ORBIT’s access to websites? Tasks will ask again per site.')) return;
    setAccessBusy(true);
    await revokeSiteAccess();
    await refreshAccess();
    setAccessBusy(false);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(undefined);
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto px-4 pb-8 pt-5">
      <h1 className="text-[18px] font-semibold tracking-[-0.02em]">Settings</h1>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
        Bring your own model. Requests go from this browser straight to your provider.
      </p>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--faint)]">Models</h2>
          {!formOpen ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus size={12} /> Add
            </Button>
          ) : null}
        </div>
        <div className="mt-2 space-y-2">
          {providers.length === 0 && !formOpen ? (
            <div className="card p-4 text-center">
              <p className="text-[12.5px] text-[var(--text)]">No model connected yet</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
                Add an OpenAI, Anthropic, Gemini or DeepSeek key. OpenAI-compatible endpoints work too.
              </p>
              <Button
                size="sm"
                variant="primary"
                className="mt-3"
                onClick={() => {
                  setEditing(undefined);
                  setFormOpen(true);
                }}
              >
                <Plus size={12} /> Connect a model
              </Button>
            </div>
          ) : null}
          {providers.map((config) => (
            <ProviderRow
              key={config.id}
              config={config}
              onEdit={() => {
                setEditing(config);
                setFormOpen(true);
              }}
            />
          ))}
          {formOpen ? <ProviderForm initial={editing} onClose={closeForm} /> : null}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--faint)]">Agent limits</h2>
        <div className="card mt-2 space-y-3 p-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max steps" htmlFor="maxSteps" hint="5 – 60">
              <input
                id="maxSteps"
                type="number"
                min={5}
                max={60}
                value={settings.maxSteps}
                onChange={(e) => {
                  const next = Math.min(60, Math.max(5, Number(e.target.value) || 25));
                  void patchSettings({ maxSteps: next });
                }}
                className={`${inputClass} w-full`}
              />
            </Field>
            <Field label="Budget, USD" htmlFor="budget" hint="0 = none">
              <input
                id="budget"
                type="number"
                min={0}
                step={0.1}
                value={settings.maxCostUsd}
                onChange={(e) => void patchSettings({ maxCostUsd: Math.max(0, Number(e.target.value) || 0) })}
                className={`${inputClass} w-full`}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium">Approval mode</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--muted)]">
                {settings.approvalMode === 'sensitive'
                  ? 'Ask before submits, sends, purchases, deletions and transfers.'
                  : 'Ask before every navigation, click, typing and key press.'}
              </p>
            </div>
            <Segmented
              value={settings.approvalMode}
              options={[
                { value: 'sensitive', label: 'Sensitive' },
                { value: 'all', label: 'All' },
              ]}
              onChange={(value) => void patchSettings({ approvalMode: value })}
            />
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--faint)]">Browser access</h2>
        <div className="card mt-2 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-medium">
                {broadAccess ? 'All websites allowed' : 'Ask per website'}
              </p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--muted)]">
                {broadAccess
                  ? 'ORBIT can read and act on any site, and Chrome allows tab screenshots for visual fallback. Revoke at any time.'
                  : 'Chrome asks once for each website before ORBIT can read it. Grant all sites here to stop the prompts and enable screenshots.'}
              </p>
              {!broadAccess && grantedSites > 0 ? (
                <p className="mt-1 text-[10.5px] text-[var(--faint)]">
                  {grantedSites} site{grantedSites === 1 ? '' : 's'} currently allowed
                </p>
              ) : null}
            </div>
            <span
              className="shrink-0 rounded-full border border-[var(--border)] px-2 py-[2px] text-[9.5px]"
              style={{ color: broadAccess ? 'var(--success)' : 'var(--faint)' }}
            >
              {broadAccess ? 'All' : 'Per site'}
            </span>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              size="sm"
              variant={broadAccess ? 'ghost' : 'primary'}
              loading={accessBusy}
              disabled={broadAccess}
              onClick={() => void allowAllSites()}
            >
              <Globe size={12} /> Allow all sites
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={accessBusy || (!broadAccess && grantedSites === 0)}
              onClick={() => void revokeAccess()}
            >
              Revoke access
            </Button>
          </div>
          <p className="mt-2 text-[9.5px] leading-relaxed text-[var(--faint)]">
            Chrome performs its own permission prompt. ORBIT never receives a key or cookie.
          </p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--faint)]">Privacy</h2>
        <div className="card mt-2 divide-y divide-[var(--border)]">
          <div className="flex items-center justify-between gap-3 p-3.5">
            <div>
              <p className="text-[12px] font-medium">Session-only keys</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--muted)]">
                Keep keys in memory until Chrome restarts. Applies to keys saved after changing this.
              </p>
            </div>
            <Toggle
              checked={settings.sessionOnlyKeys}
              label="Session-only keys"
              onChange={(checked) => void patchSettings({ sessionOnlyKeys: checked })}
            />
          </div>
          <div className="flex items-center justify-between gap-3 p-3.5">
            <div>
              <p className="text-[12px] font-medium">Task history</p>
              <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">
                {historyLength > 0 ? `${historyLength} tasks stored locally` : 'Nothing stored'}
              </p>
            </div>
            <Button size="sm" variant="ghost" disabled={historyLength === 0} onClick={() => void deleteHistory()}>
              Clear
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 p-3.5">
            <div>
              <p className="text-[12px] font-medium">API keys</p>
              <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">Delete every stored key from this browser.</p>
            </div>
            <Button size="sm" variant="danger" onClick={() => void deleteCredentials()}>
              Delete keys
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--faint)]">Appearance</h2>
        <div className="card mt-2 flex items-center justify-between p-3.5">
          <p className="text-[12px] font-medium">Theme</p>
          <Segmented
            value={settings.theme}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
            onChange={(value) => void patchSettings({ theme: value })}
          />
        </div>
      </section>

      <div className="mt-7 space-y-1 text-[10.5px] leading-relaxed text-[var(--faint)]">
        <p>ORBIT {buildVersion} · MIT licensed · No backend, no accounts.</p>
        <p>Chrome extension storage is not an encrypted vault. Prefer session-only keys.</p>
        <p className="text-[var(--faint)]">
          If a fix seems missing, reload the extension and reopen this panel — the version above must change.
        </p>
      </div>
    </div>
  );
}
