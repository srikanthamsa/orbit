const memory = new Map<string, unknown>();

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage?.local;
}

export async function readKey<T>(key: string, fallback: T): Promise<T> {
  if (memory.has(key)) return memory.get(key) as T;
  if (!hasChromeStorage()) return fallback;
  const stored = await chrome.storage.local.get(key);
  return (stored[key] as T | undefined) ?? fallback;
}

export async function writeKey<T>(key: string, value: T): Promise<void> {
  memory.set(key, value);
  if (!hasChromeStorage()) return;
  await chrome.storage.local.set({ [key]: value });
}

export async function removeKey(key: string): Promise<void> {
  memory.delete(key);
  if (!hasChromeStorage()) return;
  await chrome.storage.local.remove(key);
}

export async function readSession<T>(key: string): Promise<T | undefined> {
  if (!hasChromeStorage() || !chrome.storage.session) return memory.get(key) as T | undefined;
  const stored = await chrome.storage.session.get(key);
  return stored[key] as T | undefined;
}

export async function writeSession<T>(key: string, value: T): Promise<void> {
  memory.set(key, value);
  if (!hasChromeStorage() || !chrome.storage.session) return;
  await chrome.storage.session.set({ [key]: value });
}

export async function removeSession(key: string): Promise<void> {
  memory.delete(key);
  if (!hasChromeStorage() || !chrome.storage.session) return;
  await chrome.storage.session.remove(key);
}

export const KEYS = {
  settings: 'orbit.settings',
  providers: 'orbit.providers',
  credentials: 'orbit.credentials',
  history: 'orbit.history',
  checkpoint: 'orbit.checkpoint',
} as const;
