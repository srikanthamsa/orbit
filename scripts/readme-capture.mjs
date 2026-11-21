/**
 * Captures the real side panel for the README shots, trimmed to its content.
 *
 *   npm run preview &   # port 5199
 *   node scripts/readme-capture.mjs
 */
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const OUT = '/tmp/orbit-readme';
const executablePath = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 400, height: 900 }, deviceScaleFactor: 3 });
const meta = {};

async function capture(demo, file, prepare) {
  await page.setViewportSize({ width: 400, height: 900 });
  await page.goto(`http://localhost:5199/?demo=${demo}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  if (prepare) await prepare();
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0) el.scrollTop = 0;
  });
  await page.waitForTimeout(200);
  const height = await page.evaluate(() => {
    const leaves = [...document.querySelectorAll('span, p')].filter((el) => el.children.length === 0);
    const last = leaves
      .map((el) => el.getBoundingClientRect().bottom)
      .filter((bottom) => bottom > 0)
      .sort((a, b) => b - a)[0];
    return Math.ceil((last ?? 700) + 22);
  });
  await page.setViewportSize({ width: 400, height });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, file) });
  meta[file] = { width: 400, height };
  console.log(file, `400x${height}`);
}

await capture('conversation', 'answer.png');
await capture('workspace', 'running.png');
// One step opened so the shot shows what a collapsed row hides.
await capture('conversation', 'trace.png', async () => {
  const rows = await page.$$('button[aria-expanded]');
  await rows[rows.length - 1].click();
  await page.waitForTimeout(250);
});

writeFileSync(join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
await browser.close();
