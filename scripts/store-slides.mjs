/**
 * Chrome Web Store slides, 1280x800.
 *
 * Renders the real side panel (no browser chrome, no device frame) floating on
 * a dark mesh gradient with a soft drop shadow, one idea per slide.
 *
 *   node scripts/store-slides.mjs
 */
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const CHROME = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);
const PREVIEW = 'http://localhost:5199';
const OUT = 'store/screenshots';

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif';

/** Each slide composites one panel crop. `scroll` reads the panel at capture. */
// clip = visible slice of the 400x900 panel, in panel pixels
const PANELS = [
  { key: 'home', demo: 'home', scroll: 0, clip: { y: 0, h: 900 } },
  { key: 'running', demo: 'workspace', scroll: 1, clip: { y: 0, h: 600 } },
  { key: 'answer', demo: 'genui', scroll: 1, clip: { y: 256, h: 650 } },
  { key: 'approval', demo: 'approval', scroll: 0.25, clip: { y: 0, h: 600 } },
  { key: 'settings', demo: 'settings', scroll: 0, clip: { y: 0, h: 640 } },
];

const MESH = {
  blue: `radial-gradient(58% 74% at 16% 8%, rgba(74,112,255,.52), transparent 62%),
         radial-gradient(50% 66% at 88% 20%, rgba(126,92,255,.40), transparent 62%),
         radial-gradient(62% 62% at 60% 106%, rgba(28,164,196,.34), transparent 60%),
         linear-gradient(160deg, #101422 0%, #0a0c14 55%, #07080d 100%)`,
  teal: `radial-gradient(54% 70% at 82% 6%, rgba(32,178,164,.42), transparent 60%),
         radial-gradient(58% 72% at 10% 32%, rgba(60,104,236,.42), transparent 62%),
         radial-gradient(52% 58% at 46% 108%, rgba(44,132,255,.32), transparent 60%),
         linear-gradient(160deg, #0d1520 0%, #080d14 58%, #06080c 100%)`,
  violet: `radial-gradient(56% 72% at 20% 6%, rgba(138,96,255,.46), transparent 60%),
           radial-gradient(48% 62% at 86% 28%, rgba(232,96,190,.30), transparent 62%),
           radial-gradient(60% 62% at 50% 108%, rgba(78,66,236,.38), transparent 60%),
           linear-gradient(160deg, #140f24 0%, #0c0917 58%, #07060c 100%)`,
  amber: `radial-gradient(52% 66% at 84% 8%, rgba(236,164,64,.34), transparent 60%),
          radial-gradient(58% 72% at 14% 18%, rgba(70,96,236,.34), transparent 62%),
          radial-gradient(56% 58% at 42% 108%, rgba(180,78,46,.30), transparent 60%),
          linear-gradient(160deg, #16110c 0%, #0e0a08 58%, #080605 100%)`,
  green: `radial-gradient(54% 70% at 22% 8%, rgba(34,172,126,.34), transparent 60%),
          radial-gradient(50% 66% at 86% 24%, rgba(68,120,236,.32), transparent 62%),
          radial-gradient(58% 60% at 52% 108%, rgba(24,148,136,.30), transparent 60%),
          linear-gradient(160deg, #0a1614 0%, #07100f 58%, #05090a 100%)`,
};

const SLIDES = [
  {
    file: '01-hero',
    mesh: 'blue',
    panel: 'home',
    place: { x: 700, y: 46, w: 560 },
    eyebrow: 'ORBIT',
    headline: 'Say what you need. It does the work.',
    sub: 'An autonomous agent in your side panel. It reads the page, clicks through it, and hands you the answer.',
    align: 'left',
  },
  {
    file: '02-watching',
    mesh: 'teal',
    panel: 'running',
    place: { x: 80, y: 36, w: 560 },
    eyebrow: 'Live steps',
    headline: 'You watch every move.',
    sub: 'Every click, scroll and screenshot lands in the timeline as it happens. Stop it any time.',
    align: 'right',
  },
  {
    file: '03-answer',
    mesh: 'violet',
    panel: 'answer',
    place: { x: 300, y: 320, w: 680 },
    eyebrow: 'Answers',
    headline: 'The result, in a shape you can read.',
    sub: 'A table to compare. A chart for the numbers.',
    align: 'top',
  },
  {
    file: '04-approval',
    mesh: 'amber',
    panel: 'approval',
    place: { x: 660, y: 30, w: 560 },
    eyebrow: 'Control',
    headline: 'It asks before anything that matters.',
    sub: 'Approving a purchase or a send is your call. Set a step budget and a spend cap too.',
    align: 'bottom',
  },
  {
    file: '05-trust',
    mesh: 'green',
    panel: 'settings',
    place: { x: 700, y: 34, w: 500 },
    eyebrow: 'Privacy',
    headline: 'Your key. Your browser.',
    sub: 'Requests go from this browser straight to OpenAI, Anthropic or Gemini. No ORBIT account, no ORBIT server.',
    footnote: 'MIT licensed · open source · keys stay in chrome.storage',
    align: 'left',
  },
];

