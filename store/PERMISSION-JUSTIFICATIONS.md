# Permission justifications

The dashboard asks for a sentence per permission. These are written for a reviewer
who has never used the product.

## Single purpose

ORBIT gives one outcome: it drives the browser tab you are watching toward a goal you
typed, using a model you supply a key for. Everything in the extension serves that
single purpose — the panel, the page reader, the action executor and the step log.
There is no unrelated second feature.

## host_permissions (api hosts)

`https://api.openai.com/*`, `https://api.anthropic.com/*`,
`https://generativelanguage.googleapis.com/*`, `https://api.deepseek.com/*`,
`https://html.duckduckgo.com/*`

These are the endpoints the user's own model key calls and the public search endpoint.
Nothing else is contacted. No site content is sent to these hosts except the model
request the user asked for by starting a task.

## optional_host_permissions (http://*/*, https://*/*)

An agent must act on whichever site the user is working on, and the user chooses that
site task by task. They are declared optional and requested one origin at a time, only
when a task starts on that origin, and never in the background. Declining leaves the
extension idle rather than broken.

## scripting

Required to read the page (accessibility tree, visible text, element list) and to draw
the progress indicator. Injected into the active tab only, only while a task runs.

## tabs

To identify the tab the user is watching, focus it when a step needs it, and navigate
it when the task requires a new URL.

## tabGroups

To mark the working tab while a task runs, so the user can see at a glance which tab
the agent is driving.

## sidePanel

The entire interface is a side panel, by design: the agent and the page must be
visible together.

## storage

API keys, provider settings and local task history. Nothing is synced.

## activeTab

Lets the first action in a tab work from the toolbar click without a broader grant.

## clipboardWrite

The Copy button on a finished result.

## declarativeNetRequestWithHostAccess

One static rule, scoped to the DuckDuckGo search host and to fetch requests only, that
removes the `Origin` header. The endpoint returns 403 to requests carrying an extension
origin. The rule cannot read or modify page content or any other host.

## Remote code

None. All code ships inside the package; no script is loaded from a server.

## Data usage answers

- Collects personally identifiable information: **No**
- Collects health, financial, authentication or personal communications: **No**
- Collects location: **No**
- Collects web history: **No** (page content is processed for the current task only
  and is not retained by the developer; the extension transmits it to the model
  provider the user configured, which the user supplies themselves)
- Sells data to third parties: **No**
- Uses data for purposes unrelated to the single purpose: **No**
- Uses data to determine creditworthiness: **No**

Disclose in the "third parties" note: page content and screenshots are sent directly
to the model provider the user configures, at the user's instruction.
