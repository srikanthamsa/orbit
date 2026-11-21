import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentTask, PageSnapshot, Settings } from '@/types';
import type { BrowserAction } from '@/types/actions';
import { ProviderError } from '@/providers/types';

const h = vi.hoisted(() => ({
  actions: [] as unknown[],
  snapshots: [] as unknown[],
  approval: true,
  approvals: 0,
  providerCalls: [] as Array<Record<string, unknown>>,
  failNextProviderCall: null as Error | null,
  clicked: 0,
  typed: 0,
  control: vi.fn(async (_tabId: number, _update: Record<string, unknown>) => {}),
}));

vi.mock('@/browser/control', () => ({
  setControlOverlay: h.control,
}));

const snapshot: PageSnapshot = {
  url: 'https://example.com/apply',
  title: 'Apply',
  viewport: { width: 1200, height: 800, scrollX: 0, scrollY: 0, scrollHeight: 2000 },
  elements: [
    {
      id: 'el_1',
      tag: 'button',
      type: 'submit',
      accessibleName: 'Submit application',
      disabled: false,
      visible: true,
      inForm: true,
      boundingBox: { x: 10, y: 10, width: 100, height: 30 },
    },
    {
      id: 'el_2',
      tag: 'a',
      accessibleName: 'Help',
      href: '/help',
      disabled: false,
      visible: true,
      inForm: false,
      boundingBox: { x: 10, y: 60, width: 80, height: 20 },
    },
    {
      id: 'el_3',
      tag: 'input',
      type: 'text',
      placeholder: 'Enter pincode',
      accessibleName: 'Enter pincode',
      disabled: false,
      visible: true,
      inForm: true,
      boundingBox: { x: 10, y: 100, width: 160, height: 24 },
    },
  ],
  textContent: 'Application form',
  capturedAt: Date.now(),
};

vi.mock('@/browser/dom', () => ({
  captureSnapshot: vi.fn(async () => h.snapshots.shift() ?? snapshot),
  pageClick: vi.fn(async (_tabId: number, elementId: string) => {
    if (!['el_1', 'el_2'].includes(elementId)) {
      return { ok: false, message: `Element ${elementId} is not in the latest snapshot.` };
    }
    h.clicked += 1;
    return { ok: true, message: 'Clicked.', label: 'Submit application' };
  }),
  pageType: vi.fn(async () => {
    h.typed += 1;
    return { ok: true, message: 'Typed.', label: 'Field' };
  }),
  pageScroll: vi.fn(async () => ({ ok: true, message: 'Scrolled.' })),
  pagePressKey: vi.fn(async () => ({ ok: true, message: 'Pressed.' })),
  pageClickAt: vi.fn(async () => ({ ok: true, message: 'Clicked at point.' })),
  pageFind: vi.fn(async (_tabId: number, query: string) => ({
    matches: [
      {
        id: 'el_3',
        tag: 'input',
        role: 'textbox',
        name: 'Enter pincode',
        disabled: false,
        inForm: true,
        inViewport: true,
      },
    ],
    message: `Found 1 accessible match for “${query}”.`,
  })),
  pageElementAt: vi.fn(async () => ({ tag: 'button', type: 'submit', label: 'Submit application', inForm: true })),
  pageActiveElement: vi.fn(async () => ({ tag: 'input', inForm: true, label: 'Email' })),
}));

vi.mock('@/browser/tabs', () => ({
  getTab: vi.fn(async () => ({ id: 7, url: 'https://example.com/apply', title: 'Apply', status: 'complete' })),
  focusTab: vi.fn(async () => {}),
  navigateAndSettle: vi.fn(async () => {}),
  isRestrictedUrl: vi.fn(() => false),
}));

vi.mock('@/browser/permissions', () => ({
  hasOriginAccess: vi.fn(async () => true),
  requestOriginAccess: vi.fn(async () => true),
}));

vi.mock('@/browser/websearch', () => ({
  webSearch: vi.fn(async (query: string) => [
    {
      title: 'Does the Philips FC9352 pick up pet hair?',
      url: 'https://example.com/review',
      snippet: 'Owners report it works well on pet hair and fine dust.',
    },
  ]),
  formatSearchResults: (query: string) =>
    `Searched the web for “${query}” in the background. The tab was not touched.`,
}));

