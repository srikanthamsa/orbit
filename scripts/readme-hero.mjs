/**
 * The README banner. 1760x1100 so GitHub renders it crisp at half size.
 *
 *   node scripts/readme-hero.mjs      (needs `npm run preview` running)
 */
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';

const CHROME = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);
const W = 1760;
const H = 1000;

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif';

const html = (panel) => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #000; }
  .stage {
    position: relative; width: ${W}px; height: ${H}px; overflow: hidden;
    font-family: ${FONT}; color: #fff;
    background:
      radial-gradient(46% 52% at 78% 8%, rgba(126, 96, 255, .38), transparent 62%),
      radial-gradient(52% 58% at 12% 6%, rgba(78, 116, 255, .42), transparent 64%),
      radial-gradient(58% 54% at 52% 104%, rgba(26, 158, 190, .30), transparent 62%),
      radial-gradient(40% 40% at 88% 92%, rgba(180, 74, 210, .26), transparent 66%),
      linear-gradient(158deg, #111529 0%, #0a0c18 52%, #06070d 100%);
    -webkit-font-smoothing: antialiased;
  }

  /* brand ring, far behind everything */
  .ring {
    position: absolute; left: 542px; top: -230px; width: 1500px; height: 1500px;
    border-radius: 50%;
    background: conic-gradient(from 200deg, #5f8cff, #a06bff 30%, #2fd0e0 58%, #5f8cff 82%, #5f8cff);
    -webkit-mask-image: radial-gradient(circle, transparent 62.4%, #000 63%, #000 64.4%, transparent 65%);
    mask-image: radial-gradient(circle, transparent 62.4%, #000 63%, #000 64.4%, transparent 65%);
    filter: blur(1.5px);
    opacity: .38;
  }
  .bloom {
    position: absolute; left: 700px; top: -60px; width: 1100px; height: 1100px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(96, 124, 255, .34), transparent 62%);
    filter: blur(30px);
  }

  /* copy */
  .copy { position: absolute; left: 128px; top: 286px; width: 790px; }
  .mark { display: flex; align-items: center; gap: 16px; }
  .orb {
    width: 52px; height: 52px; border-radius: 50%;
    background:
      radial-gradient(circle at 33% 27%, rgba(255,255,255,.9), rgba(255,255,255,0) 44%),
      conic-gradient(from 200deg, #8fbaff, #3f7cf2 30%, #1c3f8f 58%, #5b8cff 82%, #8fbaff);
    -webkit-mask-image: radial-gradient(circle, transparent 0 30%, #000 31.5%);
    mask-image: radial-gradient(circle, transparent 0 30%, #000 31.5%);
    filter: drop-shadow(0 0 22px rgba(110, 150, 255, .55));
  }
  .word {
    font-size: 38px; font-weight: 700; letter-spacing: .26em; text-transform: uppercase;
    color: rgba(255,255,255,.92);
  }
  h1 {
    margin: 40px 0 0; font-size: 84px; line-height: 1.0; font-weight: 800;
    letter-spacing: -.045em;
  }
  h1 span { display: block; }
  h1 .dim {
    color: rgba(255,255,255,.52);
  }
  .sub {
    margin: 32px 0 0; font-size: 25px; line-height: 1.45; color: rgba(255,255,255,.62);
    max-width: 29em; font-weight: 400;
  }
  .trust {
    margin: 46px 0 0; display: flex; align-items: center; gap: 14px;
    font-size: 15px; letter-spacing: .04em; color: rgba(255,255,255,.46);
  }
  .trust i { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,.28); }

  /* product window */
  .ui {
    position: absolute; left: 962px; top: 118px; width: 660px;
    border-radius: 22px; overflow: hidden;
    background: #0b0b0e;
    box-shadow:
      0 0 0 1px rgba(255,255,255,.12),
      0 0 0 6px rgba(255,255,255,.02),
      0 80px 160px -50px rgba(0,0,0,.95),
      0 34px 70px -30px rgba(0,0,0,.8),
      0 0 160px rgba(110, 138, 255, .22);
  }
  .ui img { display: block; width: 100%; height: auto; }
  .ui::after {
    content: ''; position: absolute; inset: 0; border-radius: 22px; pointer-events: none;
    background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,0) 9%);
  }

  .sheen {
    position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(178deg, rgba(255,255,255,.06), transparent 26%);
  }
  .vig {
    position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(120% 100% at 50% 40%, transparent 46%, rgba(0,0,0,.55) 100%);
  }
</style></head><body>
  <div class="stage">
    <div class="bloom"></div>
    <div class="ring"></div>
    <div class="copy">
      <div class="mark"><div class="orb"></div><div class="word">Orbit</div></div>
      <h1><span>Say what you need.</span><span class="dim">It does the work.</span></h1>
      <p class="sub">An autonomous agent in your side panel. It reads the page, clicks through it, and answers in a table, a chart or a sentence.</p>
      <div class="trust"><span>Bring your own key</span><i></i><span>No account</span><i></i><span>MIT licensed</span></div>
    </div>
    <div class="ui"><img src="${panel}" alt="" /></div>
    <div class="sheen"></div>
    <div class="vig"></div>
  </div>
</body></html>`;

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const capture = await browser.newPage({
    viewport: { width: 400, height: 900 },
    deviceScaleFactor: 2,
  });
  await capture.goto('http://localhost:5199/?demo=genui', { waitUntil: 'networkidle' });
  await capture.waitForTimeout(600);
  await capture.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const style = getComputedStyle(el);
      if (el.scrollHeight > el.clientHeight + 40 && /auto|scroll/.test(style.overflowY)) {
        el.scrollTop = el.scrollHeight;
      }
    }
  });
  await capture.waitForTimeout(300);
  const shot = await capture.screenshot({ clip: { x: 0, y: 250, width: 400, height: 640 } });
  await capture.close();

  const view = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await view.setContent(html(`data:image/png;base64,${shot.toString('base64')}`), {
    waitUntil: 'load',
  });
  await view.waitForTimeout(200);
  const el = await view.$('.stage');
  const png = await el.screenshot({ type: 'png' });
  await mkdir('docs/screenshots', { recursive: true });
  await writeFile('docs/screenshots/hero.png', png);
  console.log(`hero.png ${png.length} bytes`);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
