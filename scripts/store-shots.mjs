/**
 * Store screenshots for the Chrome Web Store listing (1280×800) and the README.
 *
 * The product is a desktop side panel, so the tiles borrow the composition
 * language of app-store shot generators — one promise per tile, a device that
 * bleeds off the frame, a tinted field — rather than goldie's simulator
 * pipeline, which only drives iOS and Android builds.
 *
 *   node scripts/store-shots.mjs
 */
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, rename } from 'node:fs/promises';

const CHROME = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);
const BASE = process.env.ORBIT_PREVIEW ?? 'http://localhost:5199';

const TILES = [
  {
    demo: 'home',
    file: '01-home',
    kicker: 'An agent, not a chat box',
    headline: 'Type the outcome.\nIt does the work.',
    support: 'It sees the page you see, acts in that tab, and shows every step it took.',
    tint: '#4f83ff',
    layout: 'editorial',
    scroll: 0,
  },
  {
    demo: 'workspace',
    file: '02-working',
    kicker: 'Watched, not trusted',
    headline: 'You watch it work.',
    support: 'Live page, live action and a full timeline. Stop it any time.',
    tint: '#4f83ff',
    layout: 'editorial',
    scroll: 0.18,
  },
  {
    demo: 'approval',
    file: '03-approval',
    kicker: 'Buying is your call',
    headline: 'It asks before\nanything that matters.',
    support: 'Submits, sends, purchases and deletes wait for you — decided in code, not by the model.',
    tint: '#e8a33d',
    layout: 'editorial',
    scroll: 0.42,
  },
  {
    demo: 'genui',
    file: '04-answer',
    kicker: 'An answer, not a dump',
    headline: 'Tables. Charts.\nReal answers.',
    support: 'Compare five products and get a sortable table. Ask about a trend and get a chart.',
    tint: '#3fa87a',
    layout: 'editorial',
    scroll: 0.62,
  },
  {
    demo: 'settings',
    file: '05-model',
    kicker: 'Your key, your model',
    headline: 'Bring your own model.',
    support: 'OpenAI, Anthropic, Gemini, DeepSeek or any compatible endpoint. No ORBIT account.',
    tint: '#8b7cf6',
    layout: 'editorial',
    scroll: 0,
  },
];

const W = 1280;
const H = 800;
const PANEL_W = 356;
const PANEL_H = Math.round((PANEL_W * 900) / 400);

/** A browser window: traffic lights, a tab strip line, then the panel. */
const frame = (src) => `
  <div class="window">
    <div class="bar">
      <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
      <span class="tab">ORBIT</span>
    </div>
    <img src="${src}" alt="" />
  </div>`;

const page = (tile, src) => {
  const device = `<div class="stage editorial">${frame(src)}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body {
    font-family: -apple-system, "SF Pro Display", system-ui, sans-serif;
    color: #f4f5f7;
    background:
      radial-gradient(90% 80% at 78% 18%, ${tile.tint}22 0%, transparent 60%),
      radial-gradient(70% 70% at 12% 92%, ${tile.tint}14 0%, transparent 62%),
      linear-gradient(155deg, #0b0d12 0%, #090a0e 46%, #07080b 100%);
    position: relative;
  }
  .glow { position: absolute; width: 720px; height: 720px; right: -120px; top: 40px; border-radius: 50%; background: radial-gradient(circle, ${tile.tint}2e 0%, transparent 68%); filter: blur(30px); z-index: 0; }
  body::after {
    content: "";
    position: absolute; inset: 0;
    background-image: radial-gradient(rgba(255,255,255,.045) 1px, transparent 1px);
    background-size: 26px 26px;
    mask-image: radial-gradient(70% 60% at 50% 40%, #000 0%, transparent 78%);
    pointer-events: none;
  }
  .copy { position: absolute; z-index: 2; }
  .editorial .copy, .copy.editorial { left: 88px; top: 50%; transform: translateY(-50%); width: 520px; }
  .hero .copy, .copy.hero { left: 0; right: 0; top: 62px; text-align: center; padding: 0 120px; }
  .kicker {
    font-size: 13px; font-weight: 590; letter-spacing: .08em; text-transform: uppercase;
    color: ${tile.tint}; margin-bottom: 18px;
  }
  h1 {
    font-size: 54px; line-height: 1.06; font-weight: 660; letter-spacing: -.035em;
    white-space: pre-line; text-wrap: balance;
  }
  p { margin-top: 20px; font-size: 17px; line-height: 1.5; color: #a4a9b4; font-weight: 420; }

  .stage { position: absolute; z-index: 1; }
  .stage.editorial { right: 46px; bottom: -59px; }
  .stage.hero { left: 50%; transform: translateX(-50%); bottom: -168px; }

  .window {
    width: ${PANEL_W + 24}px;
    padding: 0 12px 0;
    border-radius: 18px;
    background: linear-gradient(180deg, #17191f 0%, #101216 100%);
    border: 1px solid rgba(255,255,255,.09);
    box-shadow:
      0 2px 4px rgba(0,0,0,.5),
      0 40px 90px -30px rgba(0,0,0,.85),
      0 0 0 1px rgba(255,255,255,.02),
      0 0 90px -20px ${tile.tint}55;
    overflow: hidden;
  }
  .bar {
    height: 34px; display: flex; align-items: center; gap: 7px;
    padding: 0 4px; border-bottom: 1px solid rgba(255,255,255,.06);
  }
  .dot { width: 9px; height: 9px; border-radius: 50%; display: block; }
  .dot.r { background: #ff5f57; } .dot.y { background: #febc2e; } .dot.g { background: #28c840; }
  .tab {
    margin-left: 12px; font-size: 11px; font-weight: 590; letter-spacing: .02em;
    color: #8f95a1; padding: 3px 10px; border-radius: 6px; background: rgba(255,255,255,.05);
  }
  img { display: block; width: ${PANEL_W}px; height: ${PANEL_H}px; object-fit: cover; object-position: top; }
</style></head>
<body>
  <div class="glow"></div>
  <div class="copy ${tile.layout}">
    <div class="kicker">${tile.kicker}</div>
    <h1>${tile.headline}</h1>
    <p>${tile.support}</p>
  </div>
  ${device}
</body></html>`;
};

const shot = async (browser, demo, name, scroll) => {
  const capture = await browser.newPage({
    viewport: { width: 400, height: 900 },
    deviceScaleFactor: 2,
  });
  await capture.goto(`${BASE}/?demo=${demo}`, { waitUntil: 'networkidle' });
  await capture.waitForTimeout(600);
  await capture.evaluate((fraction) => {
    const scrollers = [...document.querySelectorAll('*')].filter(
      (el) => el.scrollHeight > el.clientHeight + 40,
    );
    const target = scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (target) target.scrollTop = fraction * (target.scrollHeight - target.clientHeight);
  }, scroll);
  const raw = `/tmp/orbit-tile-${name}.png`;
  await capture.screenshot({ path: raw });
  await capture.close();
  return raw;
};

const main = async () => {
  await mkdir('store/screenshots', { recursive: true });
  await mkdir('docs/screenshots', { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--allow-file-access-from-files'],
  });

  for (const tile of TILES) {
    const raw = await shot(browser, tile.demo, tile.file, tile.scroll ?? 0);
    const compose = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await compose.setContent(page(tile, `data:image/png;base64,${(await import('node:fs')).readFileSync(raw).toString('base64')}`));
    await compose.waitForTimeout(350);
    await compose.screenshot({ path: `store/screenshots/${tile.file}.png` });
    await compose.close();
    console.log('tile', tile.file);
  }

  await browser.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
