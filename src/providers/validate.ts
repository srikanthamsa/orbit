import type { ProviderConfig } from '@/types';
import { friendlyHttpError } from '@/safety/redaction';
import { DEEPSEEK_DEFAULT_BASE, OPENAI_DEFAULT_BASE } from './openai';
import { ProviderError } from './types';

const TIMEOUT = 25_000;

async function assertOk(res: Response, label: string): Promise<void> {
  if (res.ok) return;
  let detail = '';
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    detail = json.error?.message?.slice(0, 200) ?? '';
  } catch {
    detail = '';
  }
  throw new ProviderError(`${friendlyHttpError(res.status, label)}${detail ? ` ${detail}` : ''}`, label, res.status);
}

async function testOpenAICompatible(config: ProviderConfig, apiKey: string, label: string): Promise<void> {
  const base =
    config.baseUrl?.trim() || (config.provider === 'deepseek' ? DEEPSEEK_DEFAULT_BASE : OPENAI_DEFAULT_BASE);
  const root = base.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${apiKey}` };
  const models = await fetch(`${root}/models`, { headers, signal: AbortSignal.timeout(TIMEOUT) });
  if (models.ok) return;
  if (models.status === 401 || models.status === 403) {
    throw new ProviderError(friendlyHttpError(models.status, label), config.provider, models.status);
  }
  // Many compatible endpoints do not implement /models; fall back to a 1-token completion.
  const res = await fetch(`${root}/chat/completions`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  await assertOk(res, label);
}

export async function testConnection(config: ProviderConfig, apiKey: string): Promise<void> {
  if (!apiKey.trim()) throw new ProviderError('Add an API key first.', config.provider);
  if (config.provider === 'openai' || config.provider === 'deepseek' || config.provider === 'compatible') {
    await testOpenAICompatible(
      config,
      apiKey,
      config.provider === 'deepseek' ? 'DeepSeek' : config.provider === 'compatible' ? 'The endpoint' : 'OpenAI',
    );
    return;
  }
  if (config.provider === 'anthropic') {
    const base = (config.baseUrl?.trim() || 'https://api.anthropic.com/v1').replace(/\/$/, '');
    const res = await fetch(`${base}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    await assertOk(res, 'Anthropic');
    return;
  }
  if (config.provider === 'gemini') {
    const base = (config.baseUrl?.trim() || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
    const model = config.model.replace(/^models\//, '');
    const res = await fetch(`${base}/models/${encodeURIComponent(model)}`, {
      headers: { 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    await assertOk(res, 'Gemini');
    return;
  }
  throw new ProviderError('Unsupported provider.', config.provider);
}
