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
  Globe,
} from 'lucide-react';
import { followUpTask, useAgentStore } from '@/stores/agent';
import { formatUsd, hostnameOf } from '@/lib/utils';
import {
  AgentPhaseLabel,
  Button,
  RichText,
  StatusPill,
  TraceRow,
  actionIcon,
} from '@/components/ui';
import { AnswerBlocks } from '@/components/AnswerBlocks';
import { LiquidMultimodalInput } from '@/components/wensity/liquid-multimodal-input';

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
  /** Per-step open overrides; a step without one uses its default. */
  const [stepOpen, setStepOpen] = useState<Record<string, boolean>>({});
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
    <div className="relative flex h-full flex-col">
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
      <div className="animate-rise">
        <div className="flex items-baseline justify-between gap-3">
          <StatusPill status={task.status} />
          <span className="text-micro tabular-nums text-faint">
            {steps.length} of {task.maxSteps}
          </span>
        </div>
        <h1 className="mt-2.5 text-balance text-page font-semibold leading-[1.25] text-fg">
          {task.objective}
        </h1>
        <div className="mt-3 h-[2px] w-full overflow-hidden rounded-full bg-line">
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
      <div className="mt-3.5">
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
          <ol className="space-y-0.5">
            {visibleEntries.map((entry, entryIndex) =>
              entry.kind === 'turn' ? (
                <li key={`turn-${entryIndex}`} className="flex justify-end pb-1.5 pt-1">
                  <p className="glass max-w-[86%] rounded-2xl rounded-br-[6px] px-3 py-1.5 text-label leading-[1.5] text-fg">
                    {entry.text}
                  </p>
                </li>
              ) : (
                <li key={entry.step.id}>
                  <TraceRow
                    icon={actionIcon(entry.step.action.type, 12)}
                    title={entry.step.label}
                    meta={clock(entry.step.at)}
                    status={entry.step.status}
                    open={
                      stepOpen[entry.step.id] ??
                      (entry.step.status !== 'success' ||
                        (busy && entryIndex === visibleEntries.length - 1))
                    }
                    onToggle={() =>
                      setStepOpen((current) => ({
                        ...current,
                        [entry.step.id]:
                          !(
                            current[entry.step.id] ??
                            (entry.step.status !== 'success' ||
                              (busy && entryIndex === visibleEntries.length - 1))
                          ),
                      }))
                    }
                  >
                    {entry.step.reasoning ? (
                      <p className="text-caption italic leading-snug text-faint">
                        {entry.step.reasoning}
                      </p>
                    ) : null}
                    <p
                      className="mt-0.5 text-caption leading-snug"
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
                  </TraceRow>
                </li>
              ),
            )}
          </ol>
        </section>
      ) : null}

      {summary ? (
        // The answer is the reply, not a section: plain text at reading size,
        // with the actions above it collapsed to single lines.
        <div className="group mt-3.5 animate-rise">
          <div className="flex items-start gap-2">
            <RichText text={summary} className="min-w-0 flex-1" />
            <button
              onClick={() => void copySummary()}
              aria-label="Copy answer"
              className="mt-0.5 flex shrink-0 items-center gap-1 rounded-sm px-1 text-caption text-faint opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
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



      <div ref={endRef} className="h-1" />
      </div>

      {/* The ramp starts at the panel floor and rises behind the composer; the
          layered masks live in .progressive-blur. */}
      <div aria-hidden className="progressive-blur">
        <div />
        <div />
        <div />
        <div />
      </div>

      {terminal ? (
        <div className="relative z-[1] shrink-0 px-4 pb-3 pt-3">
          <LiquidMultimodalInput
            value={followUp}
            onChange={setFollowUp}
            onSubmit={(text) => {
              if (!text.trim()) return;
              setFollowUp('');
              void followUpTask(text.trim());
            }}
            placeholder="Ask a follow-up"
            maxHeight={120}
            hideModel
            context={
              <span className="flex min-w-0 items-center gap-1.5 px-1 text-caption text-faint">
                <Globe size={12} className="shrink-0" aria-hidden />
                <span className="truncate">{live?.url ? hostnameOf(live.url) : 'Current tab'}</span>
              </span>
            }
          />
          <div className="mt-1.5 flex items-center justify-between text-micro text-faint">
            <span title={cacheDetail}>
              {tokenCount > 0
                ? `${tokenCount.toLocaleString()} tokens · ${costLabel}${
                    cacheRate !== null ? ` · ${cacheRate}% cached` : ''
                  }`
                : 'No model usage yet'}
            </span>
          </div>
        </div>
      ) : null}

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
