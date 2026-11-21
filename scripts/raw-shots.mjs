/**
 * Raw UI shots for the store listing: the panel exactly as it renders, no
 * chrome, no backdrop, no text baked in. 3x, trimmed to content, PNG so they
 * composite cleanly.
 *
 *   npm run preview &        # port 5199
 *   node scripts/raw-shots.mjs
 */
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const OUT = 'store/raw';
const executablePath = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 400, height: 900 }, deviceScaleFactor: 3 });

async function shot(demo, file, prepare, viewport = 900) {
  await page.setViewportSize({ width: 400, height: viewport });
  await page.goto(`http://localhost:5199/?demo=${demo}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  if (prepare) await prepare();
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0) el.scrollTop = 0;
  });
  await page.waitForTimeout(250);
  const height = await page.evaluate(() => {
    const leaves = [...document.querySelectorAll('span, p, h1, h2, li')].filter((el) => el.children.length === 0);
    const last = leaves
      .map((el) => el.getBoundingClientRect().bottom)
      .filter((bottom) => bottom > 0)
      .sort((a, b) => b - a)[0];
    return Math.ceil((last ?? 780) + 26);
  });
  await page.setViewportSize({ width: 400, height });
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(OUT, file) });
  console.log(file, `400x${height}`);
}

// 1 · the greeting, the composer, the history — short so the greeting is not
// floating in dead space
await shot('home', '01-home.png', null, 640);
// 2 · mid-run: live action, collapsed steps, pause and stop
await shot('workspace', '02-running.png');
// 3 · a step opened: what it thought, what it found
await shot('conversation', '03-step-open.png', async () => {
  const rows = await page.$$('button[aria-expanded]');
  await rows[rows.length - 1].click();
  await page.waitForTimeout(300);
});
// 4 · the answer, with the question above it
await shot('conversation', '04-answer.png');
// 5 · an answer that turns into a table and a chart
await shot('genui', '05-rich-answer.png');
// 6 · the approval gate
await shot('approval', '06-approval.png');

await browser.close();
