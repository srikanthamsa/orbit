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

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function cleanForGemini(value: unknown): JsonValue {
  if (Array.isArray(value)) return value.map((v) => cleanForGemini(v));
  if (value && typeof value === 'object') {
    const out: { [key: string]: JsonValue } = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'additionalProperties' || key === '$schema') continue;
      out[key] = cleanForGemini(inner);
    }
    return out;
  }
  return value as JsonValue;
}

function inlineImage(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  return { mimeType: match?.[1] ?? 'image/jpeg', data: match?.[2] ?? '' };
}

type Part = Record<string, unknown>;

export function buildGeminiContents(req: ProviderRequest): Array<{ role: 'user' | 'model'; parts: Part[] }> {
  const contents: Array<{ role: 'user' | 'model'; parts: Part[] }> = [
    { role: 'user', parts: [{ text: req.initialMessage }] },
  ];
  for (const step of req.steps) {
    contents.push({
      role: 'model',
      parts: [{ functionCall: { name: ACTION_TOOL_NAME, args: stripEmpty({ ...step.action }) } }],
    });
    const parts: Part[] = [
      {
        functionResponse: {
          name: ACTION_TOOL_NAME,
          response: { result: step.result, observation: step.observation, status: step.status },
        },
      },
    ];
    contents.push({ role: 'user', parts });
  }
  if (req.current) {
    const parts: Part[] = [{ text: `Page now:\n${req.current.observation}` }];
    if (req.includeImages && req.current.image) {
      parts.push({ inlineData: inlineImage(req.current.image) });
    }
    contents.push({ role: 'user', parts });
  }
  if (req.correction) {
    const last = contents[contents.length - 1];
    if (last && last.role === 'user') last.parts.push({ text: req.correction });
    else contents.push({ role: 'user', parts: [{ text: req.correction }] });
  }
  return contents;
}

export function buildGeminiRequest(
  config: ProviderConfig,
  apiKey: string,
  req: ProviderRequest,
): RequestShape {
  const base = (config.baseUrl?.trim() || GEMINI_BASE).replace(/\/$/, '');
  const model = config.model.replace(/^models\//, '');
  return {
    url: `${base}/models/${encodeURIComponent(model)}:generateContent`,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: buildGeminiContents(req),
      tools: [
        {
          functionDeclarations: [
            {
              name: ACTION_TOOL_NAME,
              description: ACTION_TOOL_DESCRIPTION,
              parameters: cleanForGemini(ACTION_TOOL_SCHEMA),
            },
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [ACTION_TOOL_NAME] },
      },
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    },
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ functionCall?: { name?: string; args?: unknown }; text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    cachedContentTokenCount?: number;
  };
  error?: { message?: string };
}

export async function requestGemini(
  config: ProviderConfig,
  apiKey: string,
  req: ProviderRequest,
): Promise<{ response: ProviderResponse; raw: unknown }> {
  const shape = buildGeminiRequest(config, apiKey, req);
  const timeout = AbortSignal.timeout(120_000);
  const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
  const res = await fetch(shape.url, {
    method: 'POST',
    headers: shape.headers,
    body: JSON.stringify(shape.body),
    signal,
  });
  let json: GeminiResponse = {};
  try {
    json = (await res.json()) as GeminiResponse;
  } catch {
    json = {};
  }
  if (!res.ok) {
    const friendly = friendlyHttpError(res.status, 'Gemini');
    const detail = json.error?.message ? ` ${json.error.message.slice(0, 240)}` : '';
    throw new ProviderError(`${friendly}${detail}`, 'gemini', res.status);
  }
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const call = parts.find((p) => p.functionCall?.args);
  const text = parts.find((p) => p.text)?.text;
  return {
    response: {
      action: (call?.functionCall?.args ?? null) as ProviderResponse['action'],
      text,
      usage: toUsage(
        json.usageMetadata?.promptTokenCount ?? 0,
        json.usageMetadata?.candidatesTokenCount ?? 0,
        json.usageMetadata?.cachedContentTokenCount ?? 0,
      ),
    },
    raw: call?.functionCall?.args ?? null,
  };
}
