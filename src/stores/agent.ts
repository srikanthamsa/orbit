import { create } from 'zustand';
import type {
  AgentStatus,
  AnswerBlock,
  CacheTurn,
  AgentStep,
  AgentTask,
  ApprovalRequest,
  ProviderConfig,
  Settings,
  TaskCheckpoint,
  TaskRecord,
  Usage,
} from '@/types';
import { runAgent, type AgentEvent, type RunOutcome } from '@/agent/orchestrator';
import { testConnection } from '@/providers/validate';
import { hasOriginAccess, requestOriginAccess } from '@/browser/permissions';
import { getActiveTab, isRestrictedUrl, setOrbitGroupState } from '@/browser/tabs';
import { setControlOverlay } from '@/browser/control';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/storage/settings';
import {
  clearAllCredentials,
  loadCredentials,
  removeCredential,
  saveCredential,
} from '@/storage/credentials';
import {
  clearHistory as clearHistoryStorage,
  loadHistory,
  removeRecord,
  saveRecord,
} from '@/storage/history';
import { clearCheckpoint, loadCheckpoint, saveCheckpoint } from '@/storage/checkpoint';
import { KEYS, readKey, writeKey } from '@/storage/base';
import { uid } from '@/lib/utils';

type Route = 'home' | 'task' | 'settings';
type TestState = { status: 'idle' | 'testing' | 'ok' | 'error'; message?: string };

class PauseGate {
  paused = false;
  private waiters: Array<() => void> = [];

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.waiters.splice(0).forEach((resolve) => resolve());
  }

  wait(): Promise<void> {
    if (!this.paused) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }
}

let secrets: Record<string, string> = {};
let controller: AbortController | null = null;
let pauseGate = new PauseGate();
let approvalResolver: ((approved: boolean) => void) | null = null;
let running = false;
let controlTabId: number | null = null;

export interface AgentStore {
  hydrated: boolean;
  route: Route;
  task: AgentTask | null;
  steps: AgentStep[];
  usage: Usage;
  currentAction: string | null;
  live: { url: string; title: string } | null;
  screenshot: string | null;
  approval: ApprovalRequest | null;
  summary: string | null;
  summaryBlocks: AnswerBlock[] | null;
  cacheTurns: CacheTurn[];
  error: string | null;
  paused: boolean;
  settings: Settings;
  providers: ProviderConfig[];
  hasKey: Record<string, boolean>;
  testStates: Record<string, TestState>;
  history: TaskRecord[];
  checkpoint: TaskCheckpoint | null;

  hydrate: () => Promise<void>;
  setRoute: (route: Route) => void;
  patchSettings: (patch: Partial<Settings>) => Promise<void>;
  saveProvider: (config: ProviderConfig, apiKey?: string) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  setActiveProvider: (id: string) => Promise<void>;
  runTest: (id: string) => Promise<void>;
  startTask: (objective: string, context?: string) => Promise<void>;
  continueConversation: (instruction: string) => Promise<void>;
  resumeTask: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  resolveApproval: (approved: boolean) => Promise<void>;
  dismissError: () => void;
  deleteHistory: () => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  openRecord: (record: TaskRecord) => void;
  deleteCredentials: () => Promise<void>;
  newTask: () => void;
}

