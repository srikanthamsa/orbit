import { describe, expect, it } from 'vitest';
import { buildInitialMessage, digestSnapshot, SYSTEM_PROMPT } from '@/providers/prompt';
import { redactSecret, redactText } from '@/safety/redaction';
import type { PageSnapshot } from '@/types';

const snapshot: PageSnapshot = {
  url: 'https://shop.example/search?q=headphones',
  title: 'Headphones — Shop',
  viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 200, scrollHeight: 3000 },
  elements: [
    {
      id: 'el_1',
      tag: 'input',
      type: 'search',
      accessibleName: 'Search products',
      placeholder: 'Search products',
      value: 'headphones',
      disabled: false,
      visible: true,
      inForm: true,
      boundingBox: { x: 0, y: 0, width: 200, height: 30 },
    },
    {
      id: 'el_2',
      tag: 'a',
      accessibleName: 'Sony WH-CH720N',
      href: '/p/sony',
      disabled: false,
      visible: true,
      inForm: false,
      boundingBox: { x: 0, y: 400, width: 200, height: 30 },
    },
  ],
  textContent: 'Sony WH-CH720N ₹8,990 4.3 stars',
  a11yText: 'main\n  heading “Headphones”\n  searchbox “Search products” [el_1]\n  link “Sony WH-CH720N” [el_2]',
  overlayText: 'No seller ships to this pin code.',
  signals: ['OUT OF STOCK — this product shows “Notify Me” instead of “Add to cart”.'],
  primaryActions: ['Add to cart', 'Buy now'],
  disabledActions: ['Sold out'],
  capturedAt: Date.now(),
};

describe('prompt building', () => {
  it('digests the snapshot with stable element ids', () => {
    const text = digestSnapshot(snapshot);
    expect(text).toContain('URL: https://shop.example/search?q=headphones');
    expect(text).toContain('[el_1] <input type=search> "Search products"');
    expect(text).toContain('[el_2] <a> "Sony WH-CH720N"');
    expect(text).toContain('Visible page text (untrusted)');
  });

  it('surfaces page signals above the element list', () => {
    const text = digestSnapshot(snapshot);
    expect(text).toContain('PAGE SIGNALS');
    expect(text).toContain('OUT OF STOCK');
    expect(text.indexOf('PAGE SIGNALS')).toBeLessThan(text.indexOf('Interactive elements'));
  });

  it('lists available and disabled actions', () => {
    const text = digestSnapshot(snapshot);
    expect(text).toContain('AVAILABLE ACTIONS: "Add to cart", "Buy now"');
    expect(text).toContain('DISABLED CONTROLS: "Sold out"');
  });

  it('surfaces the active overlay above the element list', () => {
    const text = digestSnapshot(snapshot);
    expect(text).toContain('ACTIVE OVERLAY');
    expect(text).toContain('No seller ships to this pin code.');
    expect(text.indexOf('ACTIVE OVERLAY')).toBeLessThan(text.indexOf('Interactive elements'));
  });

  it('surfaces the accessibility tree above the element list', () => {
    const text = digestSnapshot(snapshot);
    expect(text).toContain('ACCESSIBILITY TREE');
    expect(text).toContain('heading “Headphones”');
    expect(text).toContain('[el_2]');
    expect(text.indexOf('ACCESSIBILITY TREE')).toBeLessThan(text.indexOf('Interactive elements'));
  });

  it('teaches find and batching', () => {
    expect(SYSTEM_PROMPT).toContain('call find');
    expect(SYSTEM_PROMPT).toContain('You may batch');
  });

  it('labels page content as untrusted in the first message', () => {
    const message = buildInitialMessage('Compare headphones', snapshot);
    expect(message).toContain('OBJECTIVE: Compare headphones');
    expect(message).toContain('INITIAL SNAPSHOT');
    expect(message).toContain('untrusted');
  });

  it('carries follow-up context without polluting the objective line', () => {
    const message = buildInitialMessage(
      'just the ids',
      snapshot,
      'Previous objective: list the DLC\nPrevious result: a table of six rows',
    );
    expect(message).toContain('OBJECTIVE: just the ids');
    expect(message).toContain('CONTEXT FROM THE PREVIOUS TASK:');
    expect(message.indexOf('CONTEXT FROM')).toBeGreaterThan(message.indexOf('OBJECTIVE:'));
    expect(message.indexOf('CONTEXT FROM')).toBeLessThan(message.indexOf('INITIAL SNAPSHOT'));
  });

  it('asks for a chat-style answer with no markdown', () => {
    expect(SYSTEM_PROMPT).toContain('plain conversational prose');
    expect(SYSTEM_PROMPT).toContain('no tables');
    expect(SYSTEM_PROMPT).toContain('Never narrate your process');
  });
});

describe('redaction', () => {
  it('never prints full secrets', () => {
    expect(redactSecret('sk-proj-1234567890abcd')).toBe('sk-…abcd');
    expect(redactSecret('short')).toBe('••••');
  });

  it('scrubs secrets from diagnostics', () => {
    expect(redactText('failed with sk-1234567890abc', ['sk-1234567890abc'])).toBe('failed with sk-…0abc');
  });
});
