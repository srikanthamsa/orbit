# Architecture

ORBIT is a Manifest V3 Chrome extension with no backend. The side panel is the product; the background service worker only wires the toolbar icon to the panel.

## Runtime surfaces

| Surface | File | Responsibility |
| --- | --- | --- |
| Background worker | `src/entrypoints/background.ts` | Open the side panel on toolbar click. Nothing else — MV3 workers are ephemeral. |
| Side panel | `src/entrypoints/sidepanel/*`, `src/App.tsx`, `src/screens/*` | UI, task state machine, orchestration host |
| Page automation | `src/browser/injected.ts` via `chrome.scripting.executeScript` | Snapshot + element registry + clicks/typing/scroll |
| Provider adapters | `src/providers/*` | Translate canonical history ↔ each provider's tool-calling format |

There is intentionally no long-running background orchestrator. Chrome can suspend the service worker at any time; running the loop in the side panel document (alive while open) plus per-action checkpoints is simpler and resumable. If the panel closes mid-task, Home offers **Resume** from the last checkpoint.

## Components

```
Side panel (React + Zustand)
  └─ runSequence()                     src/stores/agent.ts
       └─ runAgent()                   src/agent/orchestrator.ts
            ├─ observe()               src/browser/dom.ts  → injected pageOperation
            ├─ requestAction()         src/providers/index.ts
            ├─ assessAction()          src/safety/policy.ts
            ├─ executeAction()         Chrome tabs API + injected operations
            ├─ screenshots             src/browser/screenshot.ts
            └─ checkpoints             src/storage/checkpoint.ts
```

The orchestrator never imports a provider's wire format and never touches the DOM directly.

## The loop

```
snapshot ─► build compact history ─► model returns one orbit_action
   ▲                                          │
   │                                          ▼
   └── observe result ◄── execute ◄── validate ── approval (policy)
```

- **Observation** assigns fresh ids (`el_1…`) to visible interactive elements and records accessible names, roles, values, form membership and a text digest. It now captures up to 240 controls, including offscreen elements, open shadow roots and same-origin iframes, and emits a compact accessibility tree (`a11yText`) of landmarks, headings, dialogs, forms and controls with ids. Password fields, `one-time-code`/credit-card autocomplete fields, and fields masked with `-webkit-text-security` are reported as `••••••`. It also captures non-semantic controls that behave clickable (`tabindex="0"` + pointer cursor, bounded size) such as Flipkart's “View EMI offers”, emits a compact affordance inventory (enabled actions, disabled controls) and page signals for blockers such as out-of-stock, CAPTCHA and sign-in walls. Active dialogs and portals are captured separately as `overlayText` (walking up from the focused/last-used element, plus dialog roles), and the page digest keeps a tail so late-appended portal text is not lost. The registry lives in the extension's isolated world so ids can be verified on click. A read-only `find` action searches that registry by label, text and role and returns matching ids without scrolling or a full re-observe.
- **Action protocol** is a Zod discriminated union (`src/types/actions.ts`): `navigate | click | click_at | type | scroll | press_key | screenshot | wait | find | batch | finish`. A batch contains 2–5 click/type/scroll steps that share the current page state and execute in order, stopping at the first failure. Anything else is rejected and the model gets one correction attempt.
- **Verification** always re-observes after an action. A screenshot is never treated as proof a click worked. A batch is one model turn but each sub-action is verified by the same page operation and the batch stops on the first failed or stale target.
- **Bounds**: `maxSteps` (5–60), `maxCostUsd`, 15-minute wall clock, one validation retry, stale-id rejection, and a no-progress detector. A batch counts as one step, is capped at five actions, and may contain at most one content-sensitive action in normal approval mode; a batch with two or more sensitive steps is rejected before anything runs. In “approve all” mode one explicit batch approval lists every step. `find` is treated as deliberate re-inspection, not a stall. When several actions leave the URL, element set and scroll position unchanged (including scroll ping-pong), the model gets one STALL notice to change strategy; a second stall ends the task with a diagnosis instead of burning the step budget.

### Hybrid strategy

