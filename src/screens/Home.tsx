import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  ChevronRight,
  Globe,
  Plug,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useAgentStore } from '@/stores/agent';
import { getActiveTab, isRestrictedUrl } from '@/browser/tabs';
import { cn, greeting, hostnameOf, timeAgo } from '@/lib/utils';
import { Button, IconButton, StatusPill, providerName } from '@/components/ui';

const SUGGESTIONS = [
  'Compare the pricing pages of five SaaS products',
  'Find 20 remote product manager jobs and compile them',
  'Research the best wireless headphones under ₹15,000',
];

export function Home() {
  const startTask = useAgentStore((s) => s.startTask);
  const resumeTask = useAgentStore((s) => s.resumeTask);
  const setRoute = useAgentStore((s) => s.setRoute);
  const providers = useAgentStore((s) => s.providers);
  const settings = useAgentStore((s) => s.settings);
  const history = useAgentStore((s) => s.history);
  const checkpoint = useAgentStore((s) => s.checkpoint);
  const hasKey = useAgentStore((s) => s.hasKey);
  const openRecord = useAgentStore((s) => s.openRecord);
  const deleteRecord = useAgentStore((s) => s.deleteRecord);

  const [value, setValue] = useState('');
  const [tabInfo, setTabInfo] = useState<{ url?: string; title?: string } | null>(null);
  const [tabChecked, setTabChecked] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      const tab = await getActiveTab();
      if (disposed) return;
      setTabInfo(tab ? { url: tab.url, title: tab.title } : null);
      setTabChecked(true);
      const state = useAgentStore.getState();
      if (!isRestrictedUrl(tab?.url) && /blocks extensions|built-in pages/i.test(state.error ?? '')) {
        state.dismissError();
      }
    };
    void refresh();
    const onTabChanged = () => void refresh();
    const hasTabsApi = typeof chrome !== 'undefined' && !!chrome.tabs;
    if (hasTabsApi) {
      chrome.tabs.onActivated.addListener(onTabChanged);
      chrome.tabs.onUpdated.addListener(onTabChanged);
    }
    window.addEventListener('focus', onTabChanged);
    textareaRef.current?.focus();
    return () => {
      disposed = true;
      if (hasTabsApi) {
        chrome.tabs.onActivated.removeListener(onTabChanged);
        chrome.tabs.onUpdated.removeListener(onTabChanged);
      }
      window.removeEventListener('focus', onTabChanged);
    };
  }, []);

  const tabRestricted =
    typeof chrome !== 'undefined' && !!chrome.tabs && tabChecked && isRestrictedUrl(tabInfo?.url);

  const active = providers.find((p) => p.id === settings.activeProviderId) ?? providers[0];
  const ready = !!active && !!hasKey[active.id];
  const suggestion = useMemo(() => SUGGESTIONS[Math.floor(Date.now() / 60000) % SUGGESTIONS.length], []);
  const unfinished =
    checkpoint && ['running', 'paused', 'waiting_for_approval', 'failed'].includes(checkpoint.task.status)
      ? checkpoint
      : null;

  const submit = () => {
    if (!value.trim() || tabRestricted) return;
    const objective = value.trim();
    setValue('');
    void startTask(objective);
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto px-4 pb-8 pt-6">
      <div className="animate-rise">
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--faint)]">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="mt-1.5 text-[24px] font-semibold tracking-[-0.025em]">{greeting()}</h1>
        <p className="mt-1 text-[13.5px] text-[var(--muted)]">What should I do in your browser?</p>
      </div>

      <div className="card mt-5 overflow-hidden transition-colors duration-200 focus-within:border-[var(--border-strong)]">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder={suggestion}
          className="w-full bg-transparent px-3.5 pb-1 pt-3.5 text-[13.5px] leading-relaxed text-[var(--text)] placeholder:text-[var(--faint)]"
        />
        <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
          <div
            className="flex min-w-0 items-center gap-1.5 text-[11px]"
            style={{ color: tabRestricted ? 'var(--warn)' : 'var(--faint)' }}
          >
            <Globe size={12} className="shrink-0" />
            <span className="truncate">
              {tabRestricted
                ? 'Chrome page — not supported'
                : tabInfo?.url
                  ? hostnameOf(tabInfo.url)
                  : 'Current tab'}
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            aria-label="Start task"
            className="h-8 w-8 rounded-full p-0"
            onClick={submit}
            disabled={!value.trim() || !ready || tabRestricted}
            title={tabRestricted ? 'Open a website tab first' : 'Start task'}
          >
            <ArrowUp size={15} strokeWidth={2.5} />
          </Button>
        </div>
      </div>

      {tabRestricted ? (
        <div className="mt-2 flex items-start gap-1.5 rounded-[10px] border border-[rgba(255,200,97,0.28)] bg-[rgba(255,200,97,0.06)] px-2.5 py-2 text-[10.5px] leading-relaxed text-[var(--muted)]">
          <AlertTriangle size={12} className="mt-[1px] shrink-0 text-[var(--warn)]" />
          <span>
            ORBIT can’t run on Chrome’s built-in pages. Open a normal website tab — this panel follows the
            active tab automatically.
          </span>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUGGESTIONS.slice(0, 2).map((text) => (
          <button
            key={text}
            onClick={() => {
              setValue(text);
              textareaRef.current?.focus();
            }}
            className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-[11px] text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
          >
            {text}
          </button>
        ))}
      </div>

      {!ready ? (
        <button
          onClick={() => setRoute('settings')}
          className="card mt-4 flex w-full items-center gap-3 p-3 text-left transition-colors hover:border-[var(--border-strong)]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--accent-soft)] text-[var(--accent)]">
            <Plug size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-medium">
              {active ? 'Add your API key' : 'Connect a model'}
            </span>
            <span className="block truncate text-[11px] text-[var(--muted)]">
              Bring your own key — no account, no backend.
            </span>
          </span>
          <span className="text-[11px] text-[var(--accent)]">Set up</span>
        </button>
      ) : null}

      {unfinished ? (
        <div className="card mt-4 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
              <RotateCcw size={12} /> Unfinished task
            </span>
            <StatusPill status={unfinished.task.status} />
          </div>
          <p className="mt-1.5 line-clamp-2 text-[12.5px] text-[var(--text)]">{unfinished.task.objective}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-[var(--faint)]">
              {unfinished.steps.length} steps saved · {timeAgo(unfinished.savedAt)}
            </span>
            <Button size="sm" onClick={() => void resumeTask()}>
              Resume
            </Button>
          </div>
        </div>
      ) : null}

      {history.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--faint)]">Recent tasks</h2>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {history.slice(0, 5).map((record) => {
              const canOpen = (record.steps?.length ?? 0) > 0 || !!record.summary;
              return (
                <li key={record.id} className="group flex items-center gap-2.5 py-2.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      background:
                        record.status === 'completed'
                          ? 'var(--success)'
                          : record.status === 'failed'
                            ? 'var(--danger)'
                            : record.status === 'running'
                              ? 'var(--accent)'
                              : 'var(--faint)',
                    }}
                  />
                  <button
                    type="button"
                    disabled={!canOpen}
                    onClick={() => openRecord(record)}
                    title={canOpen ? 'Open this task' : 'Only a summary was kept for this task'}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-1.5 text-left',
                      canOpen ? 'transition-opacity hover:opacity-80' : 'cursor-default',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-[var(--text)]">{record.objective}</span>
                      <span className="block text-[10.5px] text-[var(--faint)]">
                        {timeAgo(record.completedAt ?? record.createdAt)} · {record.stepCount} steps
                        {record.model ? ` · ${record.model}` : ''}
                      </span>
                    </span>
                    {canOpen ? <ChevronRight size={13} className="shrink-0 text-[var(--faint)]" /> : null}
                  </button>
                  <IconButton
                    label="Delete task"
                    className="h-7 w-7 opacity-50 hover:opacity-100"
                    onClick={() => {
                      if (window.confirm(`Delete “${record.objective}”?`)) void deleteRecord(record.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="mt-7 flex items-start gap-2 text-[10.5px] leading-relaxed text-[var(--faint)]">
        <ShieldCheck size={13} className="mt-[1px] shrink-0" />
        <p>
          ORBIT acts in the tab you are watching and asks before anything sensitive. Your key stays in this
          browser and goes only to {active ? providerName(active.provider) : 'your provider'}.
        </p>
      </div>
    </div>
  );
}
