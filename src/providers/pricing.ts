import type { Usage } from '@/types';

interface PriceRow {
  match: string;
  inputPerM: number;
  outputPerM: number;
}

/**
 * Cached input is billed far below list, and the discount differs by vendor:
 * DeepSeek and Anthropic charge about a tenth of the input rate for a cache
 * read, Gemini about a quarter, OpenAI a half.
 */
export function cachedRateFor(model: string, inputPerM: number): number {
  const name = model.toLowerCase();
  if (name.includes('deepseek') || name.includes('claude')) return inputPerM * 0.1;
  if (name.includes('gemini')) return inputPerM * 0.25;
  return inputPerM * 0.5;
}

/** Approximate public list prices, USD per million tokens. Estimates only. */
const PRICES: PriceRow[] = [
  { match: 'gpt-5-mini', inputPerM: 0.25, outputPerM: 2 },
  { match: 'gpt-5', inputPerM: 1.25, outputPerM: 10 },
  { match: 'gpt-4.1-mini', inputPerM: 0.4, outputPerM: 1.6 },
  { match: 'gpt-4.1-nano', inputPerM: 0.1, outputPerM: 0.4 },
  { match: 'gpt-4.1', inputPerM: 2, outputPerM: 8 },
  { match: 'gpt-4o-mini', inputPerM: 0.15, outputPerM: 0.6 },
  { match: 'gpt-4o', inputPerM: 2.5, outputPerM: 10 },
  { match: 'o4-mini', inputPerM: 1.1, outputPerM: 4.4 },
  { match: 'o3-mini', inputPerM: 1.1, outputPerM: 4.4 },
  { match: 'claude-opus-4', inputPerM: 15, outputPerM: 75 },
  { match: 'claude-sonnet-4', inputPerM: 3, outputPerM: 15 },
  { match: 'claude-3-7-sonnet', inputPerM: 3, outputPerM: 15 },
  { match: 'claude-haiku-4', inputPerM: 1, outputPerM: 5 },
  { match: 'claude-3-5-haiku', inputPerM: 0.8, outputPerM: 4 },
  { match: 'claude-3-5-sonnet', inputPerM: 3, outputPerM: 15 },
  { match: 'gemini-2.5-pro', inputPerM: 1.25, outputPerM: 10 },
  { match: 'gemini-2.5-flash', inputPerM: 0.3, outputPerM: 2.5 },
  { match: 'gemini-2.0-flash', inputPerM: 0.1, outputPerM: 0.4 },
  { match: 'deepseek-v4-pro', inputPerM: 1.32, outputPerM: 3.96 },
  { match: 'deepseek-flash', inputPerM: 0.3, outputPerM: 1.2 },
  { match: 'deepseek-v4-flash', inputPerM: 0.3, outputPerM: 1.2 },
];

// Conservative peak-hour estimate; DeepSeek off-peak is half these rates.
const DEEPSEEK_FALLBACK: PriceRow = { match: 'deepseek', inputPerM: 0.3, outputPerM: 1.2 };

export function priceFor(model: string): PriceRow | null {
  const name = model.toLowerCase();
  return (
    PRICES.find((row) => name.includes(row.match)) ??
    (name.includes('deepseek') ? DEEPSEEK_FALLBACK : null)
  );
}

export function estimateCost(model: string, usage: Usage): number | undefined {
  const price = priceFor(model);
  if (!price) return undefined;
  const cachedTokens = usage.cachedTokens ?? 0;
  const uncachedInput = Math.max(0, usage.inputTokens - cachedTokens);
  const cachedRate = cachedRateFor(model, price.inputPerM);
  const inputCost = (uncachedInput / 1_000_000) * price.inputPerM;
  const cachedCost = (cachedTokens / 1_000_000) * cachedRate;
  const outputCost = (usage.outputTokens / 1_000_000) * price.outputPerM;
  return inputCost + cachedCost + outputCost;
}

export function addUsage(a: Usage, b: Usage, model: string): Usage {
  const hit = (a.cacheHitTokens ?? 0) + (b.cacheHitTokens ?? 0);
  const miss = (a.cacheMissTokens ?? 0) + (b.cacheMissTokens ?? 0);
  const merged: Usage = {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cachedTokens: (a.cachedTokens ?? 0) + (b.cachedTokens ?? 0) || undefined,
    cacheHitTokens: hit || undefined,
    cacheMissTokens: hit || miss ? miss : undefined,
  };
  merged.costUsd = (a.costUsd ?? 0) + (b.costUsd ?? estimateCost(model, b) ?? 0);
  return merged;
}
