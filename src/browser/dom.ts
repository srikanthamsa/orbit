import type { PageSnapshot } from '@/types';
import { pageOperation, type FindMatch, type PageOp, type PageOpResult } from './injected';

export interface PageResult {
  ok: boolean;
  message: string;
  label?: string;
}

async function runOp(tabId: number, op: PageOp): Promise<PageOpResult> {
  if (typeof chrome === 'undefined' || !chrome.scripting) {
    throw new Error('Chrome extension APIs are not available.');
  }
  let results: chrome.scripting.InjectionResult<PageOpResult>[];
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId },
      func: pageOperation as unknown as (input: unknown) => PageOpResult,
      args: [op as unknown],
      world: 'ISOLATED',
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/cannot access|Cannot access|chrome:\/\//i.test(raw)) {
      throw new Error('Chrome blocks extensions on this page. Open a regular website and try again.');
    }
    if (/No tab with id/i.test(raw)) throw new Error('The tab was closed.');
    throw new Error(raw);
  }
  const first = results?.[0];
  if (!first) throw new Error('The page returned no result.');
  return first.result as PageOpResult;
}

export async function captureSnapshot(tabId: number): Promise<PageSnapshot> {
  const result = await runOp(tabId, { op: 'snapshot' });
  if (!result.ok || !result.snapshot) throw new Error(result.message || 'Could not read this page.');
  return result.snapshot;
}

const toPageResult = (r: PageOpResult): PageResult => ({ ok: r.ok, message: r.message, label: r.label });

export async function pageClick(tabId: number, elementId: string): Promise<PageResult> {
  return toPageResult(await runOp(tabId, { op: 'click', elementId }));
}

export async function pageType(tabId: number, elementId: string, text: string): Promise<PageResult> {
  return toPageResult(await runOp(tabId, { op: 'type', elementId, text }));
}

export async function pageScroll(tabId: number, direction: 'up' | 'down', amount: number): Promise<PageResult> {
  return toPageResult(await runOp(tabId, { op: 'scroll', direction, amount }));
}

export async function pagePressKey(tabId: number, key: string): Promise<PageResult> {
  return toPageResult(await runOp(tabId, { op: 'press_key', key }));
}

export async function pageClickAt(tabId: number, x: number, y: number): Promise<PageResult> {
  return toPageResult(await runOp(tabId, { op: 'click_at', x, y }));
}

export async function pageFind(
  tabId: number,
  query: string,
  role?: string,
  limit?: number,
): Promise<{ matches: FindMatch[]; message: string }> {
  const result = await runOp(tabId, { op: 'find', query, role, limit });
  return { matches: result.find ?? [], message: result.message };
}

export async function pageElementAt(
  tabId: number,
  x: number,
  y: number,
): Promise<{ tag: string; type?: string; label: string; inForm: boolean } | null> {
  const result = await runOp(tabId, { op: 'element_at', x, y });
  return result.element ?? null;
}

export async function pageActiveElement(
  tabId: number,
): Promise<{ tag: string; inForm: boolean; label: string } | null> {
  const result = await runOp(tabId, { op: 'active_element' });
  return result.active ?? null;
}
