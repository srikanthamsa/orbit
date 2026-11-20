import { sleepAbortable } from '@/lib/utils';

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  if (typeof chrome === 'undefined' || !chrome.tabs) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

export async function getTab(tabId: number): Promise<chrome.tabs.Tab | null> {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}

export async function focusTab(tabId: number): Promise<void> {
  const tab = await getTab(tabId);
  if (!tab) return;
  await chrome.tabs.update(tabId, { active: true });
  if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
}

export async function navigateTab(tabId: number, url: string): Promise<void> {
  await chrome.tabs.update(tabId, { url });
}

export function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  return /^(chrome|edge|brave|opera|vivaldi|about|devtools|view-source|chrome-extension|https:\/\/chromewebstore\.google\.com)/.test(
    url,
  );
}

export type OrbitGroupState = 'working' | 'waiting' | 'paused' | 'done' | 'failed';

const ORBIT_GROUP_TITLE = 'ORBIT';
const GROUP_COLORS: Record<OrbitGroupState, chrome.tabGroups.ColorEnum> = {
  working: 'blue',
  waiting: 'orange',
  paused: 'grey',
  done: 'green',
  failed: 'red',
};

function tabGroupsAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.tabs && !!chrome.tabGroups;
}

async function orbitGroupFor(tabId: number): Promise<number | null> {
  if (!tabGroupsAvailable()) return null;
  const tab = await chrome.tabs.get(tabId);
  if (tab.groupId !== undefined && tab.groupId !== -1) {
    const group = await chrome.tabGroups.get(tab.groupId).catch(() => null);
    return group?.title === ORBIT_GROUP_TITLE ? tab.groupId : null;
  }
  const groupId = await chrome.tabs.group({ tabIds: [tabId] });
  await chrome.tabGroups
    .update(groupId, { title: ORBIT_GROUP_TITLE, color: GROUP_COLORS.working })
    .catch(() => {});
  return groupId;
}

/**
 * Put the controlled tab in an ORBIT group and reflect the run state. Tabs the
 * user already grouped are left alone; we only recolor a group we own.
 */
const groupQueues = new Map<number, Promise<void>>();

export async function setOrbitGroupState(tabId: number, state: OrbitGroupState): Promise<void> {
  if (!tabGroupsAvailable()) return;
  // Status events can arrive faster than Chrome's grouping calls; serialize per
  // tab so two "ungrouped" snapshots cannot create duplicate groups or an
  // older colour cannot land after the final one.
  const previous = groupQueues.get(tabId) ?? Promise.resolve();
  const next = previous
    .then(async () => {
      const groupId = await orbitGroupFor(tabId);
      if (groupId === null) return;
      await chrome.tabGroups.update(groupId, {
        title: ORBIT_GROUP_TITLE,
        color: GROUP_COLORS[state],
      });
    })
    .catch(() => {
      // Grouping is a convenience; restricted tabs and closed windows can refuse it.
    });
  groupQueues.set(tabId, next);
  await next;
  if (groupQueues.get(tabId) === next) groupQueues.delete(tabId);
}

export function waitForTabComplete(tabId: number, timeoutMs = 20000, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const timer = setTimeout(finish, timeoutMs);
    const onUpdated = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === 'complete') finish();
    };
    const onRemoved = (id: number) => {
      if (id === tabId) fail(new Error('The tab was closed.'));
    };
    const onAbort = () => fail(new DOMException('Aborted', 'AbortError'));
    function cleanup() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      signal?.removeEventListener('abort', onAbort);
    }

    if (signal?.aborted) return fail(new DOMException('Aborted', 'AbortError'));
    signal?.addEventListener('abort', onAbort, { once: true });
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    void getTab(tabId).then((tab) => {
      if (tab?.status === 'complete') finish();
    });
  });
}

export async function navigateAndSettle(
  tabId: number,
  url: string,
  signal?: AbortSignal,
  settleMs = 500,
): Promise<void> {
  await navigateTab(tabId, url);
  await waitForTabComplete(tabId, 20000, signal);
  await sleepAbortable(settleMs, signal);
}
