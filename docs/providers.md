# Providers

ORBIT treats models as interchangeable intelligence behind one structured action protocol. The orchestrator never knows which provider answered.

## Contract

```ts
requestAction({ config, apiKey, initialMessage, steps, correction?, signal? })
  → { action: BrowserAction, reasoning?, usage: { inputTokens, outputTokens, cachedTokens?, costUsd? } }
```

`steps` is the canonical history: each entry contains the action, the model's one-line reasoning, the execution result, a page observation digest, optionally a screenshot, and a status (`success | failed | rejected`). Adapters translate this into native tool/function-call turns and translate the reply back into raw JSON, which `requestAction` validates with `BrowserActionSchema` before the orchestrator sees it.

## Built-in adapters

| Provider | File | Transport |
| --- | --- | --- |
| OpenAI | `src/providers/openai.ts` | `/chat/completions`, forced `orbit_action` function |
| DeepSeek | same (OpenAI-compatible) | `api.deepseek.com`, no forced tool choice, `deepseek-flash` / `deepseek-v4-pro` |
| Compatible | same | User base URL, `/chat/completions` |
| Anthropic | `src/providers/anthropic.ts` | `/v1/messages`, `tool_use` blocks, direct-browser-access header |
| Gemini | `src/providers/gemini.ts` | `generateContent`, function declarations, `mode: ANY` |

The tool schema (`src/providers/schema.ts`) is a flat object with a `type` enum plus per-type parameters. Flat schemas avoid `anyOf` differences between providers while Zod enforces the real invariants.

### DeepSeek thinking mode

DeepSeek thinking models reject continuations whose assistant tool-call turns omit the `reasoning_content` they produced (`400: reasoning_content in the thinking mode must be passed back`). Rather than depending on that field, ORBIT sends **DeepSeek and compatible endpoints their history as plain text turns** — no replayed assistant tool calls and no tool messages — while keeping native tool-call history for OpenAI, Anthropic and Gemini. The action/result/observation context is identical; the failure mode is gone. `reasoning_content` from a response is still stored and echoed for native adapters that expose it. The DeepSeek path also leaves `tool_choice` unset, so thinking mode keeps automatic tool selection.

## Capabilities

`src/providers/capabilities.ts` decides whether screenshots may be attached. Vision models receive the latest screenshot as an image block; text-only models never do, and the visual fallback degrades to DOM behaviour. DeepSeek's `deepseek-flash` (V4.1 Flash, 1M context) is vision-capable; `deepseek-v4-pro` is text-only. Users can override detection per provider with **Vision: Auto / Supported / Text only**.

## Cost

`src/providers/pricing.ts` contains approximate public list prices per million tokens. Usage is accumulated per task and displayed as an estimate — the provider's invoice is authoritative. DeepSeek is estimated at peak rates (`deepseek-flash`: $0.30 in / $1.20 out per 1M; `deepseek-v4-pro`: $1.32 / $3.96); off-peak is half. Unknown DeepSeek model names fall back to the Flash tier; other unknown models show tokens with “cost n/a”. Budgets are enforced against the estimate.

## Adding a provider

1. Add an id to `ProviderId` and a branch in `capabilitiesFor`.
2. Implement `buildXRequest` (pure, testable) and parse the response into `{ rawAction, text?, usage }`.
3. Register the branch in `src/providers/index.ts` and a connection test in `validate.ts`.
4. Add the API origin to `host_permissions` (or document that it uses the optional host flow).
5. Add unit tests for message shape and parsing.

Rules:

- One action per turn. Always force the tool when the provider supports it.
- Keep the system prompt (`src/providers/prompt.ts`) shared; provider-specific tweaks belong in the adapter's message shaping.
- Never include API keys in messages, errors or logs. Errors pass through `friendlyHttpError`.
- Images: only when `includeImages` is true and only the latest step carries one.
