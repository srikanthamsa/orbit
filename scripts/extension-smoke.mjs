import { chromium } from 'playwright-core';
import { mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const executablePath = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);
const extensionPath = new URL('../.output/chrome-mv3', import.meta.url).pathname;

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'orbit-profile-')), {
  executablePath,
  headless: true,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-first-run',
  ],
});

let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 }).catch(() => null);
if (!worker) {
  console.log('SMOKE FAIL: extension service worker did not start');
  await context.close();
  process.exit(1);
}

const extensionId = new URL(worker.url()).host;
const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
console.log('manifest:', manifest.name, manifest.version, '| permissions:', manifest.permissions.join(','));

const page = await context.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});

await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
await page.waitForTimeout(800);

const heading = await page.locator('h1').first().innerText().catch(() => '');
const brand = await page.locator('header').innerText().catch(() => '');
const hasSidePanelApi = await page.evaluate(() => typeof chrome.sidePanel !== 'undefined');
const storageRoundTrip = await page.evaluate(async () => {
  await chrome.storage.local.set({ 'orbit.smoke': 42 });
  const stored = await chrome.storage.local.get('orbit.smoke');
  await chrome.storage.local.remove('orbit.smoke');
  return stored['orbit.smoke'];
});

console.log('side panel heading:', JSON.stringify(heading));
console.log('brand line:', JSON.stringify(brand.replace(/\s+/g, ' ').trim()));
console.log('sidePanel API available:', hasSidePanelApi);
console.log('storage round-trip:', storageRoundTrip);
console.log('errors:', errors.length ? errors : 'none');

const ok = heading.length > 0 && hasSidePanelApi && storageRoundTrip === 42 && errors.length === 0;
console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL');
await context.close();
process.exit(ok ? 0 : 1);
