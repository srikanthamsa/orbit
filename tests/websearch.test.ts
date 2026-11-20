import { describe, expect, it } from 'vitest';
import { formatSearchResults, parseSearchHtml } from '@/browser/websearch';

const fixture = `<!doctype html><html><body>
  <div class="result results_links web-result">
    <div class="result__body">
      <h2 class="result__title">
        <a rel="nofollow" class="result__a" href="https://www.amazon.com/dp/B0HBWF48WX">Vacuum Attachment Kit for Philips FC9352</a>
      </h2>
      <a class="result__snippet">Replacement tools that fit the FC9352 </a>
    </div>
  </div>
  <div class="result results_links web-result">
    <div class="result__body">
      <h2 class="result__title">
        <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Freview&amp;rut=abc">Hands-on: does it lift pet hair?</a>
      </h2>
      <a class="result__snippet">Owners report it copes well with pet hair.</a>
    </div>
  </div>
</body></html>`;

describe('web search parsing', () => {
  it('reads titles, direct links and snippets', () => {
    const results = parseSearchHtml(fixture);
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe('https://www.amazon.com/dp/B0HBWF48WX');
    expect(results[0].title).toContain('Philips FC9352');
    expect(results[0].snippet).toContain('Replacement tools');
  });

  it('unwraps the redirect links the endpoint sometimes returns', () => {
    const results = parseSearchHtml(fixture);
    expect(results[1].url).toBe('https://example.com/review');
  });

  it('ignores a challenge page', () => {
    expect(parseSearchHtml('<html><body><p>verification required</p></body></html>')).toEqual([]);
  });

  it('formats the hits for the model', () => {
    const text = formatSearchResults('pet hair', parseSearchHtml(fixture));
    expect(text).toContain('in the background');
    expect(text).toContain('1. ');
    expect(text).toContain('https://example.com/review');
  });
});
