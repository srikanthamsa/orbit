# Security and privacy

ORBIT drives a logged-in browser. The threat model therefore centres on credential safety, prompt injection, and preventing unintended consequential actions.

## Credentials

- Keys are entered in the side panel and read only there. They are never sent to content scripts, embedded in prompts, or written into the DOM.
- Default storage is `chrome.storage.session` (cleared when Chrome exits). Persisting to `chrome.storage.local` is opt-in.
- Chrome extension storage is not an encrypted secrets vault. The UI says so; the project makes no encryption claims.
- Errors pass through redaction; keys are never logged. `scripts/extension-smoke.mjs` and tests assert that requests carry no page data beyond the observation digest.
- API calls originate from the extension origin. Fixed provider hosts are declared; optional page/endpoint origins are requested at runtime with user gestures.

## Prompt injection

Every page is hostile until proven otherwise. Mitigations stack:

1. **Separation** — system instructions, the objective and page content occupy distinct messages; page text is explicitly labelled `(untrusted)`.
2. **Typed actions** — the model cannot emit code, selectors or shell commands. Zod rejects anything outside the protocol.
3. **No secrets in context** — the model never sees keys, cookies or storage.
4. **Policy in code** — approval decisions are made by `src/safety/policy.ts` from the real target element, not by the model.
5. **Scope checks** — navigation to an origin without host access pauses for the user; the extension never silently escalates.
6. **Bounded execution** — step, cost and time ceilings limit how much damage a hijacked plan can do.

An injected instruction can at most attempt an action the policy already classifies. Destructive or irreversible actions stop for a human who sees the actual label and site.

## Human approval

Default **Sensitive** mode requires approval for controls that submit, send, apply, publish, post, buy, pay, check out, delete, remove, transfer, unsubscribe, sign up, register, book or donate; for Enter inside a form; and for coordinate clicks whose probed target matches those categories. **All** mode requires approval for every navigation, click, typing and key press.

Approval is per-action. A batch is held before it runs if it contains a sensitive step, and its approval detail lists every step; in Sensitive mode a batch with more than one sensitive step is rejected and must be split. Approving one submit never authorizes the next. Denials are fed back to the model as a rejected step; retrying the same action is not permitted by the prompt and is pointless.

## Permissions

```
sidePanel, storage, tabs, tabGroups, scripting, activeTab, clipboardWrite
host_permissions: api.openai.com, api.anthropic.com,
                  generativelanguage.googleapis.com, api.deepseek.com
optional_host_permissions: http://*/*, https://*/*
```

`tabGroups` only lets ORBIT name and colour its own tab group; it does not grant page access. Tabs already in a user-created group are left untouched.

Page access is requested per origin when a task starts or navigates. `activeTab` covers the user-activated tab. No `<all_urls>` grant at install time. `<all_urls>` is declared only as an *optional* permission because Chrome requires it (or `activeTab`) for `tabs.captureVisibleTab`; it is requested solely by the explicit **Allow all sites** action, which also enables screenshots.

Chrome shows its own confirmation dialog after ORBIT's in-panel approval card; that is the browser, not a second ORBIT step. Users who prefer not to be asked per site can grant all http(s) origins once under **Settings → Browser access → Allow all sites**, and revoke it from the same card. Per-origin grants persist in the Chrome profile until revoked or the extension is reloaded/updated.

## Data flow

```
Page → snapshot digest ─┐
Screenshot (optional) ──┼─► your provider (only if you enabled that model)
Objective + history ────┘
```

No ORBIT-operated endpoint exists in the code path. Task history stores summaries and action metadata, not page bodies; screenshots are stripped from checkpoints. Users can delete history, checkpoints and keys from Settings.

## Residual risks

- A malicious provider receives everything you send it. Choose models you trust; prefer session-only keys.
- Browser profiles already compromised by other extensions/malware are out of scope.
- Model mistakes are possible. Approval is the last line of defence; review the action label and site before approving.
- Coordinate clicking can hit a different element if the page changes between screenshot and click; the executor probes the target and policy checks it, but layout races remain possible.

## Reporting

Use GitHub private vulnerability reporting. Do not open a public issue for suspected vulnerabilities. See [SECURITY.md](../SECURITY.md).
