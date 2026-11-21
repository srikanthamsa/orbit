import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildOpenAIBody, buildOpenAIRequest, parseOpenAI } from '@/providers/openai';
import { buildAnthropicMessages, buildAnthropicRequest } from '@/providers/anthropic';
import { buildGeminiContents, cleanForGemini } from '@/providers/gemini';
import { requestAction } from '@/providers';
import { ProviderError } from '@/providers/types';
import { estimateCost } from '@/providers/pricing';
import { capabilitiesFor } from '@/providers/capabilities';
import type { ProviderConfig } from '@/types';
import type { PromptStep } from '@/providers/types';

const steps: PromptStep[] = [
  {
    id: 'step_1',
    action: { type: 'click', elementId: 'el_4' },
    reasoning: 'Open the first result.',
    providerReasoning: 'The first result matches the price ceiling, so open it.',
    result: 'Clicked el_4 “Sony WH-CH720N”.',
    observation: 'URL: https://shop.example/1\n[link] Add to cart',
    status: 'success',
  },
];

const request = {
  system: 'system prompt',
  initialMessage: 'OBJECTIVE: compare headphones',
  steps,
  current: {
    observation: 'URL: https://shop.example/2\n[link] Checkout',
    image: 'data:image/jpeg;base64,AAAA',
  },
  includeImages: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('openai adapter', () => {
  it('serializes history as tool calls and tool results', () => {
    const body = buildOpenAIBody('gpt-4o-mini', request, true) as any;
    expect(body.messages[0]).toEqual({ role: 'system', content: 'system prompt' });
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[2].tool_calls[0].function.name).toBe('orbit_action');
    expect(JSON.parse(body.messages[2].tool_calls[0].function.arguments)).toEqual({ type: 'click', elementId: 'el_4' });
    expect(body.messages[2].reasoning_content).toBe('The first result matches the price ceiling, so open it.');
    expect(body.messages[3].role).toBe('tool');
    expect(body.messages[3].content).toContain('Clicked el_4');
    expect(body.messages[4].content[1].type).toBe('image_url');
    expect(body.tool_choice.function.name).toBe('orbit_action');
  });

  it('omits images when the model cannot see them', () => {
    const body = buildOpenAIBody('deepseek-v4-pro', { ...request, includeImages: false }, false) as any;
    expect(JSON.stringify(body)).not.toContain('image_url');
    expect(body.tool_choice).toBeUndefined();
  });

  it('merges corrections into a final user message', () => {
    const body = buildOpenAIBody('gpt-4o', { ...request, steps: [], correction: 'Fix the action.' }, false) as any;
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Fix the action.' });
  });

  it('parses tool calls, usage and thinking-mode reasoning', () => {
    const parsed = parseOpenAI({
      choices: [
        {
          message: {
            content: null,
            reasoning_content: 'I need to finish.',
            tool_calls: [{ function: { arguments: '{"type":"finish","summary":"ok","reasoning":"done"}' } }],
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 10 } },
    });
    expect(parsed.rawAction).toMatchObject({ type: 'finish' });
    expect(parsed.providerReasoning).toBe('I need to finish.');
    expect(parsed.usage).toEqual({ inputTokens: 100, outputTokens: 20, cachedTokens: 10 });
  });

  it('sends DeepSeek history as flat text so thinking-mode replay can never fail', () => {
    const config: ProviderConfig = { id: 'p', provider: 'deepseek', model: 'deepseek-flash' };
    const shape = buildOpenAIRequest(config, 'key', request) as any;
    const roles = shape.body.messages.map((message: any) => message.role);
    expect(roles).toEqual(['system', 'user']);
    expect(JSON.stringify(shape.body)).not.toContain('reasoning_content');
    expect(JSON.stringify(shape.body)).not.toContain('"role":"tool"');

    const content = shape.body.messages[1].content;
    const text = (Array.isArray(content) ? content[0].text : content) as string;
    expect(text).toContain('HISTORY');
    expect(text).toContain('"type":"click"');
    expect(text).toContain('Clicked el_4');
    expect(text).toContain('Add to cart');
    expect(text).toContain('Continue from the page state');

    const corrected = buildOpenAIRequest(config, 'key', { ...request, correction: 'Try again.' }) as any;
    const correctedContent = corrected.body.messages[1].content;
    const correctedText = Array.isArray(correctedContent) ? correctedContent[0].text : correctedContent;
    expect(correctedText).toContain('Try again.');

    const openai = buildOpenAIRequest(
      { id: 'p', provider: 'openai', model: 'gpt-4o' },
      'key',
      request,
    ) as any;
    expect(openai.body.messages.some((message: any) => message.role === 'tool')).toBe(true);
  });

  it('falls back to JSON inside prose', () => {
    const parsed = parseOpenAI({
      choices: [{ message: { content: 'Sure:\n```json\n{"type":"scroll","direction":"down"}\n```' } }],
    });
    expect(parsed.rawAction).toEqual({ type: 'scroll', direction: 'down' });
  });

  it('uses the DeepSeek base URL by default', () => {
    const config: ProviderConfig = { id: 'p', provider: 'deepseek', model: 'deepseek-flash' };
    const shape = buildOpenAIRequest(config, 'key', request);
    expect(shape.url).toBe('https://api.deepseek.com/chat/completions');
    expect(shape.headers.Authorization).toBe('Bearer key');
  });
});

describe('prompt cache stability', () => {
  const extra: PromptStep = {
    id: 'step_2',
    action: { type: 'scroll', direction: 'down' },
    result: 'Scrolled down.',
    observation: 'URL: https://shop.example/3',
    status: 'success',
  };

  it('keeps every earlier message byte-identical when a step is appended', () => {
    const first = buildOpenAIBody('gpt-4o', request, true) as any;
    const second = buildOpenAIBody('gpt-4o', { ...request, steps: [...steps, extra] }, true) as any;
    // Two messages are appended (tool call + result); the live page block moves
    // to the end. Everything before it must be untouched.
    expect(second.messages).toHaveLength(first.messages.length + 2);
    for (let index = 0; index < first.messages.length - 1; index += 1) {
      expect(second.messages[index]).toEqual(first.messages[index]);
    }
  });

  it('does not carry the live page inside a history message', () => {
    const body = buildOpenAIBody('gpt-4o', request, true) as any;
    const toolMessage = body.messages.find((message: any) => message.role === 'tool');
    expect(toolMessage.content).toContain('Add to cart');
    expect(toolMessage.content).not.toContain('Checkout');
    const tail = body.messages.at(-1).content as any;
    const tailText: string = Array.isArray(tail) ? tail[0].text : tail;
    expect(tailText).toContain('Checkout');
  });

  it('does not repeat the page on the first turn', async () => {
    let body: any;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({
            choices: [{ message: { tool_calls: [{ function: { arguments: '{"type":"finish","summary":"done"}' } }] } }],
          }),
          { status: 200 },
        );
      }),
    );
    const config: ProviderConfig = { id: 'p', provider: 'openai', model: 'gpt-4o' };
    await requestAction({ config, apiKey: 'k', initialMessage: 'go', steps: [], current: request.current });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1].role).toBe('user');
    expect(JSON.stringify(body.messages)).not.toContain('Checkout');
  });

  it('keeps the history identical in flat mode', () => {
    const flat = (list: PromptStep[]) =>
      String((buildOpenAIBody('deepseek-v4-pro', { ...request, steps: list, includeImages: false }, false) as any).messages.at(-1).content);
    const first = flat(steps);
    const second = flat([...steps, extra]);
    const head = first.slice(0, first.indexOf('PAGE NOW'));
    expect(second.startsWith(head)).toBe(true);
  });
});

