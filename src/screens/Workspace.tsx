import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Pause,
  Play,
  ShieldAlert,
  Square,
  X,
} from 'lucide-react';
import { followUpTask, useAgentStore } from '@/stores/agent';
import { formatUsd, hostnameOf } from '@/lib/utils';
import { Button, Spinner, StatusPill, StepMark, actionIcon } from '@/components/ui';

function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function Workspace() {
  const task = useAgentStore((s) => s.task);
  const steps = useAgentStore((s) => s.steps);
  const usage = useAgentStore((s) => s.usage);
  const live = useAgentStore((s) => s.live);
  const currentAction = useAgentStore((s) => s.currentAction);
  const approval = useAgentStore((s) => s.approval);
  const summary = useAgentStore((s) => s.summary);
  const error = useAgentStore((s) => s.error);
  const paused = useAgentStore((s) => s.paused);
  const screenshot = useAgentStore((s) => s.screenshot);
  const pause = useAgentStore((s) => s.pause);
  const resume = useAgentStore((s) => s.resume);
  const stop = useAgentStore((s) => s.stop);
  const resolveApproval = useAgentStore((s) => s.resolveApproval);
  const providers = useAgentStore((s) => s.providers);
  const settings = useAgentStore((s) => s.settings);

  const [followUp, setFollowUp] = useState('');
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const approvalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowAllSteps(false);
  }, [task?.id]);

  useEffect(() => {
    if (approval) approvalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [steps.length, summary, approval]);

  if (!task) return null;

  const visibleSteps = showAllSteps ? steps : steps.slice(-3);
  const hiddenSteps = steps.length - visibleSteps.length;
  const tokenCount = usage.inputTokens + usage.outputTokens;
  const costLabel = usage.costUsd !== undefined ? `${formatUsd(usage.costUsd)} est.` : 'cost n/a';

  const active = providers.find((p) => p.id === settings.activeProviderId);
  const busy = ['running', 'planning', 'waiting_for_approval'].includes(task.status);
  const terminal = ['completed', 'failed', 'cancelled'].includes(task.status);
  const progress = Math.min(100, Math.round((steps.length / Math.max(1, task.maxSteps)) * 100));

  const copySummary = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="scroll-thin relative h-full overflow-y-auto px-4 pb-6 pt-4">
      <div className="animate-rise">
        <div className="flex items-center justify-between gap-2">
          <StatusPill status={task.status} />
          <span className="text-[10.5px] text-[var(--faint)]">
            {steps.length}/{task.maxSteps} steps
          </span>
        </div>
        <h1 className="mt-2 text-[15px] font-medium leading-snug tracking-[-0.01em]">{task.objective}</h1>
        {task.model || active ? (
          <p className="mt-1 text-[11px] text-[var(--faint)]">
            {task.model ?? active?.model} · {costLabel}
          </p>
        ) : null}
        <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-[var(--panel-strong)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {busy || paused ? (
        <div className="mt-3 flex items-center gap-1.5">
          {paused || task.status === 'waiting_for_approval' ? (
            <Button size="sm" onClick={resume} disabled={!paused}>
              <Play size={12} /> Resume
            </Button>
          ) : (
            <Button size="sm" onClick={pause}>
              <Pause size={12} /> Pause
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={stop}>
            <Square size={11} /> Stop
          </Button>
          <span className="ml-auto text-[10.5px] text-[var(--faint)]">
            {paused ? 'Paused between actions' : 'Watching every action'}
          </span>
        </div>
      ) : null}

      {live || !terminal ? (
      <div className="mt-3 overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--panel)]">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-50" />
        <div className="flex items-center justify-between px-3.5 pt-2.5">
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${busy && !paused ? 'live-dot' : ''}`}
              style={{ background: busy && !paused ? 'var(--accent)' : 'var(--faint)' }}
            />
            {busy && !paused ? 'Live' : paused ? 'Paused' : 'Tab'}
          </span>
          <span className="text-[10px] text-[var(--faint)]">{live ? hostnameOf(live.url) : ''}</span>
        </div>
        <div className="px-3.5 pb-3 pt-1">
          <div className="truncate text-[13px] font-medium">{live?.title || 'Waiting for the page…'}</div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--faint)]">{live?.url ?? ''}</div>
          {currentAction ? (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-2 py-1.5 text-[11.5px] text-[var(--accent)]">
              <Spinner size={11} />
              <span className="truncate">{currentAction}</span>
            </div>
          ) : null}
        </div>
        {screenshot ? (
          <button onClick={() => setLightbox(true)} className="block w-full border-t border-[var(--border)]">
            <img
              src={screenshot}
              alt="Latest page screenshot"
              className="max-h-[160px] w-full object-cover object-top opacity-95 transition-opacity hover:opacity-100"
            />
          </button>
        ) : null}
      </div>
      ) : null}

      {approval ? (
        <div
          ref={approvalRef}
          className="mt-3 animate-rise rounded-[14px] border border-[rgba(255,200,97,0.32)] bg-[rgba(255,200,97,0.07)] p-3.5"
        >
          <div className="flex items-start gap-2">
            <ShieldAlert size={16} className="mt-[1px] shrink-0 text-[var(--warn)]" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium">{approval.title}</div>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--muted)]">{approval.detail}</p>
              {approval.origin ? (
                <p className="mt-1 truncate text-[10.5px] text-[var(--faint)]">{hostnameOf(approval.origin)}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => void resolveApproval(true)}>
              {approval.kind === 'scope' ? 'Allow this site' : 'Approve'}
            </Button>
            <Button size="sm" onClick={() => void resolveApproval(false)}>
              Deny
            </Button>
          </div>
        </div>
      ) : null}

      {steps.length > 0 ? (
        <section className="relative mt-5">
          <h2 className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--faint)]">
            Timeline
          </h2>
          {hiddenSteps > 0 || showAllSteps ? (
            <button
              onClick={() => setShowAllSteps((value) => !value)}
              className="mb-2.5 flex w-full items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-[10.5px] text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            >
              {showAllSteps ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showAllSteps
                ? 'Collapse earlier steps'
                : `Show ${hiddenSteps} earlier step${hiddenSteps === 1 ? '' : 's'}`}
            </button>
          ) : null}
          <div className="relative">
            <div className="timeline-line" />
            <ol className="space-y-3.5">
              {visibleSteps.map((step) => (
                <li key={step.id} className="relative pl-9">
                  <div className="absolute left-0 top-0">
                    <StepMark status={step.status} />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text)]">
                      <span className="text-[var(--faint)]">{actionIcon(step.action.type, 12)}</span>
                      <span className="line-clamp-2">{step.label}</span>
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] text-[var(--faint)]">{clock(step.at)}</span>
                  </div>
                  {step.reasoning ? (
                    <p className="mt-0.5 text-[11px] italic leading-snug text-[var(--faint)]">{step.reasoning}</p>
                  ) : null}
                  <p
                    className="mt-0.5 line-clamp-2 text-[11px] leading-snug"
                    style={{
                      color:
                        step.status === 'failed'
                          ? 'var(--danger)'
                          : step.status === 'rejected'
                            ? 'var(--warn)'
                            : 'var(--muted)',
                    }}
                  >
                    {step.result}
                  </p>
                  {step.image ? (
                    <img
                      src={step.image}
                      alt=""
                      className="mt-1.5 max-h-[110px] w-full rounded-[8px] border border-[var(--border)] object-cover object-top"
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {summary ? (
        <div className="mt-4 animate-rise rounded-[14px] border border-[rgba(70,211,154,0.25)] bg-[rgba(70,211,154,0.06)] p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-[var(--success)]">
              Result
            </span>
            <button
              onClick={() => void copySummary()}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-[var(--text)]">{summary}</p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 animate-rise rounded-[14px] border border-[rgba(255,107,107,0.28)] bg-[rgba(255,107,107,0.07)] p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <ShieldAlert size={15} className="mt-[1px] shrink-0 text-[var(--danger)]" />
              <p className="text-[12px] leading-relaxed text-[var(--text)]">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {terminal ? (
        <div className="mt-4">
          <div className="flex items-center gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--bg-elev)] px-2.5 py-1.5 focus-within:border-[var(--border-strong)]">
            <input
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && followUp.trim()) {
                  const text = followUp;
                  setFollowUp('');
                  void followUpTask(text);
                }
              }}
              placeholder="Ask a follow-up about this task…"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] placeholder:text-[var(--faint)]"
            />
            <Button
              size="sm"
              variant="primary"
              className="h-7 w-7 rounded-full p-0"
              disabled={!followUp.trim()}
              onClick={() => {
                const text = followUp;
                setFollowUp('');
                void followUpTask(text);
              }}
            >
              <ArrowUp size={13} strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between text-[10.5px] text-[var(--faint)]">
        <span>
          {tokenCount > 0
            ? `${tokenCount.toLocaleString()} tokens · ${costLabel}`
            : 'No model usage yet'}
        </span>
        <span>{live ? hostnameOf(live.url) : ''}</span>
      </div>

      <div ref={endRef} className="h-1" />

      {lightbox && screenshot ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-h-full w-full overflow-hidden rounded-[14px] border border-[var(--border-strong)]">
            <img src={screenshot} alt="Screenshot" className="max-h-[85vh] w-full object-contain" />
            <button
              onClick={() => setLightbox(false)}
              aria-label="Close"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
