import type { TaskCheckpoint } from '@/types';
import { KEYS, readKey, removeKey, writeKey } from './base';

export async function saveCheckpoint(checkpoint: TaskCheckpoint): Promise<void> {
  await writeKey(KEYS.checkpoint, checkpoint);
}

export async function loadCheckpoint(): Promise<TaskCheckpoint | null> {
  return readKey<TaskCheckpoint | null>(KEYS.checkpoint, null);
}

export async function clearCheckpoint(): Promise<void> {
  await removeKey(KEYS.checkpoint);
}
