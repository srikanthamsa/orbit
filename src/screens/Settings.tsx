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
import {
  Badge,
  Button,
  IconButton,
  NumberField,
  Row,
  Section,
  Segmented,
  Spinner,
  Toggle,
  providerName,
} from '@/components/ui';
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

  const testLabel =
    test?.status === 'testing'
      ? 'Testing connection…'
      : test?.status === 'ok'
        ? 'Connected'
        : (test?.message ?? 'Not tested');
  const testTone =
    test?.status === 'ok' ? 'text-success' : test?.status === 'error' ? 'text-danger' : 'text-faint';

  return (
    <div className="py-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-body text-fg">{providerName(config.provider)}</span>
            {isActive ? (
              <Badge tone="accent">
                <Check size={8} strokeWidth={3.5} className="mr-0.5" />
                Active
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-caption text-muted">{config.model}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-micro text-faint">
            <span>{caps.vision ? 'Vision' : 'Text only'}</span>
            <span aria-hidden>·</span>
            <span>{keyed ? 'Key stored' : 'No key'}</span>
            {config.baseUrl ? (
              <>
                <span aria-hidden>·</span>
                <span className="max-w-[132px] truncate">{hostnameOf(config.baseUrl)}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {!isActive ? (
            <Button size="sm" variant="ghost" onClick={() => void setActiveProvider(config.id)}>
              Use
            </Button>
          ) : null}
          <IconButton label="Edit model" onClick={onEdit}>
            <Pencil size={12} />
          </IconButton>
          <IconButton
            label="Remove model"
            onClick={() => void removeProvider(config.id)}
          >
            <Trash2 size={12} />
          </IconButton>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <span className={`min-w-0 flex-1 truncate text-micro ${testTone}`} title={test?.message}>
          {testLabel}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={!keyed || test?.status === 'testing'}
          onClick={() => void runTest(config.id)}
        >
          {test?.status === 'testing' ? <Spinner size={10} /> : null}
          Test
        </Button>
      </div>
    </div>
  );
}

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
    setAccessBusy(true);
    await revokeSiteAccess();
    await refreshAccess();
    setAccessBusy(false);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(undefined);
  };

  const openForm = (config?: ProviderConfig) => {
    setEditing(config);
    setFormOpen(true);
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto px-4 pb-10 pt-5">
      <header className="px-0.5">
        <h1 className="text-page font-semibold text-fg">Settings</h1>
        <p className="mt-0.5 text-caption leading-[1.5] text-muted">
          Bring your own model. Requests go from this browser straight to your provider.
        </p>
      </header>

      {/* Models ------------------------------------------------------------ */}
      <Section
        title="Models"
        action={
          !formOpen ? (
            <Button size="sm" variant="ghost" onClick={() => openForm(undefined)}>
              <Plus size={12} />
              Add model
            </Button>
          ) : null
        }
      >
        {providers.length === 0 && !formOpen ? (
          <div className="rounded-md border border-dashed border-line px-3 py-3">
            <p className="text-body text-fg">No model connected yet</p>
            <p className="mt-0.5 text-caption leading-[1.5] text-muted">
              Add an OpenAI, Anthropic, Gemini or DeepSeek key. OpenAI-compatible endpoints work too.
            </p>
            <Button
              size="sm"
              variant="primary"
              className="mt-2.5"
              onClick={() => openForm(undefined)}
            >
              <Plus size={12} />
              Connect a model
            </Button>
          </div>
        ) : null}

        {providers.length > 0 ? (
          <div className="divide-y divide-line">
            {providers.map((config) => (
              <ProviderRow key={config.id} config={config} onEdit={() => openForm(config)} />
            ))}
          </div>
        ) : null}

        {formOpen ? (
          <ProviderForm initial={editing} onClose={closeForm} />
        ) : null}
      </Section>

      {/* Agent configuration ----------------------------------------------- */}
      <Section title="Agent">
        <div className="divide-y divide-line">
          <Row
            title="Actions per task"
            description="How many it may take before it stops."
            control={
              <NumberField
                label="step limit"
                value={settings.maxSteps}
                min={5}
                max={60}
                fallback={25}
                onChange={(next) => void patchSettings({ maxSteps: next })}
              />
            }
          />
          <Row
            title="Spend cap"
            description="Stops when the estimate passes this. 0 turns it off."
            control={
              <NumberField
                label="spend limit"
                value={settings.maxCostUsd}
                min={0}
                step={0.5}
                decimals={2}
                fallback={0}
                width={52}
                onChange={(next) => void patchSettings({ maxCostUsd: next })}
              />
            }
          />
          <Row
            title="Approvals"
            description={
              settings.approvalMode === 'sensitive'
                ? 'Ask before anything that sends, buys or deletes.'
                : 'Ask before every step, including clicks and typing.'
            }
            control={
              <Segmented
                label="Approval mode"
                value={settings.approvalMode}
                options={[
                  { value: 'sensitive', label: 'Sensitive' },
                  { value: 'all', label: 'All' },
                ]}
                onChange={(value) => void patchSettings({ approvalMode: value })}
              />
            }
          />
        </div>
      </Section>

      {/* Browser permissions ------------------------------------------------ */}
      <Section title="Permissions">
        <div className="py-2.5">
          <p className="text-body text-fg">
            {broadAccess ? 'Every site allowed' : 'Ask per site'}
          </p>
          <p className="mt-0.5 text-caption leading-[1.45] text-muted">
            {broadAccess
              ? 'ORBIT can read and act on any site, and Chrome allows screenshots. Revoke whenever you like.'
              : 'Each site asks once. Allow every site to skip the prompts and enable screenshots.'}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-micro text-faint">
              {broadAccess
                ? 'All sites'
                : grantedSites > 0
                  ? `${grantedSites} allowed`
                  : 'Per site'}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                loading={accessBusy}
                disabled={broadAccess}
                onClick={() => void allowAllSites()}
              >
                <Globe size={12} />
                Allow all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={accessBusy || (!broadAccess && grantedSites === 0)}
                onClick={() => void revokeAccess()}
              >
                Revoke
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-2 px-0.5 text-micro leading-[1.5] text-faint">
          Chrome asks on its own. ORBIT never sees a key or a cookie.
        </p>
      </Section>

      {/* Privacy ------------------------------------------------------------ */}
      <Section title="Privacy">
        <div className="divide-y divide-line">
          <Row
            title="Keep keys in memory"
            description="Until the browser quits. Applies to keys saved after this."
            control={
              <Toggle
                checked={settings.sessionOnlyKeys}
                label="Session-only keys"
                onChange={(checked) => void patchSettings({ sessionOnlyKeys: checked })}
              />
            }
          />
          <Row
            title="Task history"
            description={historyLength > 0 ? `${historyLength} tasks stored locally` : 'Nothing stored'}
            control={
              <Button
                size="sm"
                variant="ghost"
                disabled={historyLength === 0}
                onClick={() => void deleteHistory()}
              >
                Clear
              </Button>
            }
          />
          <Row
            title="API keys"
            description="Delete every stored key from this browser."
            control={
              <Button size="sm" variant="danger" onClick={() => void deleteCredentials()}>
                Delete keys
              </Button>
            }
          />
        </div>
      </Section>

      {/* Appearance -------------------------------------------------------- */}
      <Section title="Appearance">
        <div className="divide-y divide-line">
          <Row
            title="Theme"
            control={
              <Segmented
                label="Theme"
                value={settings.theme}
                options={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' },
                ]}
                onChange={(value) => void patchSettings({ theme: value })}
              />
            }
          />
        </div>
      </Section>

    </div>
  );
}
