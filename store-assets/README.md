# Store assets

Seven PNGs the Chrome Web Store asks for, built from the real extension.

```bash
npm run build
node store-assets/capture.mjs   # real extension -> store-assets/raw
node store-assets/render.mjs    # template.html -> store-assets/final
```

| File | Size | What it is |
|---|---|---|
| `final/screenshot-1.png` | 1280×800 | Hero: the answer, window bleeding off the floor |
| `final/screenshot-2.png` | 1280×800 | A step opened: reasoning, result, screenshot |
| `final/screenshot-3.png` | 1280×800 | Two states: the answer and its table |
| `final/screenshot-4.png` | 1280×800 | The verdict first |
| `final/screenshot-5.png` | 1280×800 | Trust: no account, no server, MIT |
| `final/promo-small.png` | 440×280 | Small tile |
| `final/promo-marquee.png` | 1400×560 | Marquee |

`capture.mjs` launches Chromium with `--load-extension` on the built
`.output/chrome-mv3`, resolves the extension ID from its service worker, opens
the real side panel page, seeds it through `chrome.storage`, and shoots four
states at 2×. `render.mjs` lays each slide out in `template.html` at its exact
size, screenshots at 2×, downsamples to the target, and rewrites the PNG as
24-bit RGB because the store rejects alpha.

Both scripts assert rather than assume: `render.mjs` fails if a slide is the
wrong size, if any text leaves the canvas, or if an output is under 10 KB.

The captures are real UI, so a few states are unreachable without running a
task: an in-flight run and the approval sheet only exist while the agent is
working, which needs the user's own API key. The four states here are the ones
the extension can be put into without spending anything.
