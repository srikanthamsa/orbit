# Contributing to ORBIT

Thanks for helping. ORBIT is an MIT project and intends to stay community-maintainable.

## Setup

```bash
npm install
npm run dev        # loads a dev build with HMR
npm run compile
npm test
```

Chrome: `chrome://extensions` → Developer mode → **Load unpacked** → `.output/chrome-mv3` (after `npm run build`) or the dev output directory printed by WXT.

## Before you open a PR

- `npm run compile` and `npm test` pass.
- UI changes were checked in the preview harness (`npm run preview`, `?demo=workspace`) at 320 px and 400 px widths.
- If you touched page automation, run `?demo=domtest` in the preview and keep all checks green.
- If you touched the manifest, permissions or network calls, run `npm run build && npm run smoke`.

## Ground rules

1. **No backend, no accounts.** PRs that introduce an ORBIT-operated server for core functionality will be declined.
2. **Structured actions only.** The model must never gain arbitrary JS execution, raw selectors or direct `chrome.*` access.
3. **Approvals are policy, not prompts.** Sensitive actions are gated in code; do not rely on the model to ask.
4. **Page data is untrusted.** Any new prompt that includes page content must label it as such.
5. **Keep permissions minimal.** Prefer optional host permissions and per-origin requests.
6. **Comments explain why, not what.** Match the existing style: small modules, typed boundaries, no speculative abstraction.

## Adding a provider

See [docs/providers.md](docs/providers.md). A provider needs a request builder, a response parser, a capability entry, a connection test, and tests. The orchestrator must not learn provider-specific details.

## Commit and PR style

- Focused commits with a clear subject.
- Describe the user-visible behaviour and how you verified it.
- Include screenshots for UI changes.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
