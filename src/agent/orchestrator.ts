import type {
  AgentStatus,
  AgentStep,
  AgentTask,
  ApprovalRequest,
  BrowserAction,
  InteractiveElement,
  PageSnapshot,
  ProviderConfig,
  Settings,
  TaskCheckpoint,
  Usage,
} from '@/types';
import { describeAction } from '@/types/actions';
import { addUsage } from '@/providers/pricing';
import { buildInitialMessage, digestSnapshot } from '@/providers/prompt';
import { requestAction } from '@/providers';
import type { PromptStep } from '@/providers/types';
import { captureSnapshot, pageActiveElement, pageClick, pageClickAt, pageElementAt, pageFind, pagePressKey, pageScroll, pageType } from '@/browser/dom';
import { captureScreenshot } from '@/browser/screenshot';
import { setControlOverlay } from '@/browser/control';
import { focusTab, getTab, isRestrictedUrl, navigateAndSettle } from '@/browser/tabs';
import { hasOriginAccess } from '@/browser/permissions';
import { assessAction } from '@/safety/policy';
import { capabilitiesFor } from '@/providers/capabilities';
import { hostnameOf, isAbortError, sleepAbortable, truncate, uid } from '@/lib/utils';

export interface TaskControls {
  signal: AbortSignal;
  waitWhilePaused(): Promise<void>;
  requestApproval(request: ApprovalRequest): Promise<boolean>;
}

export type AgentEvent =
  | { type: 'status'; status: AgentStatus }
  | { type: 'live'; url: string; title: string }
  | { type: 'action'; label: string; index: number }
  | { type: 'step'; step: AgentStep }
  | { type: 'screenshot'; dataUrl: string }
  | { type: 'usage'; usage: Usage }
  | { type: 'checkpoint'; checkpoint: TaskCheckpoint };

export interface RunInput {
  task: AgentTask;
  provider: ProviderConfig;
  apiKey: string;
  settings: Settings;
  tabId: number;
  steps: AgentStep[];
  usage: Usage;
  controls: TaskControls;
  emit: (event: AgentEvent) => void;
}

export interface RunOutcome {
  status: 'completed' | 'failed' | 'cancelled';
  summary?: string;
  error?: string;
  steps: AgentStep[];
  usage: Usage;
}

const MAX_DURATION_MS = 15 * 60 * 1000;

async function observeWithRetry(tabId: number, attempts = 3): Promise<PageSnapshot> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await captureSnapshot(tabId);
    } catch (err) {
      lastError = err;
      await sleepAbortable(500, undefined);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not read the page.');
}

async function ensurePageAccess(
  tabId: number,
  controls: TaskControls,
  emit: (event: AgentEvent) => void,
  stepIndex: number,
): Promise<void> {
  const tab = await getTab(tabId);
  if (!tab?.url) throw new Error('The tab is no longer available.');
  if (isRestrictedUrl(tab.url)) {
    throw new Error('Chrome blocks extensions on this page. Switch to a regular website and try again.');
  }
  if (await hasOriginAccess(tab.url)) return;

  emit({ type: 'status', status: 'waiting_for_approval' });
  const allowed = await controls.requestApproval({
    id: uid('approval'),
    kind: 'scope',
    title: `Allow ORBIT on ${hostnameOf(tab.url)}?`,
    detail:
      'ORBIT needs access to this site to read and interact with it. Chrome will show its own prompt next — choose Allow. To avoid per-site prompts, enable Settings → Browser access → Allow all sites.',
    origin: tab.url,
    stepIndex,
  });
  emit({ type: 'status', status: 'running' });
  if (!allowed || !(await hasOriginAccess(tab.url))) {
    throw new Error(`Access to ${hostnameOf(tab.url)} was not granted.`);
  }
}

interface ExecutionResult {
  ok: boolean;
  message: string;
  image?: string;
}