vi.mock('@/browser/screenshot', () => ({
  captureScreenshot: vi.fn(async () => 'data:image/jpeg;base64,AAAA'),
}));

vi.mock('@/providers', () => ({
  requestAction: vi.fn(async (input: Record<string, unknown>) => {
    h.providerCalls.push(input);
    if (h.failNextProviderCall) {
      const err = h.failNextProviderCall;
      h.failNextProviderCall = null;
      throw err;
    }
    const action = h.actions.shift();
    if (!action) throw new Error('No scripted action left.');
    return { action, reasoning: 'Because of the page.', usage: { inputTokens: 100, outputTokens: 20, costUsd: 0.001 } };
  }),
}));

const { runAgent } = await import('@/agent/orchestrator');

const task: AgentTask = {
  id: 'task_1',
  objective: 'Submit the application',
  status: 'running',
  currentStep: 0,
  maxSteps: 5,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const settings: Settings = {
  theme: 'dark',
  maxSteps: 5,
  maxCostUsd: 2,
  approvalMode: 'sensitive',
  sessionOnlyKeys: true,
  activeProviderId: 'p1',
};

function controls(overrides: Partial<Parameters<typeof runAgent>[0]['controls']> = {}) {
  return {
    signal: new AbortController().signal,
    waitWhilePaused: async () => {},
    requestApproval: async () => {
      h.approvals += 1;
      return h.approval;
    },
    ...overrides,
  };
}

function run(
  overrides: {
    settings?: Partial<Settings>;
    actions?: BrowserAction[];
    controls?: ReturnType<typeof controls>;
    objective?: string;
    provider?: { id: string; provider: 'openai' | 'deepseek' | 'anthropic' | 'gemini' | 'compatible'; model: string };
    snapshots?: PageSnapshot[];
  } = {},
) {
  const events: any[] = [];
  h.actions = overrides.actions ?? [];
  h.snapshots = overrides.snapshots ?? [];
  return runAgent({
    task: { ...task, objective: overrides.objective ?? task.objective },
    provider: overrides.provider ?? { id: 'p1', provider: 'openai', model: 'gpt-4o-mini' },
    apiKey: 'sk-test',
    settings: { ...settings, ...overrides.settings },
    tabId: 7,
    steps: [],
    usage: { inputTokens: 0, outputTokens: 0 },
    controls: overrides.controls ?? controls(),
    emit: (event) => events.push(event),
  }).then((outcome) => ({ outcome, events }));
}

beforeEach(() => {
  h.actions = [];
  h.snapshots = [];
  h.approval = true;
  h.approvals = 0;
  h.providerCalls = [];
  h.failNextProviderCall = null;
  h.clicked = 0;
  h.typed = 0;
  h.control.mockClear();
});

describe('agent loop', () => {
  it('runs actions and completes with a summary', async () => {
    const { outcome, events } = await run({
      actions: [
        { type: 'click', elementId: 'el_2' },
        { type: 'finish', summary: 'Application submitted successfully.' },
      ],
    });
    expect(outcome.status).toBe('completed');
    expect(outcome.summary).toContain('submitted');
    expect(outcome.steps).toHaveLength(1);
    expect(outcome.steps[0].status).toBe('success');
    expect(h.clicked).toBe(1);
    expect(events.some((e) => e.type === 'live')).toBe(true);
    expect(events.some((e) => e.type === 'step')).toBe(true);
    expect(h.providerCalls[1].correction).toBeUndefined();
    expect(h.control).toHaveBeenCalledWith(7, { state: 'working' });
    expect(h.control).toHaveBeenLastCalledWith(7, { state: 'off' });
  });

  it('asks before sensitive actions and records a rejection', async () => {
    h.approval = false;
    const { outcome } = await run({
      actions: [
        { type: 'click', elementId: 'el_1' },
        { type: 'finish', summary: 'Stopped because the user denied the submit.' },
      ],
    });
    expect(h.approvals).toBe(1);
    expect(h.clicked).toBe(0);
    expect(outcome.steps[0].status).toBe('rejected');
    expect(outcome.status).toBe('completed');
  });

  it('executes approved sensitive actions', async () => {
    h.approval = true;
    const { outcome } = await run({
      actions: [
        { type: 'click', elementId: 'el_1' },
        { type: 'finish', summary: 'Submitted.' },
      ],
    });
    expect(h.approvals).toBe(1);
    expect(h.clicked).toBe(1);
    expect(outcome.steps[0].status).toBe('success');
    expect(h.control).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        state: 'working',
        cursor: expect.objectContaining({ x: 60, y: 25, pressed: true }),
      }),
    );
  });

  it('retries once when the model returns an invalid action', async () => {
    h.failNextProviderCall = new ProviderError('The model returned an invalid action (type: invalid).', 'openai');
    const { outcome } = await run({
      actions: [{ type: 'finish', summary: 'Recovered.' }],
    });
    expect(outcome.status).toBe('completed');
    expect(h.providerCalls).toHaveLength(2);
    expect(String(h.providerCalls[1].correction)).toMatch(/corrected/i);
  });

  it('stops when the cost budget is reached', async () => {
    const { outcome } = await run({
      settings: { maxCostUsd: 0.0005 },
      actions: [
        { type: 'click', elementId: 'el_2' },
        { type: 'finish', summary: 'never reached' },
      ],
    });
    expect(outcome.status).toBe('failed');
    expect(outcome.error).toMatch(/budget/i);
    expect(outcome.steps).toHaveLength(1);
  });

  it('returns cancelled when aborted', async () => {
    const aborted = new AbortController();
    aborted.abort();
    const { outcome } = await run({
      actions: [{ type: 'finish', summary: 'no' }],
      controls: controls({ signal: aborted.signal }),
    });
    expect(outcome.status).toBe('cancelled');
  });

  it('reports an out-of-stock product page instead of hunting for a cart button', async () => {
    const { outcome } = await run({
      objective: 'open flipkart, add ps5 to cart',
      snapshots: [
        {
          ...snapshot,
          url: 'https://www.flipkart.com/sony-ps5-console/p/itm7f272655aeabf',
          title: 'SONY PS5 Console (CFI-2116A01Y) Price in India',
          signals: [
            'OUT OF STOCK — this product shows “Notify Me” instead of “Add to cart”, so it cannot be purchased right now.',
          ],
        },
      ],
      actions: [],
    });
    expect(outcome.status).toBe('completed');
    expect(outcome.summary).toMatch(/out of stock/i);
    expect(outcome.summary).toMatch(/Notify Me/);
    expect(h.providerCalls).toHaveLength(0);
  });

  it('stops on a CAPTCHA instead of burning steps', async () => {
    const { outcome } = await run({
      objective: 'compare laptop prices',
      snapshots: [
        {
          ...snapshot,
          signals: ['A CAPTCHA or human-verification challenge is present. Stop and ask the user.'],
        },
      ],
      actions: [],
    });
    expect(outcome.status).toBe('completed');
    expect(outcome.summary).toMatch(/CAPTCHA/i);
    expect(h.providerCalls).toHaveLength(0);
  });

  it('warns the model once when stuck, then stops with a diagnosis', async () => {
    const click: BrowserAction = { type: 'click', elementId: 'el_2' };
    const { outcome } = await run({
      settings: { maxSteps: 10 },
      actions: [click, click, click, click, click, click],
    });
    expect(outcome.status).toBe('failed');
    expect(outcome.error).toMatch(/progress/i);
    expect(h.providerCalls).toHaveLength(6);
    expect(String(h.providerCalls[3].correction)).toMatch(/STALL/);
  });

  it('breaks a two-page loop by opening a web search', async () => {
    const shop = (path: string): PageSnapshot => ({
      ...snapshot,
      url: `https://shop.test${path}`,
      title: 'PHILIPS PowerPro FC9352/01 Bagless Dry Vacuum | Shop',
      textContent: 'Product page',
    });
    const click: BrowserAction = { type: 'click', elementId: 'el_2' };
    const { outcome } = await run({
      objective: 'does it clean pet hair effectively?',
      settings: { maxSteps: 12 },
      actions: [click, click, click, click, click, { type: 'finish', summary: 'Searched instead.' }],
      snapshots: [
        shop('/product'),
        shop('/reviews'),
        shop('/product'),
        shop('/reviews'),
        shop('/product'),
        shop('/reviews'),
        shop('/product'),
        shop('/reviews'),
        shop('/search-results'),
      ],
    });

    const searched = outcome.steps.find((step) => step.action.type === 'search');
    expect(searched).toBeDefined();
    expect(searched?.label).toMatch(/Search the web/);
    expect(String((searched?.action as { query?: string }).query)).toMatch(/pet hair/i);
  });

  it('stops blind coordinate clicking when labeled controls exist', async () => {
    const at = (x: number, y: number): BrowserAction => ({ type: 'click_at', x, y });
    const { outcome } = await run({
      settings: { maxSteps: 10 },
      actions: [at(0.2, 0.2), at(0.25, 0.25), at(0.3, 0.3), at(0.35, 0.35)],
    });
    expect(outcome.status).toBe('failed');
    expect(outcome.error).toMatch(/not exposed|coordinate/i);
    expect(h.providerCalls).toHaveLength(4);
    expect(String(h.providerCalls[3].correction)).toMatch(/coordinate/i);
  });

  it('treats typing as progress instead of stalling', async () => {
    const click: BrowserAction = { type: 'click', elementId: 'el_2' };
    const { outcome } = await run({
      settings: { maxSteps: 10 },
      actions: [
        click,
        click,
        click,
        { type: 'type', elementId: 'el_1', text: '490001' },
        { type: 'finish', summary: 'Typed the pincode.' },
      ],
    });
    expect(outcome.status).toBe('completed');
    expect(outcome.summary).toContain('pincode');
    expect(h.providerCalls).toHaveLength(5);
    expect(String(h.providerCalls[3].correction)).toMatch(/STALL/);
  });

  it('does not stall on scroll → focus field → type', async () => {
    const { outcome } = await run({
      settings: { maxSteps: 10 },
      actions: [
        { type: 'scroll', direction: 'down', amount: 600 },
        { type: 'click', elementId: 'el_3' },
        { type: 'type', elementId: 'el_3', text: '490001' },
        { type: 'finish', summary: 'No seller ships to 490001.' },
      ],
    });
    expect(outcome.status).toBe('completed');
    expect(h.providerCalls).toHaveLength(4);
    expect(h.providerCalls[3].correction).toBeUndefined();
  });

  it('does not waste screenshot calls on a text-only model', async () => {
    const { outcome } = await run({
      provider: { id: 'p2', provider: 'deepseek', model: 'deepseek-v4-pro' },
      actions: [{ type: 'screenshot' }, { type: 'finish', summary: 'Used the DOM instead.' }],
    });
    expect(outcome.steps[0].status).toBe('failed');
    expect(outcome.steps[0].result).toMatch(/cannot view screenshots/i);
    expect(outcome.status).toBe('completed');
  });

  it('hides the control layer while capturing a screenshot', async () => {
    const { outcome } = await run({
      actions: [{ type: 'screenshot' }, { type: 'finish', summary: 'Used the screenshot.' }],
    });
    expect(outcome.status).toBe('completed');
    expect(outcome.steps[0].status).toBe('success');
    expect(outcome.steps[0].image).toMatch(/^data:image/);
    const hiddenAt = h.control.mock.calls.findIndex(([, update]) => update.state === 'hidden');
    expect(hiddenAt).toBeGreaterThanOrEqual(0);
    expect(
      h.control.mock.calls.slice(hiddenAt + 1).some(([, update]) => update.state === 'working'),
    ).toBe(true);
  });

  it('runs find without approval and returns matching ids', async () => {
    const { outcome } = await run({
      actions: [
        { type: 'find', query: 'pincode' },
        { type: 'finish', summary: 'Found the field.' },
      ],
    });
    expect(outcome.status).toBe('completed');
    expect(outcome.steps[0].status).toBe('success');
    expect(outcome.steps[0].result).toContain('el_3');
    expect(h.providerCalls).toHaveLength(2);
    expect(h.approvals).toBe(0);
  });

  it('executes a batch of compatible actions in one model turn', async () => {
    const { outcome } = await run({
      actions: [
        {
          type: 'batch',
          actions: [
            { type: 'click', elementId: 'el_2' },
            { type: 'type', elementId: 'el_3', text: '490001' },
            { type: 'scroll', direction: 'down', amount: 300 },
          ],
        },
        { type: 'finish', summary: 'Filled the form.' },
      ],
    });
    expect(outcome.status).toBe('completed');
    expect(outcome.steps).toHaveLength(1);
    expect(outcome.steps[0].action.type).toBe('batch');
    expect(outcome.steps[0].status).toBe('success');
    expect(outcome.steps[0].result).toContain('Typed');
    expect(h.clicked).toBe(1);
    expect(h.typed).toBe(1);
    expect(h.providerCalls).toHaveLength(2);
  });

  it('asks once for a batch with one sensitive step', async () => {
    h.approval = true;
    const { outcome } = await run({
      actions: [
        {
          type: 'batch',
          actions: [
            { type: 'click', elementId: 'el_1' },
            { type: 'type', elementId: 'el_3', text: '490001' },
          ],
        },
        { type: 'finish', summary: 'Submitted.' },
      ],
    });
    expect(outcome.status).toBe('completed');
    expect(h.approvals).toBe(1);
    expect(h.clicked).toBe(1);
    expect(h.typed).toBe(1);
  });

  it('rejects a batch with multiple sensitive steps before executing anything', async () => {
    const { outcome } = await run({
      actions: [
        {
          type: 'batch',
          actions: [
            { type: 'click', elementId: 'el_1' },
            { type: 'click', elementId: 'el_1' },
          ],
        },
        { type: 'finish', summary: 'Split needed.' },
      ],
    });
    expect(outcome.status).toBe('completed');
    expect(outcome.steps[0].status).toBe('failed');
    expect(outcome.steps[0].result).toMatch(/split/i);
    expect(h.approvals).toBe(0);
    expect(h.clicked).toBe(0);
  });

  it('stops a batch at the first failed step', async () => {
    const { outcome } = await run({
      actions: [
        {
          type: 'batch',
          actions: [
            { type: 'click', elementId: 'el_999' },
            { type: 'click', elementId: 'el_2' },
          ],
        },
        { type: 'finish', summary: 'Batch stopped.' },
      ],
    });
    expect(outcome.status).toBe('completed');
    expect(outcome.steps[0].status).toBe('failed');
    expect(outcome.steps[0].result).toContain('not in the latest snapshot');
    expect(h.clicked).toBe(0);
  });

  it('survives a failed action and keeps going', async () => {
    const { outcome } = await run({
      actions: [
        { type: 'click', elementId: 'el_999' },
        { type: 'finish', summary: 'Recovered after a missing element.' },
      ],
    });
    expect(outcome.steps[0].status).toBe('failed');
    expect(outcome.status).toBe('completed');
  });
});

