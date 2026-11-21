import type { BrowserAction, StepStatus, Usage } from '@/types';

export interface PromptStep {
  id: string;
  action: BrowserAction;
  reasoning?: string;
  /** Provider-native chain of thought, replayed when the API requires it. */
  providerReasoning?: string;
  result: string;
  observation: string;
  status: StepStatus;
}

export interface ProviderRequest {
  system: string;
  initialMessage: string;
  steps: PromptStep[];
  /**
   * The page as it stands now, kept out of the step history. History messages
   * must never change after they are sent, or the provider's prompt cache is
   * invalidated from the first changed byte; the live page therefore travels
   * as its own trailing block.
   */
  current?: { observation: string; image?: string };
  correction?: string;
  includeImages: boolean;
  signal?: AbortSignal;
}

export interface ProviderResponse {
  action: BrowserAction;
  reasoning?: string;
  providerReasoning?: string;
  text?: string;
  usage: Usage;
}

export class ProviderError extends Error {
  readonly status?: number;
  readonly provider: string;

  constructor(message: string, provider: string, status?: number) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider;
    this.status = status;
  }
}

export interface RequestShape {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function toUsage(inputTokens = 0, outputTokens = 0, cachedTokens = 0): Usage {
  return {
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    cachedTokens: cachedTokens || undefined,
  };
}
