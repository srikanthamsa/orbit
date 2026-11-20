import { originPattern } from '@/lib/utils';

const PROVIDER_ORIGINS = [
  'https://api.openai.com/*',
  'https://api.anthropic.com/*',
  'https://generativelanguage.googleapis.com/*',
  'https://api.deepseek.com/*',
];

export async function hasOriginAccess(url: string): Promise<boolean> {
  const pattern = originPattern(url);
  if (!pattern) return false;
  if (typeof chrome === 'undefined' || !chrome.permissions) return false;
  try {
    return await chrome.permissions.contains({ origins: [pattern] });
  } catch {
    return false;
  }
}

/**
 * Must be called from a user gesture (button click). Chrome rejects
 * permission prompts that are not tied to user interaction.
 */
export async function requestOriginAccess(url: string): Promise<boolean> {
  const pattern = originPattern(url);
  if (!pattern) return false;
  if (typeof chrome === 'undefined' || !chrome.permissions) return false;
  try {
    return await chrome.permissions.request({ origins: [pattern] });
  } catch {
    return false;
  }
}

export async function requestHostAccessForBaseUrl(baseUrl: string): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions) return false;
  try {
    return await chrome.permissions.request({ origins: [`${new URL(baseUrl).origin}/*`] });
  } catch {
    return false;
  }
}

/** True when the user has granted the optional "all websites" access. */
export async function hasBroadSiteAccess(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions) return false;
  try {
    // <all_urls> is what Chrome's captureVisibleTab checks for, so a broad
    // grant is modelled (and requested) as that exact pattern.
    return await chrome.permissions.contains({ origins: ['<all_urls>'] });
  } catch {
    return false;
  }
}

export async function requestBroadSiteAccess(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions) return false;
  try {
    return await chrome.permissions.request({ origins: ['<all_urls>'] });
  } catch {
    return false;
  }
}

export async function grantedSiteOrigins(): Promise<string[]> {
  if (typeof chrome === 'undefined' || !chrome.permissions) return [];
  try {
    const all = await chrome.permissions.getAll();
    return (all.origins ?? []).filter(
      (origin) => /^https?:\/\//.test(origin) && !PROVIDER_ORIGINS.includes(origin),
    );
  } catch {
    return [];
  }
}

/** Removes every runtime-granted http(s) origin, keeping provider endpoints. */
export async function revokeSiteAccess(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.permissions) return;
  try {
    const all = await chrome.permissions.getAll();
    const origins = (all.origins ?? []).filter(
      (origin) =>
        (origin === '<all_urls>' || /^https?:\/\//.test(origin)) && !PROVIDER_ORIGINS.includes(origin),
    );
    if (origins.length > 0) await chrome.permissions.remove({ origins });
  } catch {
    // Nothing granted, or Chrome refused; there is nothing else to do.
  }
}
