/**
 * The context slide: a MacBook Pro 14-inch cropped into the corner, with a real
 * Chrome window on it — a real Flipkart search page and the real ORBIT panel
 * docked at the right edge.
 *
 *   node scripts/store-hero.mjs
 *
 * Frame geometry follows the device-frames reference for the 14-inch MacBook:
 * 1512 × 982 pt screen, 16 pt side and top bezel, 22 pt bottom bezel, 4 pt metal
 * edge, 24 pt lid corner, 38 pt base at 50 pt overhang per side.
 */
import { chromium } from 'playwright-core';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const executablePath = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);

const S = 1.0;                        // uniform device scale
const SCREEN_W = Math.round(1512 * S);
const SCREEN_H = Math.round(982 * S);
const BEZEL_SIDE = Math.round(16 * S);
const BEZEL_TOP = Math.round(16 * S);
const BEZEL_BOTTOM = Math.round(22 * S);
const EDGE = Math.round(4 * S);
const LID_W = SCREEN_W + 2 * (BEZEL_SIDE + EDGE);
const LID_H = SCREEN_H + BEZEL_TOP + BEZEL_BOTTOM + 2 * EDGE;
const BASE_H = Math.round(38 * S);
const BASE_OVERHANG = Math.round(50 * S);
const PANEL_W = Math.round(400 * S);

const page = 'file:///tmp/orbit-readme/page-flipkart.png';
const panel = 'file:///Users/srikanthamsa/Documents/Qoder/2026-11-20/5facb90d/store/raw/05-rich-answer.png';

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1280px; height: 800px; overflow: hidden; }
  body {
    font-family: -apple-system, "SF Pro Display", sans-serif;
    background:
      radial-gradient(120% 90% at 12% 8%, #ffffff 0%, #f5f6f9 42%, #e9ebf1 100%);
    position: relative;
  }
  /* --- the lid, cropped off the left and top edges of the slide --- */
  .lid {
    position: absolute;
    right: ${40}px;
    top: 24px;
    width: ${LID_W}px;
    height: ${LID_H}px;
    border-radius: ${Math.round(24 * S)}px;
    background: linear-gradient(180deg, #cdd0d6 0%, #b6b9c0 42%, #a8abb3 100%);
    box-shadow:
      0 40px 90px -30px rgba(24, 28, 45, .40),
      0 2px 4px rgba(24, 28, 45, .18);
    padding: ${EDGE}px;
  }
  .bezel {
    width: 100%; height: 100%;
    border-radius: ${Math.round(20 * S)}px;
    background: #0a0b0e;
    padding: 0 ${BEZEL_SIDE}px ${BEZEL_BOTTOM}px;
    position: relative;
  }
  /* notch, drawn above the screen */
  .notch {
    position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: ${Math.round(196 * S)}px; height: ${Math.round(32 * S)}px;
    background: #0a0b0e;
    border-radius: 0 0 ${Math.round(13 * S)}px ${Math.round(13 * S)}px;
    z-index: 3;
  }
  .screen {
    width: 100%; height: 100%;
    border-radius: ${Math.round(6 * S)}px;
    overflow: hidden;
    display: flex; flex-direction: column;
    background: #fff;
    position: relative;
  }
  /* --- browser chrome --- */
  .chrome {
    height: ${Math.round(46 * S)}px; flex-shrink: 0;
    background: linear-gradient(180deg, #eceded, #e2e3e6);
    border-bottom: 1px solid #cfd1d5;
    display: flex; align-items: center; gap: ${Math.round(10 * S)}px;
    padding: 0 ${Math.round(12 * S)}px;
  }
  .dots { display: flex; gap: ${Math.round(6 * S)}px; }
  .dots i { display: block; width: ${Math.round(9 * S)}px; height: ${Math.round(9 * S)}px; border-radius: 50%; }
  .dots i:nth-child(1) { background: #ff5f57; }
  .dots i:nth-child(2) { background: #febc2e; }
  .dots i:nth-child(3) { background: #28c840; }
  .url {
    width: ${Math.round(520 * S)}px; margin: 0 auto;
    height: ${Math.round(22 * S)}px; border-radius: ${Math.round(11 * S)}px;
    background: #fff; border: 1px solid #d3d5d9;
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, .03);
    display: flex; align-items: center; justify-content: center; gap: ${Math.round(6 * S)}px;
    font-size: ${Math.round(11 * S)}px; color: #5d626b; letter-spacing: -.005em;
  }
  .lock { width: ${Math.round(7 * S)}px; height: ${Math.round(9 * S)}px; border: 1px solid #8d939c; border-radius: 2px; position: relative; }
  .lock::before { content: ""; position: absolute; left: 1px; right: 1px; top: -${Math.round(4 * S)}px; height: ${Math.round(4 * S)}px; border: 1px solid #8d939c; border-bottom: 0; border-radius: 3px 3px 0 0; }
  /* --- content: page left, panel right --- */
  .content { flex: 1; display: flex; min-height: 0; }
  .site { flex: 1; min-width: 0; overflow: hidden; background: #eaedf3; }
  .site img { width: 100%; height: 100%; object-fit: cover; object-position: left top; display: block; }
  .panel { width: ${PANEL_W}px; flex-shrink: 0; background: #0b0d12; overflow: hidden; border-left: 1px solid #23262e; }
  .panel img { width: 100%; display: block; }
  /* --- the base the lid sits on --- */
  .base {
    position: absolute;
    right: ${40 - BASE_OVERHANG}px;
    top: ${24 + LID_H}px;
    width: ${LID_W + 2 * BASE_OVERHANG}px;
    height: ${BASE_H + 40}px;
    border-radius: 0 0 ${Math.round(18 * S)}px ${Math.round(18 * S)}px;
    background: linear-gradient(180deg, #b0b3ba 0%, #9ba0a8 30%, #8b9099 100%);
    box-shadow: 0 30px 60px -20px rgba(24, 28, 45, .35);
    z-index: -1;
  }
  .base::before {
    content: ""; position: absolute; left: ${Math.round(60 * S)}px; right: ${Math.round(60 * S)}px; top: 0;
    height: 1px; background: rgba(255, 255, 255, .55);
  }
</style></head><body>
  <div class="base"></div>
  <div class="lid">
    <div class="bezel">
      <div class="screen">
        <div class="chrome">
          <div class="dots"><i></i><i></i><i></i></div>
          <div class="url"><span class="lock"></span>flipkart.com/search?q=wireless+headphones</div>
        </div>
        <div class="content">
          <div class="site"><img src="${page}"></div>
          <div class="panel"><img src="${panel}"></div>
        </div>
      </div>
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch({ executablePath, headless: true });
const shot = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const file = join(tmpdir(), 'orbit-store-hero.html');
writeFileSync(file, html);
await shot.goto(`file://${file}`, { waitUntil: 'networkidle' });
await shot.waitForTimeout(600);
await shot.screenshot({ path: 'store/slides/01-context.png' });
console.log('wrote store/slides/01-context.png', `lid ${LID_W}x${LID_H}, panel ${PANEL_W}px`);
await browser.close();