describe('answer quality', () => {
  const QUESTION = 'was he a main eventer or a mid card talent in his days?';
  const BIOGRAPHY =
    'That is Hacksaw Jim Duggan, the American retired pro wrestler born January 14, 1954, best known for his 2x4 and his HOOOOO catchphrase. He won the first Royal Rumble in 1988 and entered the WWE Hall of Fame in 2011.';
  const VERDICT =
    'Jim Duggan was primarily a mid-card wrestler, though a recognisable upper-mid-card name. He was never a consistent world-title main-eventer.';

  it('rewrites a biography that never answers a verdict question', async () => {
    h.providerCalls.length = 0;
    const { outcome } = await run({
      objective: QUESTION,
      actions: [
        { type: 'finish', summary: BIOGRAPHY },
        { type: 'finish', summary: VERDICT },
      ],
    });
    expect(outcome.summary).toBe(VERDICT);
    expect(h.providerCalls).toHaveLength(2);
    expect(String(h.providerCalls[1].correction)).toContain('does not answer the question');
  });

  it('accepts a verdict on the first finish without a retry', async () => {
    h.providerCalls.length = 0;
    const { outcome } = await run({
      objective: QUESTION,
      actions: [{ type: 'finish', summary: VERDICT }],
    });
    expect(outcome.summary).toBe(VERDICT);
    expect(h.providerCalls).toHaveLength(1);
  });

  it('does not retry an answer to an open question', async () => {
    h.providerCalls.length = 0;
    const { outcome } = await run({
      objective: 'who is Jim Duggan?',
      actions: [{ type: 'finish', summary: BIOGRAPHY }],
    });
    expect(outcome.summary).toBe(BIOGRAPHY);
    expect(h.providerCalls).toHaveLength(1);
  });
});
