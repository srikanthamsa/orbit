/**
 * README shots: the real side panel, presented as a floating frosted card on a
 * pearl-white Apple-style canvas. Nothing in the card is drawn by hand — the
 * panel is a capture of the running app — so the UI in the README is the UI you
 * get.
 *
 *   npm run preview &
 *   node scripts/readme-capture.mjs   # writes /tmp/orbit-readme
 *   node scripts/readme-white-shots.mjs
 */
import { chromium } from 'playwright-core';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';

const SHOTS = '/tmp/orbit-readme';
const META = JSON.parse(readFileSync(join(SHOTS, 'meta.json'), 'utf8'));
const OUT = 'docs/screenshots';
const BACKDROP =
  'file:///Users/srikanthamsa/Documents/deepseek-harness/default-workspace/generated_images/pearl-backdrop.png';

const executablePath = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1600px; height: 1000px; }
  body {
    font-family: -apple-system, "SF Pro Display", "Helvetica Neue", Inter, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #0b0b0f;
    position: relative;
    overflow: hidden;
    background: #fff;
  }
  .wash {
    position: absolute; inset: 0;
    background-image: url("${BACKDROP}");
    background-size: cover; background-position: center;
    opacity: .85;
  }
  .copy { position: absolute; left: 96px; top: 250px; width: 640px; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; }
  .mark { width: 26px; height: 26px; border-radius: 50%; border: 1.6px solid #0b0b0f; position: relative; }
  .mark::after {
    content: ""; position: absolute; width: 5px; height: 5px; border-radius: 50%;
    background: #0b0b0f; right: -1px; top: 4px;
  }
  .word { font-size: 15px; font-weight: 600; letter-spacing: .14em; }
  h1 { font-size: 64px; line-height: 1.05; letter-spacing: -.038em; font-weight: 700; }
  h1 .dim { color: rgba(11, 11, 15, .34); }
  p.sub {
    margin-top: 24px; font-size: 20px; line-height: 1.5; letter-spacing: -.01em;
    color: rgba(11, 11, 15, .56); max-width: 470px;
  }
  .trust { margin-top: 32px; font-size: 15px; color: rgba(11, 11, 15, .38); }

  /* the panel, floating */
  .window {
    position: absolute; border-radius: 22px; overflow: hidden;
    background: #0b0d12;
    border: 1px solid rgba(11, 11, 15, .10);
    box-shadow:
      0 1px 2px rgba(20, 24, 40, .10),
      0 8px 20px -8px rgba(20, 24, 40, .22),
      0 60px 120px -40px rgba(20, 24, 45, .38),
      inset 0 1px 0 rgba(255, 255, 255, .10);
  }
  /* the frosted chrome that says "this lives in your browser" */
  .bar {
    height: 38px; display: flex; align-items: center; gap: 12px; padding: 0 16px;
    background: rgba(255, 255, 255, .78);
    -webkit-backdrop-filter: blur(26px) saturate(160%);
    backdrop-filter: blur(26px) saturate(160%);
    border-bottom: 1px solid rgba(11, 11, 15, .07);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .95);
  }
  .dots { display: flex; gap: 7px; }
  .dots i { display: block; width: 10px; height: 10px; border-radius: 50%; background: rgba(11, 11, 15, .16); }
  .url {
    flex: 1; height: 22px; display: flex; align-items: center; justify-content: center;
    border-radius: 11px; font-size: 11.5px; letter-spacing: -.005em;
    color: rgba(11, 11, 15, .44);
    background: rgba(255, 255, 255, .66);
    border: 1px solid rgba(11, 11, 15, .05);
  }
  .panel img { width: 100%; display: block; }
`;

/** Panel card width in CSS px; the capture is 3x so this always downscales. */
const CARD = { hero: 512, answer: 560, running: 560, trace: 560 };

function card(shot, width, position) {
  const size = META[`${shot}.png`];
  const h = Math.round((width / size.width) * size.height);
  return {
    height: h + 38,
    style: `width: ${width}px; height: ${h + 38}px; ${position}`,
    img: `file://${SHOTS}/${shot}.png`,
  };
}

const HERO_COPY = `
  <div class="copy">
    <div class="brand"><span class="mark"></span><span class="word">ORBIT</span></div>
    <h1>Say what you need.<br><span class="dim">It does the work.</span></h1>
    <p class="sub">A browser agent that lives in your side panel. It searches, clicks, compares and answers — then shows you every step it took.</p>
    <div class="trust">Bring your own key · No account · MIT licensed</div>
  </div>`;

/** [output name, capture, layout] — the hero reuses the answer capture. */
const SHOTS_OUT = [
  ['hero-white', 'answer', 'hero'],
  ['panel-answer', 'answer', 'answer'],
  ['panel-running', 'running', 'running'],
  ['panel-trace', 'trace', 'trace'],
];

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });

for (const [name, shot, layout] of SHOTS_OUT) {
  const width = CARD[layout];
  const position =
    layout === 'hero'
      ? 'right: 120px; top: 125px;'
      : 'left: 50%; margin-left: -280px; top: 96px;';
  const c = card(shot, width, position);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    ${CSS}
    .window { ${c.style} }
  </style></head><body>
    <div class="wash"></div>
    ${layout === 'hero' ? HERO_COPY : ''}
    <div class="window">
      <div class="bar">
        <div class="dots"><i></i><i></i><i></i></div>
        <div class="url">x.com</div>
      </div>
      <div class="panel"><img src="${c.img}"></div>
    </div>
  </body></html>`;
  const file = join(tmpdir(), `orbit-${name}.html`);
  writeFileSync(file, html);
  await page.goto(`file://${file}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  // JPEG: these are photographic compositions, and PNG put 8 MB of gradients
  // and grain into the repo for four images.
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 90 });
  console.log('wrote', `${OUT}/${name}.jpg`, `${c.height}px card`);
}

await browser.close();
