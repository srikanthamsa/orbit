import type { Settings } from '@/types';
import { KEYS, readKey, writeKey } from './base';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  maxSteps: 25,
  maxCostUsd: 2,
  approvalMode: 'sensitive',
  sessionOnlyKeys: true,
};

export async function loadSettings(): Promise<Settings> {
  const stored = await readKey<Partial<Settings>>(KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeKey(KEYS.settings, settings);
}