async function executeAction(tabId: number, action: BrowserAction, signal: AbortSignal): Promise<ExecutionResult> {
  if (action.type === 'navigate') {
    await focusTab(tabId);
    await navigateAndSettle(tabId, action.url, signal, 600);
    return { ok: true, message: `Navigated to ${truncate(action.url, 120)}.` };
  }
  if (action.type === 'click') return pageClick(tabId, action.elementId);
  if (action.type === 'type') return pageType(tabId, action.elementId, action.text);
  if (action.type === 'scroll') return pageScroll(tabId, action.direction, action.amount ?? 600);
  if (action.type === 'press_key') return pagePressKey(tabId, action.key);
  if (action.type === 'click_at') return pageClickAt(tabId, action.x, action.y);
  if (action.type === 'find') {
    const found = await pageFind(tabId, action.query, action.role, action.limit);
    if (found.matches.length === 0) return { ok: true, message: found.message };
    const lines = found.matches.map((match) => {
      const bits = [`- ${match.id} <${match.role ?? match.tag}> “${truncate(match.name, 100)}”`];
      if (match.disabled) bits.push('[disabled]');
      if (!match.inViewport) bits.push('[offscreen]');
      if (match.inForm) bits.push('[in-form]');
      return bits.join(' ');
    });
    return { ok: true, message: `${found.message}\n${lines.join('\n')}` };
  }
  if (action.type === 'batch') {
    const parts: string[] = [];
    let ok = true;
    for (const step of action.actions) {
      const result = await executeAction(tabId, step as BrowserAction, signal);
      parts.push(`${describeAction(step as BrowserAction)}: ${result.message}`);
      if (!result.ok) {
        ok = false;
        break;
      }
      await sleepAbortable(250, signal);
    }
    return { ok, message: parts.join('\n') };
  }
  if (action.type === 'screenshot') {
    await focusTab(tabId);
    await setControlOverlay(tabId, { state: 'hidden' });
    try {
      // Let the hidden frame paint before Chrome captures it.
      await sleepAbortable(80, signal);
      const dataUrl = await captureScreenshot();
      return { ok: true, message: 'Captured a screenshot of the visible tab.', image: dataUrl };
    } finally {
      await setControlOverlay(tabId, { state: 'working' });
    }
  }
  if (action.type === 'wait') {
    await sleepAbortable(action.duration, signal);
    return { ok: true, message: `Waited ${action.duration}ms.` };
  }
  return { ok: false, message: 'Unsupported action.' };
}

function toPromptSteps(steps: AgentStep[]): PromptStep[] {
  const recent = steps.slice(-6);
  return recent.map((step, index) => ({
    id: step.id,
    action: step.action,
    reasoning: step.reasoning,
    providerReasoning: step.providerReasoning,
    result: `${step.result}${step.status === 'rejected' ? ' (denied by user)' : ''}`,
    // Only the newest observations need full page detail; trimming older ones
    // keeps long DeepSeek runs from re-sending hundreds of thousands of tokens.
    observation:
      index >= recent.length - 2 ? step.observation : `${step.observation.slice(0, 600)}…`,
    image: step.image,
    status: step.status,
  }));
}

function findTarget(action: BrowserAction, snapshot: PageSnapshot): InteractiveElement | undefined {
  if (action.type !== 'click' && action.type !== 'type') return undefined;
  return snapshot.elements.find((el) => el.id === action.elementId);
}

function cursorForAction(
  action: BrowserAction,
  target: InteractiveElement | undefined,
  snapshot: PageSnapshot,
  label: string,
): { x: number; y: number; label: string; pressed: boolean } | undefined {
  if (action.type === 'click_at') {
    return {
      x: action.x * snapshot.viewport.width,
      y: action.y * snapshot.viewport.height,
      label,
      pressed: true,
    };
  }
  if (action.type === 'batch') {
    for (const step of action.actions) {
      if (step.type !== 'click' && step.type !== 'type') continue;
      const found = snapshot.elements.find((el) => el.id === step.elementId);
      if (!found) continue;
      const box = found.boundingBox;
      return {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        label,
        pressed: true,
      };
    }
    return undefined;
  }
  if ((action.type === 'click' || action.type === 'type') && target) {
    const box = target.boundingBox;
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
      label,
      pressed: true,
    };
  }
  return undefined;
}

function fingerprintOf(snapshot: PageSnapshot): string {
  const elements = snapshot.elements
    .slice(0, 60)
    .map(
      (el) =>
        `${el.tag}:${el.accessibleName || el.text || ''}:${el.value ?? ''}:${el.checked ?? ''}:${
          el.disabled ? 'x' : 'o'
        }`,
    )
    .join('|');
  return `${snapshot.url}##${(snapshot.signals ?? []).join(';')}##${elements}`;
}

