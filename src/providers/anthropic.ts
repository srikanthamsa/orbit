import type { ProviderConfig } from '@/types';
import { friendlyHttpError } from '@/safety/redaction';
import { ACTION_TOOL_DESCRIPTION, ACTION_TOOL_NAME, ACTION_TOOL_SCHEMA, stripEmpty } from './schema';
import {
  ProviderError,
  toUsage,
  type ProviderRequest,
  type ProviderResponse,
  type RequestShape,
} from './types';

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';

function splitDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return { mediaType: 'image/jpeg', data: dataUrl.replace(/^data:[^,]*,/, '') };
  return { mediaType: match[1] ?? 'image/jpeg', data: match[2] ?? '' };
}

type Block = Record<string, unknown>;

export function buildAnthropicMessages(req: ProviderRequest): Block[] {
  const messages: Array<{ role: 'user' | 'assistant'; content: Block[] }> = [
    { role: 'user', content: [{ type: 'text', text: req.initialMessage }] },
  ];

  for (const step of req.steps) {
    const assistant: Block[] = [];
    if (step.reasoning) assistant.push({ type: 'text', text: step.reasoning });
    assistant.push({
      type: 'tool_use',
      id: step.id,
      name: ACTION_TOOL_NAME,
      input: stripEmpty({ ...step.action }),
    });
    messages.push({ role: 'assistant', content: assistant });

    const user: Block[] = [
      {
        type: 'tool_result',
        tool_use_id: step.id,
        content: `${step.result}\n\n${step.observation}`,
        is_error: step.status === 'failed',
      },
    ];
    if (req.includeImages && step.image) {
      const img = splitDataUrl(step.image);
      user.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
    }
    messages.push({ role: 'user', content: user });
  }

  if (req.correction) {
    const last = messages[messages.length - 1];
    if (last && last.role === 'user') last.content.push({ type: 'text', text: req.correction });
    else messages.push({ role: 'user', content: [{ type: 'text', text: req.correction }] });
  }
  return messages;
}

export function buildAnthropicRequest(
  config: ProviderConfig,
  apiKey: string,
  req: ProviderRequest,
): RequestShape {
  const base = (config.baseUrl?.trim() || ANTHROPIC_BASE).replace(/\/$/, '');
  return {
    url: `${base}/messages`,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: {
      model: config.model,
      max_tokens: 2048,
      system: req.system,
      messages: buildAnthropicMessages(req),
      tools: [
        {
          name: ACTION_TOOL_NAME,
          description: ACTION_TOOL_DESCRIPTION,
          input_schema: ACTION_TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: ACTION_TOOL_NAME },
    },
  };
}

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string; input?: unknown; name?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number };
  error?: { message?: string };
}

export async function requestAnthropic(
  config: ProviderConfig,
  apiKey: string,
  req: ProviderRequest,
): Promise<{ response: ProviderResponse; raw: unknown }> {
  const shape = buildAnthropicRequest(config, apiKey, req);
  const timeout = AbortSignal.timeout(120_000);
  const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
  const res = await fetch(shape.url, {
    method: 'POST',
    headers: shape.headers,
    body: JSON.stringify(shape.body),
    signal,
  });
  let json: AnthropicResponse = {};
  try {
    json = (await res.json()) as AnthropicResponse;
  } catch {
    json = {};
  }
  if (!res.ok) {
    const friendly = friendlyHttpError(res.status, 'Anthropic');
    const detail = json.error?.message ? ` ${json.error.message.slice(0, 240)}` : '';
    throw new ProviderError(`${friendly}${detail}`, 'anthropic', res.status);
  }
  const toolUse = json.content?.find((block) => block.type === 'tool_use' && block.input);
  const text = json.content?.find((block) => block.type === 'text')?.text;
  return {
    response: {
      action: (toolUse?.input ?? null) as ProviderResponse['action'],
      text,
      usage: toUsage(
        json.usage?.input_tokens ?? 0,
        json.usage?.output_tokens ?? 0,
        json.usage?.cache_read_input_tokens ?? 0,
      ),
    },
    raw: toolUse?.input ?? null,
  };
}
