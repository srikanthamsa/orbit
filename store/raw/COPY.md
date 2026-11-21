# Screenshot copy

Six captures, 1200 px wide (3× of a 400 px panel), trimmed to their content, no
chrome and no text baked in. Opaque PNG on the panel's own background
`#0B0D12`, so they drop onto any dark backdrop without a halo.

Order matters: 01 sells the idea, 02–04 sell the transparency, 05 sells the
answer quality, 06 sells the trust. If you only take four, take 01, 03, 05, 06.

| # | File | Headline | Sub |
|---|------|----------|-----|
| 1 | `01-home.png` | **Say what you need.** | A browser agent in your side panel. It does the clicking; you keep your tab. |
| 2 | `02-running.png` | **It works on the page, not on a server.** | Every action happens in the tab you are looking at. Pause or stop it mid-run. |
| 3 | `03-step-open.png` | **Ask why it clicked that.** | Open any step: the reasoning, the result and the screenshot are all there. |
| 4 | `04-answer.png` | **The answer comes first.** | One to three sentences at the top. Twenty steps stay folded underneath. |
| 5 | `05-rich-answer.png` | **Comparisons you can actually read.** | Ask for five options and get a table, a chart and the numbers that matter. |
| 6 | `06-approval.png` | **It asks before it spends.** | Checkout, submit, delete — anything that matters stops and waits for you. |

Alt lines, if a slide needs a second sentence:

- 01 — "No account, no server, no telemetry. Your key, your browser."
- 02 — "Each row is one action: what it did, on which site, and when."
- 03 — "Reasoning is the model's own; the result is what the page actually returned."
- 04 — "Follow-ups stay in the same thread, with the earlier steps still attached."
- 05 — "Tables sort. Charts come from the values it found, not from a guess."
- 06 — "Approvals show the exact action, the price and the site before anything happens."

## Design notes

- Background: `#0B0D12` matches the panel, so the screenshot edge disappears.
  A slightly lighter `#101319` also works and gives the panel a soft edge.
- Accent for numerals or rules: `#5A9BFF`. Success `#22C55E`, warning `#E0A106`.
- Type: the app uses SF Pro / Inter. For slide text stay on one sans, 700 for the
  headline and 400–500 for the sub. Sentence case throughout — no tracked caps.
- Crops that work: 03 and 06 at natural height; 05 is the tallest, so crop to the
  table if the chart does not fit; 02 is short, so give it more backdrop than
  image and let the text carry it.
- The product is dark and full-bleed; a bright or busy backdrop will fight it.
  Near-black, or a very soft radial glow behind the panel, is the safe lane.