function updateTask(task: AgentTask | null, status: AgentStatus): AgentTask | null {
  if (!task) return null;
  return { ...task, status, updatedAt: Date.now() };
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  hydrated: false,
  route: 'home',
  task: null,
  steps: [],
  usage: { inputTokens: 0, outputTokens: 0 },
  currentAction: null,
  live: null,
  screenshot: null,
  approval: null,
  summary: null,
  summaryBlocks: null,
  cacheTurns: [],
  error: null,
  paused: false,
  settings: DEFAULT_SETTINGS,
  providers: [],
  hasKey: {},
  testStates: {},
  history: [],
  checkpoint: null,

  hydrate: async () => {
    const [settings, providers, history, checkpoint] = await Promise.all([
      loadSettings(),
      readKey<ProviderConfig[]>(KEYS.providers, []),
      loadHistory(),
      loadCheckpoint(),
    ]);
    const stored = await loadCredentials(settings.sessionOnlyKeys);
    secrets = Object.fromEntries(Object.entries(stored).map(([id, value]) => [id, value.apiKey]));
    const hasKey = Object.fromEntries(Object.keys(secrets).map((id) => [id, true]));
    document.documentElement.dataset.theme = settings.theme;
    set({ hydrated: true, settings, providers, history, checkpoint, hasKey });
  },

  setRoute: (route) => set({ route }),

  patchSettings: async (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    if (patch.theme) document.documentElement.dataset.theme = patch.theme;
    await saveSettings(settings);
  },

  saveProvider: async (config, apiKey) => {
    const providers = get().providers;
    const exists = providers.some((p) => p.id === config.id);
    const next = exists ? providers.map((p) => (p.id === config.id ? config : p)) : [...providers, config];
    await writeKey(KEYS.providers, next);
    const sessionOnly = get().settings.sessionOnlyKeys;
    if (apiKey && apiKey.trim()) {
      await saveCredential(config.id, apiKey.trim(), sessionOnly);
      secrets[config.id] = apiKey.trim();
    }
    const patch: Partial<AgentStore> = {
      providers: next,
      hasKey: { ...get().hasKey, ...(apiKey && apiKey.trim() ? { [config.id]: true } : {}) },
    };
    if (!get().settings.activeProviderId) {
      const settings = { ...get().settings, activeProviderId: config.id };
      patch.settings = settings;
      await saveSettings(settings);
    }
    set(patch);
  },

  removeProvider: async (id) => {
    const providers = get().providers.filter((p) => p.id !== id);
    await writeKey(KEYS.providers, providers);
    await removeCredential(id);
    delete secrets[id];
    const hasKey = { ...get().hasKey };
    delete hasKey[id];
    let settings = get().settings;
    if (settings.activeProviderId === id) {
      settings = { ...settings, activeProviderId: providers[0]?.id };
      await saveSettings(settings);
    }
    set({ providers, hasKey, settings });
  },

  setActiveProvider: async (id) => {
    const settings = { ...get().settings, activeProviderId: id };
    set({ settings });
    await saveSettings(settings);
  },

  runTest: async (id) => {
    const config = get().providers.find((p) => p.id === id);
    const key = secrets[id];
    if (!config) return;
    set({ testStates: { ...get().testStates, [id]: { status: 'testing' } } });
    try {
      if (!key) throw new Error('Add an API key first.');
      await testConnection(config, key);
      set({ testStates: { ...get().testStates, [id]: { status: 'ok', message: 'Connected' } } });
    } catch (err) {
      set({
        testStates: {
          ...get().testStates,
          [id]: { status: 'error', message: err instanceof Error ? err.message : String(err) },
        },
      });
    }
  },

  startTask: async (objective, context) => {
    const clean = objective.trim();
    if (!clean || running) return;
    const { providers, settings } = get();
    const provider = providers.find((p) => p.id === settings.activeProviderId) ?? providers[0];
    if (!provider) {
      set({ error: 'Connect a model first.', route: 'settings' });
      return;
    }
    const apiKey = secrets[provider.id];
    if (!apiKey) {
      set({ error: 'Add a key for your model.', route: 'settings' });
      return;
    }
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url) {
      set({ error: 'Open a website tab first.' });
      return;
    }
    if (isRestrictedUrl(tab.url)) {
      set({
        error:
          'ORBIT can’t run on Chrome’s built-in pages. Open a normal website tab, then start the task again.',
      });
      return;
    }
    const granted = (await hasOriginAccess(tab.url)) || (await requestOriginAccess(tab.url));
    if (!granted) {
      set({
        error:
          'Site access was not granted. Choose Allow on Chrome’s prompt, or turn on Settings → Browser access → Allow all sites to stop per-site prompts.',
      });
      return;
    }

    const now = Date.now();
    const task: AgentTask = {
      id: uid('task'),
      objective: clean,
      context: context?.trim() || undefined,
      status: 'running',
      currentStep: 0,
      maxSteps: settings.maxSteps,
      model: provider.model,
      createdAt: now,
      updatedAt: now,
    };
    const record: TaskRecord = {
      id: task.id,
      objective: clean,
      status: 'running',
      stepCount: 0,
      createdAt: now,
      costUsd: 0,
      provider: provider.provider,
      model: provider.model,
    };
    await saveRecord(record);
    set({
      route: 'task',
      task,
      steps: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      currentAction: null,
      live: tab.url ? { url: tab.url, title: tab.title ?? '' } : null,
      screenshot: null,
      approval: null,
      summary: null,
      summaryBlocks: null,
      cacheTurns: [],
      error: null,
      paused: false,
      history: await loadHistory(),
    });

    void runSequence({
      task,
      provider,
      apiKey,
      settings,
      tabId: tab.id,
      steps: [],
      usage: { inputTokens: 0, outputTokens: 0 },
    });
  },

  continueConversation: async (instruction) => {
    const clean = instruction.trim();
    if (!clean || running) return;
    const { task, summary, steps, usage, providers, settings } = get();
    if (!task || !summary) {
      await get().startTask(clean);
      return;
    }
    const provider =
      providers.find((p) => p.id === settings.activeProviderId) ?? providers[0];
    if (!provider) {
      set({ error: 'Connect a model first.', route: 'settings' });
      return;
    }
    const apiKey = secrets[provider.id];
    if (!apiKey) {
      set({ error: 'Add a key for your model.', route: 'settings' });
      return;
    }
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url) {
      set({ error: 'Open a website tab first.' });
      return;
    }
    if (isRestrictedUrl(tab.url)) {
      set({ error: 'ORBIT can’t run on browser pages. Open a website tab.' });
      return;
    }
    const granted = (await hasOriginAccess(tab.url)) || (await requestOriginAccess(tab.url));
    if (!granted) {
      set({ error: 'Site access wasn’t granted. Choose Allow when Chrome asks.' });
      return;
    }
    const nextTask: AgentTask = {
      ...task,
      status: 'running',
      currentStep: steps.length,
      model: provider.model,
      turns: [...(task.turns ?? []), { text: clean, at: Date.now() }],
      context: `The user's latest request in this conversation: ${clean}\n\nPrevious result: ${summary}`,
      updatedAt: Date.now(),
    };
    set({
      route: 'task',
      task: nextTask,
      summary: null,
      summaryBlocks: null,
      cacheTurns: [],
      error: null,
      approval: null,
      paused: false,
      currentAction: null,
    });
    void runSequence({
      task: nextTask,
      provider,
      apiKey,
      settings,
      tabId: tab.id,
      steps,
      usage,
    });
  },

  resumeTask: async () => {
    if (running) return;
    const checkpoint = get().checkpoint ?? (await loadCheckpoint());
    if (!checkpoint) return;
    const { providers, settings } = get();
    const provider =
      providers.find((p) => p.id === checkpoint.providerConfigId) ??
      providers.find((p) => p.id === settings.activeProviderId);
    if (!provider) {
      set({ error: 'That model is no longer set up.', route: 'settings' });
      return;
    }
    const apiKey = secrets[provider.id];
    if (!apiKey) {
      set({ error: 'Add the key for that model.', route: 'settings' });
      return;
    }
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url) {
      set({ error: 'Open the tab you want ORBIT to continue in.' });
      return;
    }
    if (isRestrictedUrl(tab.url)) {
      set({ error: 'ORBIT can’t run on browser pages. Open a website tab.' });
      return;
    }
    const granted = (await hasOriginAccess(tab.url)) || (await requestOriginAccess(tab.url));
    if (!granted) {
      set({
        error:
          'Site access was not granted. Choose Allow on Chrome’s prompt, or enable Settings → Browser access → Allow all sites.',
      });
      return;
    }
    // A task that stopped at its step cap needs headroom to finish; a resume
    // grants a fresh allowance instead of failing on the same limit again.
    const runSettings: Settings =
      checkpoint.steps.length >= settings.maxSteps
        ? { ...settings, maxSteps: checkpoint.steps.length + 10 }
        : settings;
    const task: AgentTask = {
      ...checkpoint.task,
      status: 'running',
      maxSteps: Math.max(checkpoint.task.maxSteps, runSettings.maxSteps),
      model: provider.model,
      updatedAt: Date.now(),
    };
    set({
      route: 'task',
      task,
      steps: checkpoint.steps,
      usage: checkpoint.usage,
      summary: null,
      summaryBlocks: null,
      error: null,
      approval: null,
      paused: false,
      currentAction: null,
    });
    void runSequence({
      task,
      provider,
      apiKey,
      settings: runSettings,
      tabId: tab.id,
      steps: checkpoint.steps,
      usage: checkpoint.usage,
    });
  },

  pause: () => {
    if (!running) return;
    pauseGate.pause();
    set({ paused: true, task: updateTask(get().task, 'paused') });
    if (controlTabId !== null) void setControlOverlay(controlTabId, { state: 'paused' });
    if (controlTabId !== null) void setOrbitGroupState(controlTabId, 'paused');
  },

  resume: () => {
    pauseGate.resume();
    set({ paused: false, task: updateTask(get().task, 'running') });
    if (controlTabId !== null) void setControlOverlay(controlTabId, { state: 'working' });
    if (controlTabId !== null) void setOrbitGroupState(controlTabId, 'working');
  },

  stop: () => {
    controller?.abort();
    pauseGate.resume();
    set({ paused: false, approval: null });
    if (controlTabId !== null) void setControlOverlay(controlTabId, { state: 'off' });
    if (controlTabId !== null) void setOrbitGroupState(controlTabId, 'paused');
    if (approvalResolver) {
      approvalResolver(false);
      approvalResolver = null;
    }
  },

  resolveApproval: async (approved) => {
    const request = get().approval;
    if (!request || !approvalResolver) {
      set({ approval: null });
      return;
    }
    let result = approved;
    if (approved && request.kind === 'scope' && request.origin) {
      result = await requestOriginAccess(request.origin);
    }
    const resolve = approvalResolver;
    approvalResolver = null;
    set({ approval: null });
    resolve(result);
  },

  dismissError: () => set({ error: null }),

  deleteHistory: async () => {
    await clearHistoryStorage();
    await clearCheckpoint();
    set({ history: [], checkpoint: null });
  },

  deleteRecord: async (id) => {
    await removeRecord(id);
    const checkpoint = get().checkpoint;
    if (checkpoint?.task.id === id) {
      await clearCheckpoint();
      set({ checkpoint: null });
    }
    if (get().task?.id === id && !running) {
      get().newTask();
    }
    set({ history: await loadHistory() });
  },

  openRecord: (record) => {
    if (running) return;
    const sessionSteps = record.steps ?? [];
    const task: AgentTask = {
      id: record.id,
      objective: record.objective,
      status: record.status,
      currentStep: sessionSteps.length,
      maxSteps: get().settings.maxSteps,
      model: record.model,
      turns: record.turns,
      createdAt: record.createdAt,
      updatedAt: record.completedAt ?? record.createdAt,
    };
    set({
      route: 'task',
      task,
      steps: sessionSteps,
      usage: {
        inputTokens: record.tokens ?? 0,
        outputTokens: 0,
        costUsd: record.costUsd || undefined,
      },
      summary: record.summary ?? null,
      summaryBlocks: record.blocks ?? null,
      error: null,
      live: null,
      screenshot: null,
      approval: null,
      currentAction: null,
      paused: false,
    });
  },

  deleteCredentials: async () => {
    await clearAllCredentials();
    secrets = {};
    set({ hasKey: {} });
  },

  newTask: () => {
    if (running) return;
    set({
      route: 'home',
      task: null,
      steps: [],
      summary: null,
      summaryBlocks: null,
      error: null,
      currentAction: null,
      live: null,
      screenshot: null,
      approval: null,
      paused: false,
    });
  },
}));

