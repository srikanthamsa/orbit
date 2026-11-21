import { describe, expect, it } from 'vitest';
import { shouldNavigateInBackground } from '@/agent/navigation';

const research = { research: true, homeUrl: 'https://www.youtube.com/watch?v=1', inBackgroundTab: false };
const acting = { research: false, homeUrl: 'https://www.amazon.in/s?k=xx', inBackgroundTab: false };

describe('where a navigation runs', () => {
  it('hides the pages a research run opens', () => {
    // The reported case: on YouTube, the agent goes off to read an article.
    expect(shouldNavigateInBackground(research, 'https://wrestletalk.com/features/x')).toBe(true);
    expect(shouldNavigateInBackground(research, 'https://www.si.com/fannation/wrestling/y')).toBe(true);
  });

  it('keeps a shopping or booking run in the tab the user is watching', () => {
    expect(shouldNavigateInBackground(acting, 'https://www.amazon.in/dp/B0')).toBe(false);
  });

  it('stays on the page the run started from', () => {
    expect(shouldNavigateInBackground(research, 'https://www.youtube.com/results?q=x')).toBe(false);
  });

  it('keeps using the tab it is already hiding in', () => {
    expect(shouldNavigateInBackground({ ...acting, inBackgroundTab: true }, 'https://example.com/a')).toBe(true);
  });

  it('never moves a non-web target', () => {
    expect(shouldNavigateInBackground(research, 'chrome://settings')).toBe(false);
    expect(shouldNavigateInBackground(research, 'not a url')).toBe(false);
  });
});
