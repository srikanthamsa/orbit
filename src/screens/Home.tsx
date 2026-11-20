import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  CornerDownLeft,
  Globe,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useAgentStore } from '@/stores/agent';
import { getActiveTab, isRestrictedUrl } from '@/browser/tabs';
import { cn, greeting, greetingPrompt, hostnameOf, timeAgo } from '@/lib/utils';
import { Button, IconButton, StatusDot, StatusPill, statusLabel } from '@/components/ui';
import { ConnectModel } from '@/screens/ConnectModel';
import { LiquidMultimodalInput } from '@/components/wensity/liquid-multimodal-input';

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
  const suggestion = useMemo(
    () => SUGGESTIONS[Math.floor(Date.now() / 60000) % SUGGESTIONS.length],
    [],
  );
  const unfinished =
    checkpoint && ['running', 'paused', 'waiting_for_approval', 'failed'].includes(checkpoint.task.status)
      ? checkpoint
      : null;

  const fillSuggestion = (text: string) => {
    setValue(text);
  };

  // First run, or the key was removed: no composer until a model can answer.
  if (!ready) {
    return <ConnectModel provider={active?.provider} onConnect={() => setRoute('settings')} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
        <div className="flex min-h-full w-full flex-col">
          <div className="animate-rise flex flex-1 flex-col justify-center py-6 text-center">
            <p className="text-caption font-medium text-muted">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <h1 className="mt-2.5 text-balance text-display font-semibold text-fg">
              {greeting()}
            </h1>
            <p className="mt-1.5 text-title leading-[1.35] text-muted">
              {greetingPrompt()}
            </p>
          </div>

          {unfinished ? (
            <div className="mt-5 border-l-2 border-accent-line pl-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-label font-medium text-accent">
                  <RotateCcw size={11} aria-hidden />
                  Unfinished
                </span>
                <StatusPill status={unfinished.task.status} />
              </div>
              <p className="mt-1.5 line-clamp-2 text-label leading-[1.45] text-fg">
                {unfinished.task.objective}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-caption text-muted">
                  {unfinished.steps.length} steps · {timeAgo(unfinished.savedAt)}
                </span>
                <Button size="sm" onClick={() => void resumeTask()}>
                  Resume
                </Button>
              </div>
            </div>
          ) : null}

          {history.length > 0 ? (
            <section className="mt-6 pb-4">
              <div className="flex items-baseline justify-between gap-2 px-0.5">
                <h2 className="text-label font-medium text-muted">
                  Recent
                </h2>
                <span className="text-micro tabular-nums text-faint">{history.length}</span>
              </div>
              <ul className="mt-1">
                {history.slice(0, 5).map((record) => {
                  const canOpen = (record.steps?.length ?? 0) > 0 || !!record.summary;
                  return (
                    <li
                      key={record.id}
                      className={cn(
                        'group -mx-2 flex items-start gap-2 rounded-md px-2 py-2 transition-colors',
                        'hover:bg-surface focus-within:bg-surface',
                      )}
                    >
                      <StatusDot status={record.status} className="mt-[6px] shrink-0" />
                      <button
                        type="button"
                        disabled={!canOpen}
                        onClick={() => openRecord(record)}
                        title={canOpen ? 'Open this task' : 'Only a summary was kept for this task'}
                        className={cn(
                          'focus-ring-inset min-w-0 flex-1 rounded-sm text-left',
                          canOpen ? 'cursor-pointer' : 'cursor-default',
                        )}
                      >
                        <span className="block truncate text-label text-fg">{record.objective}</span>
                        <span className="mt-0.5 block truncate text-micro text-faint">
                          {statusLabel(record.status)} · {record.stepCount}{' '}
                          {record.stepCount === 1 ? 'step' : 'steps'} ·{' '}
                          {timeAgo(record.completedAt ?? record.createdAt)}
                        </span>
                      </button>
                      <IconButton
                        label="Delete"
                        className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                        onClick={() => void deleteRecord(record.id)}
                      >
                        <Trash2 size={12} />
                      </IconButton>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      {/* Dock: the composer lives at the bottom edge, like a chat box. */}
      <div className="shrink-0 border-t border-line px-3 pb-3 pt-2">
        {!value.trim() && history.length === 0 ? (
          <div className="mb-1 flex flex-col">
            {SUGGESTIONS.filter((text) => text !== suggestion)
              .slice(0, 2)
              .map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => fillSuggestion(text)}
                  className="focus-ring-inset group flex items-start gap-2 rounded-sm px-1 py-1.5 text-left transition-colors hover:bg-surface"
                >
                  <CornerDownLeft
                    size={11}
                    aria-hidden
                    className="mt-[3px] shrink-0 text-faint transition-colors group-hover:text-muted"
                  />
                  <span className="min-w-0 text-caption leading-[1.4] text-muted transition-colors group-hover:text-fg">
                    {text}
                  </span>
                </button>
              ))}
          </div>
        ) : null}

        <LiquidMultimodalInput
          value={value}
          onChange={setValue}
          onSubmit={(text) => {
            if (tabRestricted || !text.trim()) return;
            setValue('');
            void startTask(text.trim());
          }}
          placeholder={suggestion}
          maxHeight={140}
          autoFocus
          hideModel
          context={
            <span
              className={cn(
                'flex min-w-0 items-center gap-1.5 px-1 text-caption',
                tabRestricted ? 'text-warn' : 'text-faint',
              )}
            >
              <Globe size={12} className="shrink-0" aria-hidden />
              <span className="truncate">
                {tabRestricted
                  ? 'Chrome page — not supported'
                  : tabInfo?.url
                    ? hostnameOf(tabInfo.url)
                    : 'Current tab'}
              </span>
            </span>
          }
        />

        {tabRestricted ? (
          <p className="mt-2 flex items-start gap-1.5 px-0.5 text-caption leading-[1.45] text-warn">
            <AlertTriangle size={11} className="mt-[2px] shrink-0" aria-hidden />
            <span>
              ORBIT can’t run on Chrome’s built-in pages. Open a normal website tab — this panel
              follows the active tab automatically.
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
