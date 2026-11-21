import { describe, expect, it } from 'vitest';
import { deepseekMessages } from '@/providers/openai';
import { buildOpenAIBody } from '@/providers/openai';
import type { PromptStep, ProviderRequest } from '@/providers/types';

/**
 * DeepSeek only hits its prompt cache when a request fully matches a prefix
 * unit persisted by an earlier request. These tests hold the transcript to the
 * shape that makes that possible: append only, never rewrite the tail.
 */

function step(index: number, overrides: Partial<PromptStep> = {}): PromptStep {
  return {
    id: `step_${index}`,
    action: { type: 'click', elementId: `el_${index}` },
    reasoning: `Open control ${index}.`,
    result: `Clicked el_${index}.`,
    observation: `URL: https://shop.example/${index}\n[link] Add to cart ${index}`,
    status: 'success',
    ...overrides,
  };
}

function request(steps: PromptStep[], current?: string, correction?: string): ProviderRequest {
  return {
    system: 'SYSTEM PROMPT',
    initialMessage: 'OBJECTIVE: compare headphones',
    steps,
    current: current === undefined ? undefined : { observation: current },
    correction,
    includeImages: true,
  };
}

const json = (value: unknown) => JSON.stringify(value);

describe('DeepSeek transcript', () => {
  it('extends the previous request instead of rewriting it', () => {
    const first = deepseekMessages(request([step(1), step(2)]));
    const second = deepseekMessages(request([step(1), step(2), step(3)]));

    // Every message the earlier request sent still sits at the same index.
    expect(second.slice(0, first.length)).toEqual(first);
    expect(second).toHaveLength(first.length + 2);
  });

  it('is byte-identical when the same history is serialised twice', () => {
    const a = json(deepseekMessages(request([step(1), step(2)])));
    const b = json(deepseekMessages(request([step(1), step(2)])));
    expect(a).toBe(b);
  });

  it('does not repeat a page it has already sent', () => {
    const steps = [step(1), step(2)];
    const withPage = deepseekMessages(request(steps, steps[1].observation));
    const withoutPage = deepseekMessages(request(steps));
    expect(withPage).toEqual(withoutPage);
  });

  it('appends a freshly captured page as the only new message', () => {
    const steps = [step(1), step(2)];
    const messages = deepseekMessages(request(steps, 'URL: https://shop.example/moved'));
    expect(messages).toHaveLength(2 + steps.length * 2 + 1);
    expect(json(messages.at(-1))).toContain('shop.example/moved');
  });

  it('keeps a correction at the very end so it cannot disturb history', () => {
    const steps = [step(1)];
    const plain = deepseekMessages(request(steps));
    const corrected = deepseekMessages(request(steps, undefined, 'Return one corrected call.'));
    expect(corrected.slice(0, plain.length)).toEqual(plain);
    expect(json(corrected.at(-1))).toContain('corrected');
  });

  it('keeps tool definitions identical between turns', () => {
    const first = buildOpenAIBody('deepseek-flash', request([step(1)]), false, false, true);
    const second = buildOpenAIBody('deepseek-flash', request([step(1), step(2)]), false, false, true);
    expect(json(second.tools)).toBe(json(first.tools));
  });

  it('keeps each screenshot on the step that produced it', () => {
    const steps = [step(1), step(2, { image: 'data:image/png;base64,AAA' }), step(3)];
    const messages = deepseekMessages(request(steps));
    const withImage = messages.filter((message) => json(message).includes('image_url'));
    expect(withImage).toHaveLength(1);
    expect(json(withImage[0])).toContain('Add to cart 2');
  });

  it('leaves history untouched when the live page changes', () => {
    const steps = [step(1), step(2)];
    const stable = deepseekMessages(request(steps, steps[1].observation));
    const moved = deepseekMessages(request(steps, 'URL: https://shop.example/other'));
    expect(moved.slice(0, stable.length)).toEqual(stable);
  });

  it('does not shift or drop messages in a long session', () => {
    const steps = Array.from({ length: 40 }, (_, index) => step(index + 1));
    const messages = deepseekMessages(request(steps));
    expect(messages[0]).toMatchObject({ role: 'system', content: 'SYSTEM PROMPT' });
    expect(messages[1]).toMatchObject({ role: 'user', content: 'OBJECTIVE: compare headphones' });
    // one assistant + one user turn per step, no window
    expect(messages).toHaveLength(2 + steps.length * 2);
    expect(json(messages[2])).toContain('STEP 1');
    expect(json(messages.at(-2))).toContain('STEP 40');
  });

  it('never puts the live page inside history', () => {
    const steps = [step(1), step(2)];
    const messages = deepseekMessages(request(steps, 'LIVE PAGE MARKER'));
    const hits = messages.filter((message) => json(message).includes('LIVE PAGE MARKER'));
    expect(hits).toHaveLength(1);
    expect(messages.at(-1)).toBe(hits[0]);
  });
});