describe('anthropic adapter', () => {
  it('builds alternating tool_use and tool_result blocks', () => {
    const messages = buildAnthropicMessages(request);
    // initial turn, tool_use, tool_result, then the live page block with its image
    expect(messages).toHaveLength(4);
    expect(messages[1].role).toBe('assistant');
    expect((messages[1].content as any[]).some((b) => b.type === 'tool_use')).toBe(true);
    expect(messages[2].role).toBe('user');
    expect((messages[2].content as any[])[0].type).toBe('tool_result');
    expect((messages[3].content as any[])[0].type).toBe('text');
    expect((messages[3].content as any[])[1].type).toBe('image');
  });

  it('includes the browser access header and forces the tool', () => {
    const config: ProviderConfig = { id: 'p', provider: 'anthropic', model: 'claude-sonnet-4-5' };
    const shape = buildAnthropicRequest(config, 'sk-ant', request) as any;
    expect(shape.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(shape.body.tool_choice).toEqual({ type: 'tool', name: 'orbit_action' });
    expect(shape.body.max_tokens).toBeGreaterThan(0);
  });

  it('merges a correction into the last user turn', () => {
    const messages = buildAnthropicMessages({ ...request, correction: 'Try again.' });
    const last = messages.at(-1)!;
    expect(last.role).toBe('user');
    expect((last.content as any[]).at(-1)).toEqual({ type: 'text', text: 'Try again.' });
  });
});

describe('gemini adapter', () => {
  it('builds functionCall and functionResponse parts', () => {
    const contents = buildGeminiContents(request);
    expect(contents[1].role).toBe('model');
    expect((contents[1].parts[0] as any).functionCall.name).toBe('orbit_action');
    expect(contents[2].role).toBe('user');
    expect((contents[2].parts[0] as any).functionResponse.name).toBe('orbit_action');
    expect((contents[3].parts[1] as any).inlineData.mimeType).toBe('image/jpeg');
  });

  it('strips unsupported JSON schema keys', () => {
    const cleaned = cleanForGemini({ type: 'object', additionalProperties: false, $schema: 'x', properties: { a: { type: 'string', additionalProperties: false } } }) as any;
    expect(cleaned.additionalProperties).toBeUndefined();
    expect(cleaned.$schema).toBeUndefined();
    expect(cleaned.properties.a.additionalProperties).toBeUndefined();
  });
});

describe('requestAction', () => {
  it('rejects invalid model output with a retryable error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { tool_calls: [{ function: { arguments: '{"type":"launch_missiles"}' } }] } }],
          }),
          { status: 200 },
        ),
      ),
    );
    const config: ProviderConfig = { id: 'p', provider: 'openai', model: 'gpt-4o-mini' };
    await expect(requestAction({ config, apiKey: 'k', initialMessage: 'go', steps: [] })).rejects.toBeInstanceOf(ProviderError);
  });

  it('sends images only for vision-capable models', async () => {
    let body: any;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({
            choices: [{ message: { tool_calls: [{ function: { arguments: '{"type":"finish","summary":"done"}' } }] } }],
          }),
          { status: 200 },
        );
      }),
    );
    const config: ProviderConfig = { id: 'p', provider: 'deepseek', model: 'deepseek-v4-pro' };
    const result = await requestAction({ config, apiKey: 'k', initialMessage: 'go', steps });
    expect(result.action.type).toBe('finish');
    expect(JSON.stringify(body)).not.toContain('image_url');
  });

  it('sends screenshots to vision-capable DeepSeek Flash', async () => {
    let body: any;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({
            choices: [{ message: { tool_calls: [{ function: { arguments: '{"type":"finish","summary":"done"}' } }] } }],
          }),
          { status: 200 },
        );
      }),
    );
    const config: ProviderConfig = { id: 'p', provider: 'deepseek', model: 'deepseek-flash' };
    const result = await requestAction({
      config,
      apiKey: 'k',
      initialMessage: 'go',
      steps,
      current: request.current,
    });
    expect(result.action.type).toBe('finish');
    expect(JSON.stringify(body)).toContain('image_url');
  });

  it('maps HTTP errors to friendly messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 })));
    const config: ProviderConfig = { id: 'p', provider: 'openai', model: 'gpt-4o' };
    await expect(requestAction({ config, apiKey: 'k', initialMessage: 'go', steps: [] })).rejects.toThrow(/rejected/i);
  });
});

describe('capabilities and pricing', () => {
  it('knows vision support per provider', () => {
    expect(capabilitiesFor({ id: 'a', provider: 'deepseek', model: 'deepseek-flash' }).vision).toBe(true);
    expect(capabilitiesFor({ id: 'a', provider: 'deepseek', model: 'deepseek-v4-pro' }).vision).toBe(false);
    expect(capabilitiesFor({ id: 'a', provider: 'gemini', model: 'gemini-2.5-flash' }).vision).toBe(true);
    expect(capabilitiesFor({ id: 'a', provider: 'deepseek', model: 'x', visionOverride: true }).vision).toBe(true);
  });

  it('estimates cost from list prices', () => {
    expect(estimateCost('gpt-4o', { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBeCloseTo(12.5, 5);
    expect(estimateCost('deepseek-flash', { inputTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(0.3, 5);
    expect(estimateCost('deepseek-v4-pro', { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBeCloseTo(5.28, 5);
    expect(estimateCost('some-unknown-model', { inputTokens: 10, outputTokens: 10 })).toBeUndefined();
  });
});
