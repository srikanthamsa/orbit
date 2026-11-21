/**
 * Renders the store slides from template.html.
 *
 * Each slide is laid out at its exact target size, screenshotted at 2x, then
 * downsampled so text keeps its antialiasing while the file is exactly the size
 * the Chrome Web Store asks for. The RGB pass at the end drops the alpha
 * channel, which the store rejects.
 *
 *   node store-assets/render.mjs
 */
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, readFileSync } from 'node:fs';
import { pngToRgb } from './lib/png-rgb.mjs';

const BASE = process.cwd();
const TEMPLATE = `file://${join(BASE, 'store-assets/template.html')}`;
const FINAL = join(BASE, 'store-assets/final');
const TMP = join(BASE, 'store-assets/.render');
const executablePath = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);

/** name, template key, exact output size */
const OUTPUTS = [
  ['screenshot-1', 'hero', 1280, 800],
  ['screenshot-2', 'split', 1280, 800],
  ['screenshot-3', 'trace', 1280, 800],
  ['screenshot-4', 'bento', 1280, 800],
  ['screenshot-5', 'trust', 1280, 800],
  ['promo-small', 'promo-small', 440, 280],
  ['promo-marquee', 'promo-marquee', 1400, 560],
];

mkdirSync(FINAL, { recursive: true });
mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ deviceScaleFactor: 2 });

for (const [name, key, width, height] of OUTPUTS) {
  await page.setViewportSize({ width, height });
  await page.goto(`${TEMPLATE}?s=${key}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });
  await page.waitForTimeout(250);

  // The frame may bleed off the canvas by design (that is the composition), but
  // no piece of text may leave it or be cut.
  const check = await page.evaluate(
    ({ w, h }) => {
      const root = document.getElementById('root').firstElementChild;
      const box = root.getBoundingClientRect();
      const escaped = [];
      // Text inside a card is clipped by design (faded crops); everything else
      // has to sit inside the canvas.
      for (const el of root.querySelectorAll('h1, p, span, div, i')) {
        if (el.closest('.card')) continue;
        if (el.children.length > 0) continue;
        const text = (el.textContent ?? '').trim();
        if (!text) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < -0.5 || r.top < -0.5 || r.right > w + 0.5 || r.bottom > h + 0.5) {
          escaped.push(`${text.slice(0, 30)} @ ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return {
        rootW: Math.round(box.width),
        rootH: Math.round(box.height),
        escaped,
      };
    },
    { w: width, h: height },
  );
  if (check.rootW !== width || check.rootH !== height) {
    throw new Error(`${key}: frame is ${check.rootW}x${check.rootH}, expected ${width}x${height}`);
  }
  if (check.escaped.length) {
    throw new Error(`${key}: text outside the canvas\n  ${check.escaped.join('\n  ')}`);
  }

  const raw = join(TMP, `${name}@2x.png`);
  await page.screenshot({ path: raw, omitBackground: false });

  // 2x down to the exact target, then drop alpha.
  const out = join(FINAL, `${name}.png`);
  execFileSync('sips', ['-z', String(height), String(width), raw, '--out', out], { stdio: 'ignore' });
  const { converted } = pngToRgb(out);

  const bytes = statSync(out).size;
  const header = readFileSync(out);
  const actual = { w: header.readUInt32BE(16), h: header.readUInt32BE(20), colorType: header[25] };
  if (actual.w !== width || actual.h !== height) {
    throw new Error(`${name}: expected ${width}x${height}, got ${actual.w}x${actual.h}`);
  }
  if (actual.colorType !== 2) throw new Error(`${name}: expected RGB (2), got ${actual.colorType}`);
  if (bytes < 10_000) throw new Error(`${name}: only ${bytes} bytes, probably blank`);

  console.log(
    `  ${name}.png  ${actual.w}x${actual.h}  rgb  ${Math.round(bytes / 1024)} KB${converted ? '  (alpha dropped)' : ''}`,
  );
}

await browser.close();
console.log(`\n${OUTPUTS.length} assets in store-assets/final`);