DOM first (`el_*` ids → click/type), screenshot + vision only when the DOM is insufficient. `click_at` uses normalised 0..1 coordinates so a downscaled screenshot still maps correctly. The executor probes `elementFromPoint` at the target before executing a coordinate click, so the approval policy can classify it.

While a task is running, the controlled tab gets a shadow-DOM control layer (`src/browser/control.ts`). A fixed, `pointer-events: none` glow uses layered inset shadows (white core, `#ad5fff`, `#471eec`, shifting to `#d60a47`/`#311e80`) that travel around the four edges and reach every corner. A compact page tag at the top center shows working / needs-input / paused, with a Stop button; Stop sends a validated `ORBIT_STOP_TAB` runtime message and falls back to an on-page warning if the panel is gone. A phantom cursor moves to the target before click/type/click-at actions, names the action, and pulses a click ring. For `screenshot`, the whole layer switches to `hidden` and pauses its animation before capture, then restores. Updates are serialized per tab so a stale “working” injection cannot land after “off”; the layer re-attaches after navigation, respects `prefers-reduced-motion`, never changes page layout, and removes itself on completion, failure, stop, panel close, or after a 120-second watchdog. The layer is built with DOM APIs and a constructable stylesheet rather than `innerHTML`, so it also works on pages with strict CSP and Trusted Types enforcement.

The controlled tab is also placed in an **ORBIT** tab group by `setOrbitGroupState` (`src/browser/tabs.ts`). Group updates are serialized per tab, recolour with the run state (blue working, orange waiting, grey paused, green done, red failed), and never take over a group the user already created. The `tabGroups` permission is used only for this visual organisation; it does not grant page access.

## State

Zustand store (`src/stores/agent.ts`) holds UI state: current task, steps, live tab, screenshot, approval, usage. Persistence is separate and minimal:

| Key | Contents | Notes |
| --- | --- | --- |
| `orbit.settings` | theme, limits, approval mode, active provider | |
| `orbit.providers` | provider configs (model, base URL) | no keys |
| `orbit.credentials` | `{ apiKey }` per provider | session storage by default |
| `orbit.history` | last 40 task summaries | no page content |
| `orbit.checkpoint` | task + steps + usage | rewritten after every action |

Checkpoints strip screenshots to bound storage. Media stays in memory for the current session only.

## Failure handling

| Failure | Handling |
| --- | --- |
| Element missing / stale | Reject with "observe again"; agent re-snapshots |
| Page still loading | Bounded retries around snapshot + wait/settle |
| Navigation fails | Bounded tab-complete wait; error surfaced to the model |
| Model emits invalid action | One corrective retry, then task fails |
| Rate limit / 5xx | Friendlier provider error, task stops |
| Rate/cost/step limit | Task pauses as failed with the reason; resume is possible |
| Approval denied | Step recorded as `rejected`; agent must replan |
| Product out of stock | Strong page signal + deterministic stop on product pages, with the product name |
| CAPTCHA / required sign-in | Deterministic stop with instructions; no model call is spent |
| No page progress | Typing and field focus are setup, not stalls; one STALL correction, then a terminal diagnosis only when the model repeats itself, keeps guessing coordinates, or stalls a third time |
| Blind coordinate clicking | When labeled controls exist, three coordinate clicks trigger a STALL correction; another ends the run with a "control not exposed" diagnosis |
| Screenshot blocked / text-only model | Screenshot step fails with guidance; later screenshot calls are skipped |
| Repeated model mistakes | History capped at six steps, older observations trimmed for token safety |
| Tab closed | Task fails with a clear message |
| Panel closed | Checkpoint survives; Home offers Resume |

## Permission boundaries

- Install-time: `sidePanel`, `storage`, `tabs`, `tabGroups`, `scripting`, `activeTab`, `clipboardWrite` + fixed API hosts for OpenAI/Anthropic/Gemini/DeepSeek.
- Page origins: requested per origin at task start (and when navigating to a new site) via `optional_host_permissions`.
- The model cannot invoke `chrome.*`, run JavaScript, or choose selectors. Only typed actions from the snapshot's id space are executable.

## Deliberate non-goals (Phase 1)

Multi-tab orchestration, scheduling, background execution, skill reuse, and persistent memory. The MVP proves the loop: enter a task, call a model, inspect a page, click, verify, and watch it happen.
