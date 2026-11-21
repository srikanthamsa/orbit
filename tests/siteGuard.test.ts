import { describe, expect, it } from 'vitest';
import { leavesNamedSite, namedSiteOf } from '@/agent/siteGuard';

describe('site-specific questions', () => {
  it('reads the site out of the phrasing that caused the bug', () => {
    // The exact request that sent the run to deepinfra.com.
    expect(namedSiteOf('what is deepseek token speed on commandcode website')).toBe('commandcode');
    expect(namedSiteOf('check the price on the flipkart page')).toBe('flipkart');
    expect(namedSiteOf('how fast is it on commandcode.com')).toBe('commandcode');
    expect(namedSiteOf('summarise deepinfra.com/blog/deepseek')).toBe('deepinfra');
  });

  it('does not invent a site', () => {
    expect(namedSiteOf('find the cheapest wireless headphones under 15000')).toBeNull();
    expect(namedSiteOf('what is deepseek token speed')).toBeNull();
    expect(namedSiteOf('compare the options on this page')).toBeNull();
  });

  it('flags the detour that produced a wrong answer', () => {
    const request = 'what is deepseek token speed on commandcode website';
    expect(leavesNamedSite(request, 'https://commandcode.com/docs', 'https://deepinfra.com/blog/x')).toBe(true);
    // A search engine is the same failure: its snippets are not that site's numbers.
    expect(leavesNamedSite(request, 'https://commandcode.com/docs', 'https://duckduckgo.com/?q=x')).toBe(true);
  });

  it('allows staying on the site and moving between its pages', () => {
    const request = 'what is deepseek token speed on commandcode website';
    expect(leavesNamedSite(request, 'https://commandcode.com/docs', 'https://commandcode.com/pricing')).toBe(false);
    expect(leavesNamedSite(request, 'https://commandcode.com/', 'https://docs.commandcode.com/x')).toBe(false);
  });

  it('says nothing when the request names no site', () => {
    expect(leavesNamedSite('what is deepseek token speed', 'https://commandcode.com', 'https://deepinfra.com')).toBe(false);
  });

  it('says nothing when the run did not start on the named site', () => {
    const request = 'compare prices on flipkart';
    expect(leavesNamedSite(request, 'https://amazon.in/s', 'https://flipkart.com/s')).toBe(false);
  });
});