/**
 * Conditions where no model decision can help: the page itself is blocking the
 * task. Stop deterministically and tell the user what to do next.
 */
function blockerSummary(snapshot: PageSnapshot, objective: string): string | null {
  const signals = snapshot.signals ?? [];
  if (signals.some((signal) => /captcha/i.test(signal))) {
    return 'A CAPTCHA/human-verification challenge is blocking this page. Complete it in the tab, then resume the task — ORBIT cannot solve it for you.';
  }
  if (signals.some((signal) => /requires the user to sign in/i.test(signal))) {
    return 'This page requires you to sign in before it can continue. Sign in in the tab, then resume the task.';
  }
  const purchaseIntent = /\b(add|buy|purchase|cart|checkout|order)\b/i.test(objective);
  const outOfStock = signals.find((signal) => signal.startsWith('OUT OF STOCK'));
  const looksLikeProductPage = /\/(p|dp|product|itm|item)\//i.test(snapshot.url);
  if (purchaseIntent && outOfStock && looksLikeProductPage) {
    const product = snapshot.title.split(/[|–—]/)[0].trim() || hostnameOf(snapshot.url);
    return `${product} is out of stock. The page shows “Notify Me” instead of “Add to cart”, so it cannot be added to the cart right now.`;
  }
  return null;
}

