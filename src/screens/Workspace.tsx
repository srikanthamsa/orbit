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
import { AgentPhaseLabel, Button, RichText, StatusPill, StepMark, actionIcon } from '@/components/ui';
import { AnswerBlocks } from '@/components/AnswerBlocks';

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
  const summaryBlocks = useAgentStore((s) => s.summaryBlocks);
  const cacheTurns = useAgentStore((s) => s.cacheTurns);
  const error = useAgentStore((s) => s.error);
  const paused = useAgentStore((s) => s.paused);
  const screenshot = useAgentStore((s) => s.screenshot);
  const pause = useAgentStore((s) => s.pause);
  const resume = useAgentStore((s) => s.resume);
  const stop = useAgentStore((s) => s.stop);
  const continueTask = useAgentStore((s) => s.resumeTask);
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

  // One conversation: the user's follow-ups interleave with the agent's steps.
  const entries = [
    ...(task.turns ?? []).map((turn) => ({ kind: 'turn' as const, at: turn.at, text: turn.text })),
    ...steps.map((step) => ({ kind: 'step' as const, at: step.at, step })),
  ].sort((a, b) => a.at - b.at);
  const visibleEntries = showAllSteps ? entries : entries.slice(-3);
  const hiddenEntries = entries.length - visibleEntries.length;
  const tokenCount = usage.inputTokens + usage.outputTokens;
  const cacheHit = cacheTurns.reduce((sum, turn) => sum + turn.hit, 0);
  const cacheMiss = cacheTurns.reduce((sum, turn) => sum + turn.miss, 0);
  const cacheRate = cacheHit + cacheMiss > 0 ? Math.round((cacheHit / (cacheHit + cacheMiss)) * 100) : null;
  const cacheDetail = cacheTurns
    .map((turn) => `step ${turn.turn + 1}: ${turn.hit} hit / ${turn.miss} miss${turn.attempt ? ' (retry)' : ''}`)
    .join('\n');
  const costLabel = usage.costUsd !== undefined ? `${formatUsd(usage.costUsd)} est.` : 'cost n/a';

  const active = providers.find((p) => p.id === settings.activeProviderId);
  const busy = ['running', 'planning', 'waiting_for_approval'].includes(task.status);
  const terminal = ['completed', 'failed', 'cancelled'].includes(task.status);
  const awaitingDecision = task.status === 'waiting_for_approval';
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
          <span className="text-micro text-faint">
            {steps.length}/{task.maxSteps} steps
          </span>
        </div>
        <h1 className="mt-2 text-title font-medium text-fg">{task.objective}</h1>
        {task.model || active ? (
          <p className="mt-1 text-caption text-faint">
            {task.model ?? active?.model} · {costLabel}
          </p>
        ) : null}
        <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {awaitingDecision || paused || busy ? (
        <div className="mt-3">
          <div className="flex items-center gap-1.5">
            {awaitingDecision ? null : paused ? (
              <Button size="sm" onClick={resume}>
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
          </div>
          {/* The action gets its own line: a shimmering sentence needs room. */}
          <div className="mt-1.5 min-w-0">
            <AgentPhaseLabel
              phase={awaitingDecision ? 'waiting' : paused ? 'paused' : currentAction ? 'working' : 'thinking'}
              detail={busy && !paused && !awaitingDecision ? currentAction ?? undefined : undefined}
              wide
            />
          </div>
        </div>
      ) : null}

      {live || !terminal ? (
      <div className="mt-3.5 border-t border-line pt-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${busy && !paused ? 'live-dot' : ''}`}
            style={{ background: busy && !paused ? 'var(--accent)' : 'var(--faint)' }}
          />
          <span className="min-w-0 flex-1 truncate text-label text-fg" title={live?.url}>
            {live?.title || 'Waiting for the page…'}
          </span>
          <span className="shrink-0 text-micro text-faint">{live ? hostnameOf(live.url) : ''}</span>
        </div>
        {screenshot ? (
          <button
            onClick={() => setLightbox(true)}
            className="focus-ring mt-2 block w-full overflow-hidden rounded-sm border border-line"
          >
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
          className="mt-3.5 animate-rise border-l-2 border-warn-line pl-3"
        >
          <div className="flex items-start gap-2">
            <ShieldAlert size={16} className="mt-[1px] shrink-0 text-[var(--warn)]" />
            <div className="min-w-0">
              <div className="text-body font-medium">{approval.title}</div>
              <p className="mt-0.5 text-caption leading-[1.45] text-muted">{approval.detail}</p>
              {approval.origin ? (
                <p className="mt-1 truncate text-micro text-faint">{hostnameOf(approval.origin)}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => void resolveApproval(true)}>
              {approval.kind === 'scope' ? 'Allow this site' : 'Approve'}
            </Button>
            <Button size="sm" onClick={() => void resolveApproval(false)}>
              Deny
            </Button>
          </div>
        </div>
      ) : null}

      {entries.length > 0 ? (
        <section className="relative mt-5">
          <h2 className="mb-2 text-label font-medium text-muted">
            Timeline
          </h2>
          {hiddenEntries > 0 || showAllSteps ? (
            <button
              onClick={() => setShowAllSteps((value) => !value)}
              className="focus-ring-inset mb-2.5 flex w-full items-center gap-1.5 rounded-sm px-1 py-1 text-micro text-muted transition-colors hover:bg-surface hover:text-fg"
            >
              {showAllSteps ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showAllSteps
                ? 'Collapse earlier'
                : `Show ${hiddenEntries} earlier`}
            </button>
          ) : null}
          <div className="relative">
            <div className="timeline-line" />
            <ol className="space-y-3.5">
              {visibleEntries.map((entry, entryIndex) =>
                entry.kind === 'turn' ? (
                  <li key={`turn-${entryIndex}`} className="relative pl-9">
                    <span
                      aria-hidden
                      className="absolute left-[6px] top-[7px] h-2 w-2 rounded-full bg-accent ring-2 ring-canvas"
                    />
                    <p className="text-label font-medium text-accent">
                      You
                    </p>
                    <p className="mt-0.5 text-label leading-[1.5] text-fg">{entry.text}</p>
                  </li>
                ) : (
                  <li key={entry.step.id} className="relative pl-9">
                    <div className="absolute left-0 top-0">
                      <StepMark status={entry.step.status} />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="flex items-center gap-1.5 text-label font-medium text-fg">
                        <span className="text-faint">{actionIcon(entry.step.action.type, 12)}</span>
                        <span className="line-clamp-2">{entry.step.label}</span>
                      </span>
                      <span className="ml-auto shrink-0 text-micro text-faint">
                        {clock(entry.step.at)}
                      </span>
                    </div>
                    {entry.step.reasoning ? (
                      <p className="mt-0.5 text-caption italic leading-snug text-faint">
                        {entry.step.reasoning}
                      </p>
                    ) : null}
                    <p
                      className="mt-0.5 line-clamp-2 text-caption leading-snug"
                      style={{
                        color:
                          entry.step.status === 'failed'
                            ? 'var(--danger)'
                            : entry.step.status === 'rejected'
                              ? 'var(--warn)'
                              : 'var(--muted)',
                      }}
                    >
                      {entry.step.result}
                    </p>
                    {entry.step.image ? (
                      <img
                        src={entry.step.image}
                        alt=""
                        className="mt-1.5 max-h-[110px] w-full rounded-sm border border-line object-cover object-top"
                      />
                    ) : null}
                  </li>
                ),
              )}
            </ol>
          </div>
        </section>
      ) : null}

      {summary ? (
        <div className="mt-4 animate-rise border-l-2 border-success-line pl-3">
          <div className="flex items-center justify-between">
            <span className="text-label font-medium text-success">
              Result
            </span>
            <button
              onClick={() => void copySummary()}
              className="flex items-center gap-1 rounded-sm px-1.5 text-caption text-muted transition-colors hover:text-fg"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <RichText text={summary} className="mt-1.5" />
          {summaryBlocks?.length ? <AnswerBlocks blocks={summaryBlocks} className="mt-3" /> : null}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 animate-rise border-l-2 border-danger-line pl-3">
          <p className="flex items-start gap-1.5 text-label leading-[1.55] text-fg">
            <ShieldAlert size={12} aria-hidden className="mt-[3px] shrink-0 text-[var(--danger)]" />
            <span>{error}</span>
          </p>
          {task.status !== 'completed' ? (
            <div className="mt-2.5 flex items-center gap-2">
              <Button size="sm" variant="primary" onClick={() => void continueTask()}>
                <Play size={11} /> Continue
              </Button>
              <span className="text-micro text-faint">
                Ten more steps from where it stopped.
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {terminal ? (
        <div className="mt-4">
          <div className="flex items-center gap-2 rounded-sm border border-line px-2 py-1 transition-colors focus-within:border-accent-line">
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
              placeholder="Ask a follow-up"
              className="min-w-0 flex-1 bg-transparent text-label placeholder:text-faint"
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

      <div className="mt-4 flex items-center justify-between text-micro text-faint">
        <span title={cacheDetail}>
          {tokenCount > 0
            ? `${tokenCount.toLocaleString()} tokens · ${costLabel}${
                cacheRate !== null ? ` · ${cacheRate}% cached` : ''
              }`
            : 'No model usage yet'}
        </span>

      </div>

      <div ref={endRef} className="h-1" />

      {lightbox && screenshot ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-h-full w-full overflow-hidden rounded-lg border border-line-strong">
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
