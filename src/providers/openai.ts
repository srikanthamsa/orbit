import type { ProviderConfig } from '@/types';
import { friendlyHttpError } from '@/safety/redaction';
import { ACTION_TOOL_DESCRIPTION, ACTION_TOOL_NAME, ACTION_TOOL_SCHEMA, stripEmpty } from './schema';
import {
  extractJsonObject,
  ProviderError,
  toUsage,
  type ProviderRequest,
  type ProviderResponse,
  type RequestShape,
} from './types';

export const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1';
export const DEEPSEEK_DEFAULT_BASE = 'https://api.deepseek.com';

function nativeMessages(req: ProviderRequest): Record<string, unknown>[] {
  const messages: Record<string, unknown>[] = [
    { role: 'system', content: req.system },
    { role: 'user', content: req.initialMessage },
  ];
  for (const step of req.steps) {
    messages.push({
      role: 'assistant',
      content: step.reasoning ?? null,
      ...(step.providerReasoning ? { reasoning_content: step.providerReasoning } : {}),
      tool_calls: [
        {
          id: step.id,
          type: 'function',
          function: { name: ACTION_TOOL_NAME, arguments: JSON.stringify(stripEmpty({ ...step.action })) },
        },
      ],
    });
    messages.push({
      role: 'tool',
      tool_call_id: step.id,
      content: `${step.result}\n\n${step.observation}`,
    });
  }
  if (req.current) {
    const text = `Page now:\n${req.current.observation}`;
    messages.push(
      req.includeImages && req.current.image
        ? {
            role: 'user',
            content: [
              { type: 'text', text },
              { type: 'image_url', image_url: { url: req.current.image, detail: 'low' } },
            ],
          }
        : { role: 'user', content: text },
    );
  }
  if (req.correction) messages.push({ role: 'user', content: req.correction });
  return messages;
}

/**
 * Some OpenAI-compatible reasoning APIs (e.g. DeepSeek thinking mode) reject
 * replayed assistant tool-call turns unless provider-internal fields are echoed
 * back exactly. Replaying the history as plain text avoids that contract
 * entirely while keeping every action and observation in context.
 */
function flatMessages(req: ProviderRequest): Record<string, unknown>[] {
  const messages: Record<string, unknown>[] = [{ role: 'system', content: req.system }];
  if (req.steps.length === 0) {
    messages.push({ role: 'user', content: req.initialMessage });
    return messages;
  }
  const history = req.steps
    .map((step, index) => {
      const status = step.status === 'success' ? '' : ` (${step.status})`;
      return [
        `Step ${index + 1}: ${JSON.stringify(stripEmpty({ ...step.action }))}${status}`,
        `Result: ${step.result}`,
        `Page after action:\n${step.observation}`,
      ].join('\n');
    })
    .join('\n\n');
  const blocks = [
    req.initialMessage,
    '',
    'HISTORY — actions you already completed. Do not repeat them.',
    '',
    history,
  ];
  if (req.current) blocks.push('', 'PAGE NOW', req.current.observation);
  blocks.push(
    '',
    'Continue from the page state above and choose the next action.',
  );
  let text = blocks.join('\n');
  if (req.correction) text += `\n\n${req.correction}`;

  if (req.includeImages && req.current?.image) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text },
        { type: 'image_url', image_url: { url: req.current.image, detail: 'low' } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: text });
  }
  return messages;
}

export function buildOpenAIBody(
  model: string,
  req: ProviderRequest,
  forceTool: boolean,
  flatHistory = false,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: flatHistory ? flatMessages(req) : nativeMessages(req),
    tools: [
      {
        type: 'function',
        function: { name: ACTION_TOOL_NAME, description: ACTION_TOOL_DESCRIPTION, parameters: ACTION_TOOL_SCHEMA },
      },
    ],
  };
  if (forceTool) body.tool_choice = { type: 'function', function: { name: ACTION_TOOL_NAME } };
  return body;
}

export function buildOpenAIRequest(
  config: ProviderConfig,
  apiKey: string,
  req: ProviderRequest,
): RequestShape {
  const base =
    config.baseUrl?.trim() ||
    (config.provider === 'deepseek' ? DEEPSEEK_DEFAULT_BASE : OPENAI_DEFAULT_BASE);
  return {
    url: `${base.replace(/\/$/, '')}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: buildOpenAIBody(
      config.model,
      req,
      config.provider === 'openai',
      // DeepSeek's thinking mode rejects native tool-call replays; compatible
      // proxies are often DeepSeek under the hood, so they use the same path.
      config.provider === 'deepseek' || config.provider === 'compatible',
    ),
  };
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
  error?: { message?: string };
}

export function parseOpenAI(json: OpenAIResponse): Omit<ProviderResponse, 'action'> & { rawAction: unknown } {
  const message = json.choices?.[0]?.message;
  const call = message?.tool_calls?.[0];
  let rawAction: unknown = null;
  if (call?.function?.arguments) {
    try {
      rawAction = JSON.parse(call.function.arguments);
    } catch {
      rawAction = null;
    }
  }
  if (!rawAction && message?.content) rawAction = extractJsonObject(message.content);
  return {
    rawAction,
    text: message?.content ?? undefined,
    providerReasoning: message?.reasoning_content ?? undefined,
    usage: toUsage(
      json.usage?.prompt_tokens ?? 0,
      json.usage?.completion_tokens ?? 0,
      json.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    ),
  };
}

export async function requestOpenAI(
  config: ProviderConfig,
  apiKey: string,
  req: ProviderRequest,
): Promise<{ response: ProviderResponse; raw: unknown }> {
  const shape = buildOpenAIRequest(config, apiKey, req);
  const timeout = AbortSignal.timeout(120_000);
  const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
  const res = await fetch(shape.url, {
    method: 'POST',
    headers: shape.headers,
    body: JSON.stringify(shape.body),
    signal,
  });
  let json: OpenAIResponse = {};
  try {
    json = (await res.json()) as OpenAIResponse;
  } catch {
    json = {};
  }
  if (!res.ok) {
    const friendly = friendlyHttpError(res.status, config.provider === 'deepseek' ? 'DeepSeek' : 'OpenAI');
    const detail = json.error?.message ? ` ${json.error.message.slice(0, 240)}` : '';
    throw new ProviderError(`${friendly}${detail}`, config.provider, res.status);
  }
  const parsed = parseOpenAI(json);
  return {
    response: {
      action: parsed.rawAction as ProviderResponse['action'],
      text: parsed.text,
      providerReasoning: parsed.providerReasoning,
      usage: parsed.usage,
    },
    raw: parsed.rawAction,
  };
}
