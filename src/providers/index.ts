import type { BrowserAction, ProviderConfig } from '@/types';
import { BrowserActionSchema } from '@/types/actions';
import { capabilitiesFor } from './capabilities';
import { requestAnthropic } from './anthropic';
import { requestGemini } from './gemini';
import { requestOpenAI } from './openai';
import { SYSTEM_PROMPT } from './prompt';

import { ProviderError, type ProviderRequest, type ProviderResponse } from './types';

export interface ActionCallInput {
  config: ProviderConfig;
  apiKey: string;
  initialMessage: string;
  steps: ProviderRequest['steps'];
  correction?: string;
  signal?: AbortSignal;
}

export interface ActionCallResult {
  action: BrowserAction;
  reasoning?: string;
  providerReasoning?: string;
  text?: string;
  usage: ProviderResponse['usage'];
}

export async function requestAction(input: ActionCallInput): Promise<ActionCallResult> {
  const capabilities = capabilitiesFor(input.config);
  const visionNote = capabilities.vision
    ? 'Screenshots are available and you can see them.'
    : 'Screenshots are NOT available for this model. Never call screenshot; use element ids or click_at.';
  const request: ProviderRequest = {
    system: `${SYSTEM_PROMPT}\n\nRuntime capability: ${visionNote}`,
    initialMessage: input.initialMessage,
    steps: input.steps.map((step, index, all) => ({
      ...step,
      image: capabilities.vision && index === all.length - 1 ? step.image : undefined,
    })),
    correction: input.correction,
    includeImages: capabilities.vision,
    signal: input.signal,
  };

  let raw: unknown;
  let response: ProviderResponse;

  if (input.config.provider === 'anthropic') {
    const out = await requestAnthropic(input.config, input.apiKey, request);
    raw = out.raw;
    response = out.response;
  } else if (input.config.provider === 'gemini') {
    const out = await requestGemini(input.config, input.apiKey, request);
    raw = out.raw;
    response = out.response;
  } else {
    const out = await requestOpenAI(input.config, input.apiKey, request);
    raw = out.raw;
    response = out.response;
  }

  if (!raw || typeof raw !== 'object') {
    throw new ProviderError('The model did not return an action. Retrying usually fixes this.', input.config.provider);
  }

  const parsed = BrowserActionSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ProviderError(
      `The model returned an invalid action (${first?.path.join('.') || 'unknown'}: ${first?.message || 'invalid'}).`,
      input.config.provider,
    );
  }

  const reasoning =
    typeof (raw as Record<string, unknown>).reasoning === 'string'
      ? ((raw as Record<string, unknown>).reasoning as string)
      : undefined;

  return {
    action: parsed.data,
    reasoning,
    providerReasoning: response.providerReasoning,
    text: response.text,
    usage: response.usage,
  };
}

