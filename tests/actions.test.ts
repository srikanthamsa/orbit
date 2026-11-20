import { describe, expect, it } from 'vitest';
import { BrowserActionSchema, describeAction, parseAction } from '@/types/actions';

describe('action protocol', () => {
  it('accepts every supported action', () => {
    const actions = [
      { type: 'navigate', url: 'https://example.com' },
      { type: 'click', elementId: 'el_1' },
      { type: 'click_at', x: 0.4, y: 0.7 },
      { type: 'type', elementId: 'el_2', text: 'hello' },
      { type: 'scroll', direction: 'down', amount: 400 },
      { type: 'scroll', direction: 'up' },
      { type: 'press_key', key: 'Enter' },
      { type: 'screenshot' },
      { type: 'wait', duration: 500 },
      { type: 'find', query: 'delivery', role: 'button', limit: 5 },
      {
        type: 'batch',
        actions: [
          { type: 'click', elementId: 'el_1' },
          { type: 'type', elementId: 'el_2', text: '490001' },
          { type: 'scroll', direction: 'down' },
        ],
      },
      { type: 'finish', summary: 'Done' },
    ];
    for (const action of actions) {
      expect(BrowserActionSchema.safeParse(action).success).toBe(true);
    }
  });

  it('rejects malformed actions', () => {
    expect(parseActionSafe({ type: 'click' })).toBe(false);
    expect(parseActionSafe({ type: 'navigate', url: 'example.com' })).toBe(false);
    expect(parseActionSafe({ type: 'click_at', x: 2, y: 0 })).toBe(false);
    expect(parseActionSafe({ type: 'scroll', direction: 'left' })).toBe(false);
    expect(parseActionSafe({ type: 'find', query: '' })).toBe(false);
    expect(parseActionSafe({ type: 'batch', actions: [] })).toBe(false);
    expect(parseActionSafe({ type: 'batch', actions: [{ type: 'navigate', url: 'https://x.dev' }] })).toBe(false);
    expect(parseActionSafe({ type: 'finish', summary: '' })).toBe(false);
    expect(parseActionSafe({ type: 'run_js', code: 'alert(1)' })).toBe(false);
  });

  it('strips unknown fields such as reasoning', () => {
    const parsed = parseAction({ type: 'click', elementId: 'el_3', reasoning: 'why' });
    expect(parsed).toEqual({ type: 'click', elementId: 'el_3' });
  });

  it('describes actions for the UI', () => {
    expect(describeAction({ type: 'navigate', url: 'https://a.dev' })).toBe('Navigate to https://a.dev');
    expect(describeAction({ type: 'click', elementId: 'el_1' }, 'Buy now')).toBe('Click “Buy now”');
    expect(describeAction({ type: 'find', query: 'delivery' })).toBe('Find “delivery”');
    expect(
      describeAction({
        type: 'batch',
        actions: [
          { type: 'click', elementId: 'el_1' },
          { type: 'type', elementId: 'el_2', text: 'x' },
        ],
      }),
    ).toBe('Run 2 actions (click → type)');
    expect(describeAction({ type: 'finish', summary: 'x' })).toBe('Finish task');
  });
});

function parseActionSafe(value: unknown): boolean {
  return BrowserActionSchema.safeParse(value).success;
}

describe('answer blocks', () => {
  const base = { type: 'finish', summary: 'Done.', reasoning: 'finished' };

  it('keeps a valid table, chart, stats and links block', () => {
    const action = parseAction({
      ...base,
      ui: [
        { type: 'table', columns: ['Model', 'Price'], rows: [['Sony', '8990'], ['JBL', '6999']] },
        { type: 'chart', chart: 'bar', data: [{ label: 'Sony', value: 8990 }, { label: 'JBL', value: 6999 }] },
        { type: 'stats', items: [{ label: 'Cheapest', value: '₹6,999' }] },
      ],
    });
    if (action.type !== 'finish') throw new Error('expected finish');
    expect(action.ui).toHaveLength(3);
    expect(action.ui?.[0].type).toBe('table');
  });

  it('drops a malformed block instead of failing the answer', () => {
    const action = parseAction({
      ...base,
      ui: [
        { type: 'chart', chart: 'pie', data: [] },
        { type: 'links', items: [{ label: 'SteamDB', url: 'https://steamdb.info/app/300380/dlc/' }] },
      ],
    });
    if (action.type !== 'finish') throw new Error('expected finish');
    expect(action.ui).toHaveLength(1);
    expect(action.ui?.[0].type).toBe('links');
  });

  it('returns no blocks when the answer has none', () => {
    const action = parseAction(base);
    if (action.type !== 'finish') throw new Error('expected finish');
    expect(action.ui).toBeUndefined();
  });
});

describe('search', () => {
  it('parses a search action', () => {
    const action = parseAction({ type: 'search', query: 'philips fc9352 pet hair', reasoning: 'page is the wrong place' });
    if (action.type !== 'search') throw new Error('expected search');
    expect(action.query).toBe('philips fc9352 pet hair');
  });

  it('describes a search in the step log', () => {
    expect(describeAction({ type: 'search', query: 'pet hair' })).toBe('Search the web for “pet hair”');
  });
});