export async function runAgent(input: RunInput): Promise<RunOutcome> {
  const { task, provider, apiKey, settings, tabId, controls, emit } = input;
  const steps: AgentStep[] = [...input.steps];
  let usage = input.usage;
  const startedAt = Date.now();
  const capabilities = capabilitiesFor(provider);
  let captureBlocked = false;
  let onPageHide: (() => void) | null = null;

  const checkpoint = (status: AgentStatus) => {
    const now = Date.now();
    emit({
      type: 'checkpoint',
      checkpoint: {
        task: { ...task, status, currentStep: steps.length, updatedAt: now },
        steps: steps.map((s) => ({ ...s, image: undefined })),
        usage,
        providerConfigId: provider.id,
        tabId,
        savedAt: now,
      },
    });
  };

  try {
    emit({ type: 'status', status: 'running' });

    if (steps.length === 0) await ensurePageAccess(tabId, controls, emit, 0);
    await setControlOverlay(tabId, { state: 'working' });
    const onHide = () => {
      void setControlOverlay(tabId, { state: 'off' });
    };
    onPageHide = onHide;
    if (typeof window !== 'undefined') window.addEventListener('pagehide', onHide);
    let firstMessage: string | null = null;
    let stallNotice: string | null = null;
    let stallCount = 0;
    let noProgressStreak = 0;
    let lastActionSignature = '';
    let repeatedActions = 0;
    let scrollHistory: Array<'up' | 'down'> = [];
    let coordinateClicks = 0;

    for (let index = steps.length; index < settings.maxSteps; index++) {
      await controls.waitWhilePaused();
      if (controls.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (Date.now() - startedAt > MAX_DURATION_MS) {
        throw new Error('This task has been running for 15 minutes. Pausing here so you can review progress.');
      }
      if (usage.costUsd !== undefined && settings.maxCostUsd > 0 && usage.costUsd >= settings.maxCostUsd) {
        throw new Error(`Task budget reached (${usage.costUsd.toFixed(3)} USD). Raise the budget in Settings to continue.`);
      }

      const tab = await getTab(tabId);
      if (!tab) throw new Error('The tab was closed. Open a new tab and start again.');
      await ensurePageAccess(tabId, controls, emit, index);
      await setControlOverlay(tabId, { state: 'working' });

      const snapshot = await observeWithRetry(tabId);
      emit({ type: 'live', url: snapshot.url, title: snapshot.title });

      // Deterministic stop when the page itself blocks the task (stock,
      // CAPTCHA, sign-in). No amount of model reasoning gets past these.
      const blocker = blockerSummary(snapshot, task.objective);
      if (blocker) {
        checkpoint('completed');
        return { status: 'completed', summary: blocker, steps, usage };
      }

      emit({ type: 'status', status: 'planning' });

      if (!firstMessage) firstMessage = buildInitialMessage(task.objective, snapshot);
      const initialMessage = steps.length === 0 ? firstMessage : `OBJECTIVE: ${task.objective}`;

      let outcome: Awaited<ReturnType<typeof requestAction>> | null = null;
      let correction: string | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          outcome = await requestAction({
            config: provider,
            apiKey,
            initialMessage,
            steps: toPromptSteps(steps),
            correction: [stallNotice, correction].filter(Boolean).join('\n\n') || undefined,
            signal: controls.signal,
          });
          break;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const retryable = /invalid action|did not return an action/i.test(message);
          if (retryable && attempt === 0) {
            correction = `${message} Return one corrected ${'orbit_action'} call.`;
            continue;
          }
          throw err;
        }
      }
      if (!outcome) throw new Error('The model did not produce an action.');
      stallNotice = null;
      usage = addUsage(usage, outcome.usage, provider.model);
      emit({ type: 'usage', usage });

      const action = outcome.action;
      if (action.type === 'finish') {
        const summary = truncate(action.summary.trim(), 6000);
        checkpoint('completed');
        return { status: 'completed', summary, steps, usage };
      }

      const target = findTarget(action, snapshot);
      const label = describeAction(action, target?.accessibleName || target?.text);
      emit({ type: 'action', label, index });
      emit({ type: 'status', status: 'running' });

      let coordinatesTarget: { tag: string; type?: string; label: string; inForm: boolean } | null = null;
      let focusedElement: { inForm: boolean } | null = null;
      if (action.type === 'click_at') coordinatesTarget = await pageElementAt(tabId, action.x, action.y);
      if (action.type === 'press_key') {
        const active = await pageActiveElement(tabId);
        focusedElement = active ? { inForm: active.inForm } : null;
      }

      const risk = assessAction({
        action,
        target,
        coordinatesTarget: coordinatesTarget
          ? { ...coordinatesTarget, accessibleName: coordinatesTarget.label }
          : null,
        focusedElement,
        mode: settings.approvalMode,
      });

      const batchRisks =
        action.type === 'batch'
          ? action.actions.map((step) => {
              const stepTarget = findTarget(step as BrowserAction, snapshot);
              return {
                step,
                target: stepTarget,
                risk: assessAction({
                  action: step as BrowserAction,
                  target: stepTarget,
                  focusedElement: null,
                  mode: settings.approvalMode,
                }),
              };
            })
          : [];
      const batchApprovals = batchRisks.filter((item) => item.risk?.requiresApproval);

      let status: AgentStep['status'] = 'success';
      let resultMessage = '';
      let image: string | undefined;
      let approvedThisStep = false;

      if (action.type === 'navigate' && !(await hasOriginAccess(action.url))) {
        emit({ type: 'status', status: 'waiting_for_approval' });
        const allowed = await controls.requestApproval({
          id: uid('approval'),
          kind: 'scope',
          title: `Allow ORBIT on ${hostnameOf(action.url)}?`,
          detail:
            'This task needs access to a new site. Chrome will show its own prompt next — choose Allow. Enable Settings → Browser access → Allow all sites to avoid these prompts.',
          origin: action.url,
          stepIndex: index,
        });
        emit({ type: 'status', status: 'running' });
        approvedThisStep = true;
        if (!allowed || !(await hasOriginAccess(action.url))) {
          status = 'rejected';
          resultMessage = 'The user did not allow access to the destination site. Choose another site or finish.';
        }
      }

      if (
        status === 'success' &&
        action.type === 'batch' &&
        batchApprovals.length > 1 &&
        settings.approvalMode !== 'all'
      ) {
        status = 'failed';
        resultMessage =
          'This batch contains more than one action that needs approval. Split it so each sensitive action is approved separately.';
      }

      if (
        status === 'success' &&
        action.type === 'batch' &&
        batchApprovals.length > 0 &&
        !approvedThisStep
      ) {
        const primary = batchApprovals[0].risk!;
        const stepLabels = action.actions.map((step) => {
          const stepTarget = findTarget(step as BrowserAction, snapshot);
          return describeAction(step as BrowserAction, stepTarget?.accessibleName || stepTarget?.text);
        });
        emit({ type: 'status', status: 'waiting_for_approval' });
        const approved = await controls.requestApproval({
          id: uid('approval'),
          kind: 'sensitive',
          title:
            settings.approvalMode === 'all'
              ? `Approve ${action.actions.length} actions?`
              : primary.actionLabel || label,
          detail: `This batch will: ${stepLabels.join(' → ')}. ${primary.reason}`,
          origin: snapshot.url,
          actionLabel: label,
          stepIndex: index,
        });
        emit({ type: 'status', status: 'running' });
        approvedThisStep = true;
        if (!approved) {
          status = 'rejected';
          resultMessage =
            'The user denied this batch. Do not repeat those actions; choose a different approach or finish.';
        }
      }

      if (status === 'success' && risk?.requiresApproval && !approvedThisStep) {
        emit({ type: 'status', status: 'waiting_for_approval' });
        const approved = await controls.requestApproval({
          id: uid('approval'),
          kind: 'sensitive',
          title: risk.actionLabel || label,
          detail: risk.reason,
          origin: snapshot.url,
          actionLabel: label,
          stepIndex: index,
        });
        emit({ type: 'status', status: 'running' });
        if (!approved) {
          status = 'rejected';
          resultMessage = 'The user denied this action. Do not repeat it; choose a different approach or finish.';
        }
      }

      if (status === 'success' && action.type === 'screenshot' && !capabilities.vision) {
        status = 'failed';
        resultMessage =
          'This model cannot view screenshots, so the capture would be wasted. Use element ids from the snapshot or click_at instead.';
      } else if (status === 'success' && action.type === 'screenshot' && captureBlocked) {
        status = 'failed';
        resultMessage =
          'Screenshots are blocked by Chrome for this tab. Enable Settings → Browser access → Allow all sites, or continue with DOM actions.';
      }

      if (status === 'success') {
        const cursor = cursorForAction(action, target, snapshot, label);
        if (cursor) await setControlOverlay(tabId, { state: 'working', cursor });
        try {
          const result: ExecutionResult = await executeAction(tabId, action, controls.signal);
          resultMessage = result.message;
          image = result.image;
          if (result.image) emit({ type: 'screenshot', dataUrl: result.image });
          if (!result.ok) status = 'failed';
        } catch (err) {
          if (isAbortError(err)) throw err;
          status = 'failed';
          resultMessage = err instanceof Error ? err.message : String(err);
          if (action.type === 'screenshot' && /capture|permission|activeTab/i.test(resultMessage)) {
            captureBlocked = true;
            resultMessage +=
              ' Enable Settings → Browser access → Allow all sites, or continue with DOM actions only.';
          }
        }
        if (action.type !== 'navigate' && action.type !== 'wait') {
          await sleepAbortable(350, controls.signal);
        }
      }

      let observation = '';
      let afterSnapshot: PageSnapshot | null = null;
      try {
        afterSnapshot = await observeWithRetry(tabId);
        observation = digestSnapshot(afterSnapshot);
        emit({ type: 'live', url: afterSnapshot.url, title: afterSnapshot.title });
      } catch (err) {
        observation = `Could not read the page after this action: ${err instanceof Error ? err.message : String(err)}`;
      }

      const step: AgentStep = {
        id: uid('step'),
        index,
        action,
        label,
        status,
        result: resultMessage,
        observation,
        reasoning: outcome.reasoning,
        providerReasoning: outcome.providerReasoning,
        image,
        at: Date.now(),
      };
      steps.push(step);
      emit({ type: 'step', step });
      checkpoint('running');

      // No-progress detector: a page that does not change after repeated
      // actions means the strategy is wrong. Typing and form focus are setup
      // steps, not stalls, and one warning is usually enough for the model to
      // change course; only repetition or coordinate guessing ends the run.
      if (action.type === 'find') {
        // A lookup is a deliberate re-inspection, not a stalled page action.
        noProgressStreak = 0;
        repeatedActions = 0;
        lastActionSignature = '';
        stallCount = 0;
      } else if (afterSnapshot && action.type !== 'wait' && action.type !== 'screenshot') {
        const signature = JSON.stringify(action);
        repeatedActions = signature === lastActionSignature ? repeatedActions + 1 : 1;
        lastActionSignature = signature;
        const fingerprintChanged = fingerprintOf(afterSnapshot) !== fingerprintOf(snapshot);
        const scrolled =
          action.type === 'scroll' && afterSnapshot.viewport.scrollY !== snapshot.viewport.scrollY;
        const progressed =
          afterSnapshot.url !== snapshot.url || fingerprintChanged || scrolled;
        const typed =
          (action.type === 'type' && status === 'success') ||
          (action.type === 'batch' &&
            status === 'success' &&
            action.actions.some((step) => step.type === 'type'));
        const fieldFocus =
          (action.type === 'click' &&
            !!target &&
            ['input', 'textarea', 'select'].includes(target.tag)) ||
          (action.type === 'batch' &&
            action.actions.some((step) => {
              if (step.type !== 'click') return false;
              const stepTarget = findTarget(step as BrowserAction, snapshot);
              return !!stepTarget && ['input', 'textarea', 'select'].includes(stepTarget.tag);
            }));

        if (typed) {
          noProgressStreak = 0;
          repeatedActions = 0;
          lastActionSignature = '';
        } else if (progressed) {
          noProgressStreak = 0;
        } else if (!fieldFocus) {
          noProgressStreak += 1;
        }

        if (action.type === 'scroll') {
          scrollHistory = [...scrollHistory, action.direction].slice(-4);
          const pingPong =
            scrollHistory.length === 4 &&
            scrollHistory.includes('up') &&
            scrollHistory.includes('down') &&
            !fingerprintChanged;
          if (pingPong) noProgressStreak = Math.max(noProgressStreak, 3);
        } else {
          scrollHistory = [];
        }

        if (action.type === 'click_at') coordinateClicks += 1;
        else if (status === 'success' && ['click', 'type', 'navigate', 'batch'].includes(action.type)) {
          coordinateClicks = 0;
        }
        // Coordinate clicks are guesswork. When the DOM already exposes
        // controls, repeated blind clicks mean the model is chasing an element
        // that is not actually available to automation.
        const blindGuessing = coordinateClicks >= 3 && snapshot.elements.length > 0;
        const meaningfulProgress =
          typed ||
          (status === 'success' &&
            ['click', 'type', 'navigate', 'batch'].includes(action.type) &&
            progressed);
        if (meaningfulProgress) stallCount = 0;

        if (blindGuessing || noProgressStreak >= 3) {
          const shouldStop =
            stallCount > 0 && (blindGuessing || repeatedActions >= 2 || stallCount >= 2);
          if (shouldStop) {
            const host = hostnameOf(afterSnapshot.url);
            const purchaseIntent = /\b(add|buy|purchase|cart|checkout|order)\b/i.test(
              task.objective,
            );
            const hints = (afterSnapshot.signals ?? [])
              .filter((signal) => purchaseIntent || !signal.startsWith('OUT OF STOCK'))
              .join(' ');
            throw new Error(
              blindGuessing
                ? `Stopped on ${host}: the control the task needs is not exposed as an element, and coordinate clicks kept hitting other parts of the page.${hints ? ` Page signals: ${hints}` : ''}`
                : `Couldn't make progress on ${host}: the page did not change after several actions.${hints ? ` Page signals: ${hints}` : ''}`,
            );
          }

          stallCount += 1;
          const reason = blindGuessing
            ? `you have used ${coordinateClicks} coordinate clicks without hitting a labeled control`
            : `the last ${noProgressStreak} actions did not change the page` +
              (repeatedActions >= 3 ? `, and the same ${action.type} was repeated ${repeatedActions} times` : '');
          stallNotice =
            `STALL${stallCount > 1 ? ' (final warning)' : ''}: ${reason}. ` +
            (blindGuessing
              ? 'This page exposes element ids, so coordinate guessing is unreliable. Use a labeled element id, scroll the target into view and observe again, or call finish and say the control is not exposed.'
              : 'Do not repeat it. Use a materially different approach from the available controls, or call finish with a clear explanation of what is blocking the task and what the user should do.');
          noProgressStreak = 0;
          repeatedActions = 0;
          lastActionSignature = '';
          if (blindGuessing) coordinateClicks = 2;
        }
      }
    }

    throw new Error(`Reached the ${settings.maxSteps}-step limit. Review what happened, then continue or stop.`);
  } catch (err) {
    if (isAbortError(err)) {
      checkpoint('cancelled');
      return { status: 'cancelled', steps, usage };
    }
    const message = err instanceof Error ? err.message : String(err);
    checkpoint('failed');
    return { status: 'failed', error: message, steps, usage };
  } finally {
    if (typeof window !== 'undefined' && onPageHide) window.removeEventListener('pagehide', onPageHide);
    await setControlOverlay(tabId, { state: 'off' });
  }
}
