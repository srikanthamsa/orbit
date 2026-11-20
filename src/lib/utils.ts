export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function uid(prefix = 'id'): string {
  const rand = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${rand.replace(/-/g, '').slice(0, 12)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function hostnameOf(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function originPattern(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return `${u.protocol}//${u.hostname}/*`;
  } catch {
    return null;
  }
}

type Bucket = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

const GREETINGS: Record<Bucket, string[]> = {
  dawn: [
    'Up before the sun, mortal.',
    'Dawn, mortal. Bold.',
    'Nobody is awake, mortal.',
    'Early, mortal. Very early.',
    'The sun is late, mortal.',
    'Quiet hours, mortal.',
  ],
  morning: [
    'Good morning, mortal.',
    'Morning, mortal. Coffee first.',
    'Morning, mortal. What are we breaking?',
    'Fresh morning, mortal.',
    'Good morning, mortal. Let us begin.',
    'Morning, mortal. Bright eyes.',
    'New day, mortal.',
  ],
  afternoon: [
    'Good afternoon, mortal.',
    'Afternoon, mortal. Let us be useful.',
    'The afternoon is yours, mortal.',
    'Good afternoon, mortal. What next?',
    'Post-lunch, mortal. Sharp?',
    'Afternoon, mortal.',
  ],
  evening: [
    'Good evening, mortal.',
    'Evening, mortal. What is the plan?',
    'Good evening, mortal. Still going.',
    'Evening, mortal. One more task?',
    'The day is nearly spent, mortal.',
    'Good evening, mortal. Make it count.',
  ],
  night: [
    'Late one, mortal.',
    'Still awake, mortal?',
    'Night, mortal. Quiet out there.',
    'The hour is late, mortal.',
    'Again, mortal? Respect.',
    'Good night, mortal. Or is it?',
  ],
};

const PROMPTS = [
  'What can I help you with?',
  'What are we doing?',
  'Where do we start?',
  "What's next?",
];

function bucketOf(hour: number): Bucket {
  if (hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

/** Stable for the whole browser session, so two opens differ. */
function sessionOffset(): number {
  try {
    const KEY = 'orbit:greet';
    const existing = Number(window.sessionStorage.getItem(KEY));
    if (Number.isFinite(existing) && existing > 0) return existing;
    const fresh = Math.floor(Math.random() * 997) + 1;
    window.sessionStorage.setItem(KEY, String(fresh));
    return fresh;
  } catch {
    return 0;
  }
}

/** Rotates every 20 minutes so a long session is not stuck on one line. */
function slot(now: Date): number {
  return Math.floor(now.getTime() / (20 * 60 * 1000)) + sessionOffset();
}

export function greeting(now = new Date()): string {
  const pool = GREETINGS[bucketOf(now.getHours())];
  return pool[slot(now) % pool.length];
}

export function greetingPrompt(now = new Date()): string {
  return PROMPTS[slot(now) % PROMPTS.length];
}

export function timeAgo(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0.00';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
