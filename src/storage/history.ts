import type { TaskRecord } from '@/types';
import { KEYS, readKey, writeKey } from './base';

const MAX_RECORDS = 40;

export async function loadHistory(): Promise<TaskRecord[]> {
  return readKey<TaskRecord[]>(KEYS.history, []);
}

export async function saveRecord(record: TaskRecord): Promise<TaskRecord[]> {
  const history = await loadHistory();
  const next = [record, ...history.filter((r) => r.id !== record.id)].slice(0, MAX_RECORDS);
  await writeKey(KEYS.history, next);
  return next;
}

export async function removeRecord(id: string): Promise<void> {
  const history = await loadHistory();
  await writeKey(KEYS.history, history.filter((record) => record.id !== id));
}

export async function clearHistory(): Promise<void> {
  await writeKey(KEYS.history, []);
}
