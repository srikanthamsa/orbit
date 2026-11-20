export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

const MAX_RESULTS = 6;

/** DuckDuckGo's html endpoint wraps every hit in a /l/?uddg=<target> redirect. */
function decodeResultUrl(href: string): string {
  try {
    const url = new URL(href, 'https://duckduckgo.com');
    const target = url.searchParams.get('uddg');
    const resolved = target ? decodeURIComponent(target) : url.toString();
    return /^https?:\/\//i.test(resolved) ? resolved : '';
  } catch {
    return '';
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  '#39': "'",
  '&#x27': "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

function plainText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/&([a-z#0-9x]+);/gi, (match, name: string) => ENTITIES[name] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

function anchorHref(attributes: string): string {
  const match = /href="([^"]*)"/i.exec(attributes);
  return match ? match[1].replace(/&amp;/g, '&') : '';
}

/**
 * Reads the results page without a DOM so the same code runs in the extension
 * and in tests. Each hit is a `result` block holding a titled anchor and an
 * optional snippet anchor.
 */
export function parseSearchHtml(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const chunks = html.split(/<div[^>]*class="[^"]*\bresult\b[^"]*"/i).slice(1);
  for (const chunk of chunks) {
    let title = '';
    let href = '';
    let snippet = '';
    const anchors = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let anchor: RegExpExecArray | null;
    while ((anchor = anchors.exec(chunk)) !== null) {
      const attributes = anchor[1];
      const text = plainText(anchor[2]);
      if (!title && /class="[^"]*result__a/.test(attributes)) {
        title = text;
        href = anchorHref(attributes);
      } else if (!snippet && /class="[^"]*result__snippet/.test(attributes)) {
        snippet = text;
      }
    }
    const url = decodeResultUrl(href);
    if (!url || !title) continue;
    results.push({ title: title.slice(0, 160), url, snippet: snippet.slice(0, 240) });
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}

const ENDPOINT = 'https://html.duckduckgo.com/html/';

/**
 * Reads a search results page off-screen. Nothing is rendered in the user's
 * tab and the tab is never navigated; the hits come back as data.
 *
 * The endpoint only answers a form POST — a plain GET is served a challenge
 * page — so the query travels in the body.
 */
export async function webSearch(query: string): Promise<WebSearchResult[]> {
  const body = new URLSearchParams({ q: query, b: '', kl: 'us-en' });
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'text/html,application/xhtml+xml',
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`The web search service answered ${response.status}.`);
  }
  return parseSearchHtml(await response.text());
}

export function formatSearchResults(query: string, results: WebSearchResult[]): string {
  const lines = results.map(
    (result, index) =>
      `${index + 1}. ${result.title}\n   ${result.url}${result.snippet ? `\n   ${result.snippet}` : ''}`,
  );
  return [
    `Searched the web for “${query}” in the background. The tab was not touched.`,
    'Top results:',
    ...lines,
    'Answer from these results, or navigate to one when you need its page.',
  ].join('\n');
}
