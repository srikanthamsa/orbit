import { describe, expect, it } from 'vitest';
import { assessAction } from '@/safety/policy';
import type { InteractiveElement } from '@/types';

function element(overrides: Partial<InteractiveElement>): InteractiveElement {
  return {
    id: 'el_1',
    tag: 'button',
    accessibleName: 'Button',
    disabled: false,
    visible: true,
    inForm: false,
    boundingBox: { x: 0, y: 0, width: 10, height: 10 },
    ...overrides,
  };
}

describe('approval policy', () => {
  it('requires approval for submit controls', () => {
    const risk = assessAction({
      action: { type: 'click', elementId: 'el_1' },
      target: element({ type: 'submit', accessibleName: 'Continue' }),
      mode: 'sensitive',
    });
    expect(risk?.requiresApproval).toBe(true);
  });

  it('requires approval for sending and destructive labels', () => {
    for (const label of ['Send message', 'Delete account', 'Place order', 'Buy now', 'Transfer funds']) {
      const risk = assessAction({
        action: { type: 'click', elementId: 'el_1' },
        target: element({ accessibleName: label, inForm: true }),
        mode: 'sensitive',
      });
      expect(risk?.requiresApproval, label).toBe(true);
    }
  });

  it('allows ordinary reading and navigation clicks', () => {
    const risk = assessAction({
      action: { type: 'click', elementId: 'el_1' },
      target: element({ tag: 'a', accessibleName: 'View all results' }),
      mode: 'sensitive',
    });
    expect(risk).toBeNull();
  });

  it('never asks approval for a read-only find', () => {
    expect(assessAction({ action: { type: 'find', query: 'delete account' }, mode: 'all' })).toBeNull();
  });

  it('assesses coordinate clicks by their target', () => {
    const risk = assessAction({
      action: { type: 'click_at', x: 0.5, y: 0.5 },
      coordinatesTarget: { tag: 'button', type: 'submit', inForm: true, accessibleName: 'Apply now' },
      mode: 'sensitive',
    });
    expect(risk?.requiresApproval).toBe(true);
  });

  it('flags Enter inside a form', () => {
    const risk = assessAction({
      action: { type: 'press_key', key: 'Enter' },
      focusedElement: { inForm: true },
      mode: 'sensitive',
    });
    expect(risk?.requiresApproval).toBe(true);

    const outside = assessAction({
      action: { type: 'press_key', key: 'Enter' },
      focusedElement: { inForm: false },
      mode: 'sensitive',
    });
    expect(outside).toBeNull();
  });

  it('approves every mutating action in strict mode', () => {
    const click = assessAction({
      action: { type: 'click', elementId: 'el_1' },
      target: element({ tag: 'a', accessibleName: 'Docs' }),
      mode: 'all',
    });
    expect(click?.requiresApproval).toBe(true);

    const finish = assessAction({ action: { type: 'finish', summary: 'done' }, mode: 'all' });
    expect(finish).toBeNull();
  });
});

describe('search risk', () => {
  it('does not ask for approval in sensitive mode', () => {
    const risk = assessAction({
      action: { type: 'search', query: 'pet hair vacuum' },
      mode: 'sensitive',
    });
    expect(risk).toBeNull();
  });

  it('never asks, because a background read does not touch the page', () => {
    const risk = assessAction({
      action: { type: 'search', query: 'pet hair vacuum' },
      mode: 'all',
    });
    expect(risk).toBeNull();
  });
});