interface RunSequenceInput {
  task: AgentTask;
  provider: ProviderConfig;
  apiKey: string;
  settings: Settings;
  tabId: number;
  steps: AgentStep[];
  usage: Usage;
}

async function runSequence(input: RunSequenceInput): Promise<void> {
  running = true;
  controller = new AbortController();
  pauseGate = new PauseGate();
  controlTabId = input.tabId;
  void setOrbitGroupState(input.tabId, 'working');
  const set = useAgentStore.setState;
  const get = useAgentStore.getState;

  const onRuntimeMessage = (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: { ok: boolean }) => void,
  ): void => {
    if (!message || typeof message !== 'object') return;
    const { type, tabId } = message as { type?: string; tabId?: number };
    if (type !== 'ORBIT_STOP_TAB' || tabId !== input.tabId) return;
    if (sender.tab?.id !== input.tabId) {
      sendResponse({ ok: false });
      return;
    }
    get().stop();
    sendResponse({ ok: true });
  };
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(onRuntimeMessage);
  }

  const emit = (event: AgentEvent) => {
    switch (event.type) {
      case 'status':
        set({ task: updateTask(get().task, event.status) });
        if (event.status === 'waiting_for_approval') {
          void setControlOverlay(input.tabId, { state: 'waiting' });
          void setOrbitGroupState(input.tabId, 'waiting');
        } else if (event.status === 'running' || event.status === 'planning') {
          void setControlOverlay(input.tabId, { state: 'working' });
          void setOrbitGroupState(input.tabId, 'working');
        }
        break;
      case 'live':
        set({ live: { url: event.url, title: event.title } });
        break;
      case 'action':
        set({ currentAction: event.label });
        break;
      case 'step':
        set((state) => {
          const steps = [...state.steps, event.step];
          const latestImage = event.step.image;
          const trimmed = latestImage
            ? steps.map((step, i) =>
                i === steps.length - 1 ? step : step.image ? { ...step, image: undefined } : step,
              )
            : steps;
          return {
            steps: trimmed,
            currentAction: null,
            screenshot: latestImage ?? state.screenshot,
            task: updateTask(state.task, 'running'),
          };
        });
        break;
      case 'screenshot':
        set({ screenshot: event.dataUrl });
        break;
      case 'usage':
        set({ usage: event.usage });
        break;
      case 'cache':
        set({ cacheTurns: [...get().cacheTurns, event] });
        break;
      case 'checkpoint':
        set({ checkpoint: event.checkpoint });
        void saveCheckpoint(event.checkpoint);
        break;
    }
  };

  const controls = {
    signal: controller.signal,
    waitWhilePaused: () => pauseGate.wait(),
    requestApproval: (request: ApprovalRequest) =>
      new Promise<boolean>((resolve) => {
        approvalResolver = resolve;
        set({ approval: request, task: updateTask(get().task, 'waiting_for_approval') });
      }),
  };

  let outcome: RunOutcome;
  try {
    outcome = await runAgent({
      task: input.task,
      provider: input.provider,
      apiKey: input.apiKey,
      settings: input.settings,
      tabId: input.tabId,
      steps: input.steps,
      usage: input.usage,
      controls,
      emit,
    });
  } catch (err) {
    outcome = {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      steps: input.steps,
      usage: input.usage,
    };
  } finally {
    running = false;
    controller = null;
    approvalResolver = null;
    controlTabId = null;
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    }
  }

  const state = get();
  const finalTask = updateTask(
    state.task,
    outcome.status === 'completed' ? 'completed' : outcome.status === 'cancelled' ? 'cancelled' : 'failed',
  );
  set({
    task: finalTask,
    summary: outcome.summary ?? null,
    summaryBlocks: outcome.blocks ?? null,
    error: outcome.error ?? null,
    currentAction: null,
    approval: null,
    paused: false,
    usage: outcome.usage,
  });
  void setOrbitGroupState(
    input.tabId,
    outcome.status === 'completed' ? 'done' : outcome.status === 'cancelled' ? 'paused' : 'failed',
  );

  if (state.task) {
    const record: TaskRecord = {
      id: state.task.id,
      objective: state.task.objective,
      status: finalTask?.status ?? 'failed',
      summary: outcome.summary,
      blocks: outcome.blocks,
      turns: state.task.turns,
      stepCount: outcome.steps.length,
      createdAt: state.task.createdAt,
      completedAt: Date.now(),
      costUsd: outcome.usage.costUsd ?? 0,
      tokens: outcome.usage.inputTokens + outcome.usage.outputTokens,
      steps: outcome.steps.slice(-60).map((step) => ({ ...step, observation: '', image: undefined })),
      provider: input.provider.provider,
      model: input.provider.model,
    };
    await saveRecord(record);
    set({ history: await loadHistory() });
  }

  if (outcome.status === 'completed' || outcome.status === 'cancelled') {
    await clearCheckpoint();
    set({ checkpoint: null });
  }
}

export async function followUpTask(text: string): Promise<void> {
  const instruction = text.trim();
  if (!instruction) return;
  await useAgentStore.getState().continueConversation(instruction);
}
