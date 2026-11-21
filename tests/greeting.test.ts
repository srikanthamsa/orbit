import { describe, expect, it } from 'vitest';
import { greeting, greetingPrompt } from '@/lib/utils';

const at = (hour: number, minute = 0) => new Date(2026, 10, 20, hour, minute, 0);

describe('greeting', () => {
  it('says something at every hour, and never calls the user a mortal', () => {
    // "mortal" was removed from the voice on request; the test now holds that
    // line instead of enforcing it.
    for (const hour of [0, 3, 6, 9, 13, 18, 21, 23]) {
      const line = greeting(at(hour));
      expect(line.length).toBeGreaterThan(0);
      expect(line.toLowerCase()).not.toContain('mortal');
    }
  });

  it('changes with the hour', () => {
    expect(greeting(at(9))).not.toBe(greeting(at(21)));
  });

  it('rotates through several lines per bucket', () => {
    const morning = new Set<string>();
    for (let i = 0; i < 40; i++) {
      morning.add(greeting(new Date(2026, 10, 20, 9, i * 20)));
    }
    expect(morning.size).toBeGreaterThanOrEqual(4);
  });

  it('is stable for a given moment', () => {
    expect(greeting(at(9, 7))).toBe(greeting(new Date(2026, 10, 20, 9, 7, 0)));
  });

  it('offers a rotating prompt line', () => {
    expect(greetingPrompt(at(9))).toMatch(/(help you with|we doing|we start|next)/);
  });
});
