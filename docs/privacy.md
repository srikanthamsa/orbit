# Privacy policy

Host this file at a public URL (GitHub Pages, a repo blob, or orbit.example/privacy)
and paste that URL into the Chrome Web Store privacy tab. Chrome requires the policy
to be reachable without signing in.

---

ORBIT privacy policy — last updated 20 November 2026

ORBIT is a browser extension that runs an AI agent in the tab you are watching.
This policy describes exactly what leaves your browser.

## What ORBIT does not do

- No ORBIT account, no ORBIT server, no analytics, no telemetry, no crash reporting.
- No advertising identifiers, no tracking pixels, no fingerprinting.
- No selling or sharing of data with anyone other than the model provider you configure.
- No reading or storing of password fields.

## What stays on your computer

- Your API keys and provider settings, in the browser's own extension storage
  (`chrome.storage.local`). Keys are never sent to us because there is no "us" to
  send them to.
- Task history, step logs and screenshots, also in extension storage. Deleting a task
  removes it. Uninstalling the extension removes everything.

## What leaves your browser, and to whom

When you start a task, ORBIT sends the following **to the model provider you
configured** (OpenAI, Anthropic, Google, DeepSeek or an OpenAI-compatible endpoint
whose URL you supplied):

- the objective you typed;
- a text digest of the page you asked it to work on: visible text, accessibility
  tree, element labels, and the current URL;
- screenshots, only if the model you picked supports images and the task needs one;
- the transcript of the steps so far.

That traffic goes directly from your browser to that provider over HTTPS, under
their terms and retention policy. We never see it, proxy it, or store a copy.

When a task needs a general answer that the page cannot give, ORBIT sends your
question to DuckDuckGo's HTML search endpoint (`html.duckduckgo.com`) and reads the
public result list.

## Permissions and why each exists

- **Read and change data on the site you are on (requested per site, at task start):**
  an agent cannot click or read a page without it. It is requested for one origin at
  a time, when you start a task there.
- **tabs, tabGroups:** to find the tab you are watching, focus it, and mark it while
  a task runs.
- **scripting:** to read the page and to draw the progress overlay.
- **sidePanel:** the whole interface lives in Chrome's side panel.
- **storage:** keys, settings, task history — all local.
- **clipboardWrite:** the Copy button on a result.
- **declarativeNetRequestWithHostAccess (search host only):** one static rule that
  removes the browser's `Origin` header from the search request, which that endpoint
  otherwise rejects. It reads or changes no other traffic.

## Data retention

Everything is local and under your control. Deleting a task, clearing history, or
uninstalling the extension removes it. The model provider keeps what it receives
according to its own policy; consult that provider.

## Children

ORBIT is not directed at children and has no accounts to create.

## Changes

Material changes to this policy will be published at this URL before the version
that implements them ships.

## Contact

srikanthamsa@gmail.com