const SHADOW =
  '0 0 0 1px rgba(255,255,255,.10), 0 60px 140px -40px rgba(0,0,0,.95), 0 24px 64px -24px rgba(0,0,0,.75), 0 0 120px rgba(122,146,255,.16)';

function slideHtml(slide, panel) {
  const place = slide.place;
  const textBlock = (extra = '') => `
    <div class="copy" style="${extra}">
      <p class="eyebrow">${slide.eyebrow}</p>
      <h1>${slide.headline}</h1>
      <p class="sub">${slide.sub}</p>
      ${slide.footnote ? `<p class="foot">${slide.footnote}</p>` : ''}
    </div>`;

  const panelImg = `
    <div class="ui" style="left:${place.x}px; top:${place.y}px; width:${place.w}px">
      <img src="${panel}" alt="" />
    </div>`;

  const layouts = {
    left: `
      ${textBlock('left:88px; top:236px; width:540px')}
      ${panelImg}`,
    right: `
      ${panelImg}
      ${textBlock('left:700px; top:250px; width:490px')}`,
    top: `
      ${textBlock('left:88px; top:78px; width:700px')}
      ${panelImg}`,
    bottom: `
      ${panelImg}
      ${textBlock('left:88px; bottom:96px; width:520px')}`,
  };

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #000; }
    .slide {
      position: relative; width: 1280px; height: 800px; overflow: hidden;
      font-family: ${FONT}; color: #fff;
      background: ${MESH[slide.mesh]};
      -webkit-font-smoothing: antialiased;
    }
    .slide::after {
      content: ''; position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(180deg, rgba(255,255,255,.045), transparent 22%);
    }
    .copy { position: absolute; z-index: 2; }
    .eyebrow {
      margin: 0; font-size: 12px; font-weight: 600; letter-spacing: .2em;
      text-transform: uppercase; color: rgba(255,255,255,.52);
    }
    h1 {
      margin: 18px 0 0; font-size: 60px; line-height: 1.03; font-weight: 800;
      letter-spacing: -.035em; text-wrap: balance;
    }
    .sub {
      margin: 20px 0 0; font-size: 21px; line-height: 1.45; font-weight: 400;
      color: rgba(255,255,255,.64); max-width: 34em;
    }
    .foot {
      margin: 26px 0 0; font-size: 13px; letter-spacing: .01em;
      color: rgba(255,255,255,.4);
    }
    .ui {
      position: absolute; z-index: 1; border-radius: 16px; overflow: hidden;
      box-shadow: ${SHADOW};
      background: #0b0b0e;
    }
    .ui img { display: block; width: 100%; height: auto; }
  </style></head><body>
    <div class="slide" data-slide>${layouts[slide.align]}</div>
  </body></html>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  // 1. Capture the real panel, UI only, at 2x.
  const pages = {};
  const capture = await browser.newPage({
    viewport: { width: 400, height: 900 },
    deviceScaleFactor: 2,
  });
  for (const panel of PANELS) {
    await capture.goto(`${PREVIEW}/?demo=${panel.demo}`, { waitUntil: 'networkidle' });
    await capture.waitForTimeout(500);
    if (panel.scroll > 0) {
      await capture.evaluate((ratio) => {
        for (const el of document.querySelectorAll('*')) {
          const style = getComputedStyle(el);
          if (el.scrollHeight > el.clientHeight + 40 && /auto|scroll/.test(style.overflowY)) {
            el.scrollTop = (el.scrollHeight - el.clientHeight) * ratio;
          }
        }
      }, panel.scroll);
      await capture.waitForTimeout(350);
    }
    const shot = await capture.screenshot({
      clip: { x: 0, y: panel.clip.y, width: 400, height: panel.clip.h },
    });
    pages[panel.key] = `data:image/png;base64,${shot.toString('base64')}`;
  }
  await capture.close();

  // 2. Render and export each slide.
  const view = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  for (const slide of SLIDES) {
    await view.setContent(slideHtml(slide, pages[slide.panel]), { waitUntil: 'load' });
    await view.waitForTimeout(120);
    const el = await view.$('[data-slide]');
    const png = await el.screenshot({ type: 'png' });
    await writeFile(join(OUT, `${slide.file}.png`), png);
    console.log(`${slide.file}.png  ${png.length} bytes`);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
