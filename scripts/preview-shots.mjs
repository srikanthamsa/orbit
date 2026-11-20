import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const executablePath = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);
const outDir = process.argv[2] ?? '/tmp/orbit-shots';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 400, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(err.message));

for (const demo of ['home', 'workspace', 'approval', 'done', 'settings', 'light']) {
  await page.goto(`http://localhost:5199/?demo=${demo}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const metrics = await page.evaluate(() => {
    const root = document.getElementById('root');
    const main = document.querySelector('main');
    return {
      innerWidth: window.innerWidth,
      bodyScroll: document.body.scrollWidth,
      rootScroll: root?.scrollWidth,
      mainScroll: main?.scrollWidth,
      docScroll: document.documentElement.scrollWidth,
    };
  });
  console.log(demo, JSON.stringify(metrics));
  await page.screenshot({ path: join(outDir, `${demo}.png`) });
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
