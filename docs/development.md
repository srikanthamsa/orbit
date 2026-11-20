# Development

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | WXT dev build, HMR, prints the output directory to load unpacked |
| `npm run build` | Production build into `.output/chrome-mv3` |
| `npm run zip` | Distributable zip |
| `npm run compile` | `tsc --noEmit` |
| `npm test` | Vitest (actions, policy, providers, prompt, orchestrator) |
| `npm run preview` | Vite preview of the real side panel at `http://localhost:5199` |
| `npm run smoke` | Load the built extension in headless Chrome and assert boot + storage + side panel API |
| `npm run e2e` | Build a test-only artifact (`<all_urls>`) and drive the full loop against a local page with a mocked OpenAI endpoint |
| `npm run shots` | Capture preview screenshots to `/tmp/orbit-shots` |

## Loading the extension

1. `npm run build`
2. `chrome://extensions` → Developer mode → **Load unpacked** → `.output/chrome-mv3`
3. Click the ORBIT toolbar icon. The side panel opens (requires Chrome 116+).

For live development with HMR use `npm run dev` and load the directory it prints.

## Preview harness

`preview/` mounts the actual side panel components against seeded Zustand state, with Chrome APIs absent.

```
http://localhost:5199/?demo=home
http://localhost:5199/?demo=workspace
http://localhost:5199/?demo=approval
http://localhost:5199/?demo=done
http://localhost:5199/?demo=settings
http://localhost:5199/?demo=light
http://localhost:5199/?demo=domtest
```

`domtest` rebuilds the page-automation function from its own source string (exactly what `chrome.scripting.executeScript` serializes), then exercises snapshot, click, type, scroll, coordinate probing, stale-id/unknown-id rejection, out-of-stock detection, the affordance inventory, tabindex-only controls, portal/overlay text, sensitive-field redaction, accessibility-tree output, find, open shadow roots, same-origin frames, offscreen controls and cross-realm typing. The title becomes `DOMTEST PASS 27/27` when healthy.

Screenshots are captured with Playwright against the cached Chromium:

```bash
npm run preview            # terminal 1
npm run shots              # terminal 2
```

## Debugging

- **Side panel:** right-click inside the panel → Inspect. Errors are also surfaced inline.
- **Background worker:** `chrome://extensions` → ORBIT → *service worker*.
- **Page injection:** DevTools → Console → context selector → ORBIT (isolated world). The snapshot registry is `globalThis.__ORBIT_REG__`.
- **Task state:** `chrome.storage.local` keys are prefixed `orbit.`. Checkpoints are saved after every action.
- **Prompt content:** inspect network calls to your provider in the DevTools Network tab; no keys appear in payloads.

## End-to-end test

`npm run e2e` builds `.output-e2e` with an extra `<all_urls>` host grant (never shipped), loads it into headless Chrome, serves a small form at `localhost:5200`, intercepts `api.openai.com`, and scripts three model turns: find the name field, run a type + click batch, finish. It asserts the page really changed, the timeline shows two steps, the summary renders, the ORBIT tab group is green, and the API key never appears in any model request.

## Testing conventions

- Pure functions (schema, policy, pricing, prompt digest, request builders) have unit tests.
- The orchestrator is tested with mocked browser modules: completion, approvals, denial, budget stop, abort, validation retry, action failure recovery.
- The DOM layer has the browser-level `domtest`.
- The built artifact has the headless extension smoke test.
- Do not add mocked-model tests that never touch a real browser and call it end-to-end.

## Release checklist

1. `npm run compile && npm test && npm run smoke`
2. Bump `version` in `package.json` and `wxt.config.ts`.
3. `npm run build && npm run zip`
4. Attach the zip to a GitHub release, note permission changes and migration notes.
