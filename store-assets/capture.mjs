/**
 * Captures the real extension for the store slides.
 *
 * Launches Chromium with the built extension loaded, resolves its ID from the
 * service worker, opens the actual side panel page, seeds it with a finished
 * session in chrome.storage, and shoots each state at 2x.
 *
 *   npm run build
 *   node store-assets/capture.mjs
 */
import { chromium } from 'playwright-core';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';

const EXTENSION = join(process.cwd(), '.output/chrome-mv3');
const OUT = join(process.cwd(), 'store-assets/raw');
const PANEL_WIDTH = 400;
const executablePath = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);

const now = Date.now();
const PROVIDER = { id: 'p_sonnet', provider: 'anthropic', label: 'Claude', model: 'claude-sonnet-4-5' };

function step(index, label, result, reasoning, action) {
  return {
    id: `step_${index}`,
    index,
    action: action ?? { type: 'click', elementId: `el_${index}` },
    label,
    status: 'success',
    result,
    observation: 'URL: https://www.flipkart.com/search?q=wireless+headphones',
    reasoning,
    at: now - 1000 * 60 * 12 + index * 1000,
  };
}

const STEPS = [
  step(0, 'Navigate to flipkart.com/search', 'Opened the search results page.', 'Start from a store that lists specs and prices.', {
    type: 'navigate',
    url: 'https://www.flipkart.com/search?q=wireless+headphones',
  }),
  step(1, 'Type into “Search for Products”', 'Typed 33 characters.', 'Narrow to over-ear, wired options.'),
  step(2, 'Press Enter', 'Submitted the search form.', 'Run the new query.', { type: 'press', elementId: 'el_2', key: 'Enter' }),
  step(3, 'Scroll down', 'Scrolled to 700px of 8420px.', 'More listings above the fold.'),
  step(4, 'Capture screenshot', 'Captured the visible tab.', 'Confirm the cards rendered.', { type: 'screenshot' }),
  step(5, 'Click “Sony WH-CH720N”', 'Opened the product page.', 'Open the strongest match to verify ANC, battery and seller.'),
];

const HISTORY = [
  {
    id: 'rec_headphones',
    objective: 'Compare five wireless headphones under ₹15,000',
    status: 'completed',
    stepCount: 6,
    createdAt: now - 1000 * 60 * 60 * 2,
    completedAt: now - 1000 * 60 * 60 * 1.8,
    costUsd: 0.24,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    steps: STEPS,
    summary:
      'The JBL Tune 770NC is the one for flights: 70 hours of battery for ₹6,999, twice the Sony at ₹2,000 less. The Sony sounds better and cancels more noise, so it stays the pick if comfort matters more than price.',
    blocks: [
      {
        type: 'table',
        title: 'Over-ear headphones under ₹15,000',
        columns: ['Model', 'Price', 'Rating', 'Battery'],
        rows: [
          ['boAt Rockerz 550', '₹1,999', '3.9', '20 h'],
          ['Noise New Era', '₹2,499', '3.8', '50 h'],
          ['JBL Tune 770NC', '₹6,999', '4.2', '70 h'],
          ['Soundcore Space One', '₹7,499', '4.2', '40 h'],
          ['Sony WH-CH720N', '₹8,990', '4.3', '35 h'],
        ],
      },
      {
        type: 'chart',
        title: 'Battery on one charge',
        chart: 'bar',
        unit: ' h',
        data: [
          { label: 'boAt', value: 20 },
          { label: 'Noise', value: 50 },
          { label: 'JBL', value: 70 },
          { label: 'Soundcore', value: 40 },
          { label: 'Sony', value: 35 },
        ],
      },
      {
        type: 'stats',
        items: [
          { label: 'Best for flights', value: '70 h', hint: 'JBL Tune 770NC · ₹6,999' },
          { label: 'Best noise cancelling', value: '4.3 ★', hint: 'Sony WH-CH720N · ₹8,990' },
        ],
      },
    ],
  },
  {
    id: 'rec_dlc',
    objective: 'What DLC does Road Redemption have, and which have their own store page?',
    status: 'completed',
    stepCount: 9,
    createdAt: now - 1000 * 60 * 60 * 26,
    completedAt: now - 1000 * 60 * 60 * 25,
    costUsd: 0.08,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    summary: 'Three of the six DLC have their own store page: 1180010, 727050 and 727440.',
  },
  {
    id: 'rec_jobs',
    objective: 'Find 20 remote product manager jobs and compile them',
    status: 'completed',
    stepCount: 22,
    createdAt: now - 1000 * 60 * 60 * 50,
    completedAt: now - 1000 * 60 * 60 * 49,
    costUsd: 0.31,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    summary: 'Twenty roles with salary bands, all remote-first, at least one per company.',
  },
];

const RUNNING_TASK = {
  id: 'task_store',
  objective: 'Compare five wireless headphones under ₹15,000',
  status: 'running',
  currentStep: STEPS.length,
  maxSteps: 25,
  createdAt: now - 1000 * 60 * 13,
  updatedAt: now - 1000 * 60 * 11,
};

const SETTINGS = {
  theme: 'dark',
  maxSteps: 25,
  maxCostUsd: 2,
  approvalMode: 'sensitive',
  sessionOnlyKeys: true,
  activeProviderId: PROVIDER.id,
};

const meta = {};

const resetScroll = () =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0) el.scrollTop = 0;
    window.scrollTo(0, 0);
  });

/**
 * One fixed tall frame for every state. The panel scrolls itself to its newest
 * step on mount, so an auto-height measurement taken then reports whatever was
 * on screen; a fixed frame is boring and correct, and the slide template does
 * its own cropping.
 */
const FRAME = { width: PANEL_WIDTH, height: 1180 };

async function shoot(page, name) {
  // Focus the site so the panel reports its host, then shoot the panel while it
  // sits in the background: an unfocused page still renders in headless.
  await site.bringToFront();
  await page.setViewportSize(FRAME);
  await page.waitForTimeout(500);
  await resetScroll();
  await page.waitForTimeout(400);
  await resetScroll();
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  meta[name] = { ...FRAME };
  console.log(`  ${name}.png  ${FRAME.width}x${FRAME.height}`);
}

const profile = mkdtempSync(join(tmpdir(), 'orbit-store-'));
mkdirSync(OUT, { recursive: true });

const context = await chromium.launchPersistentContext(profile, {
  executablePath,
  headless: true,
  viewport: { width: PANEL_WIDTH, height: 900 },
  deviceScaleFactor: 2,
  args: [
    `--disable-extensions-except=${EXTENSION}`,
    `--load-extension=${EXTENSION}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
  ],
});

let worker = context.serviceWorkers()[0];
if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 20000 });
const id = new URL(worker.url()).host;
console.log('extension', id);

// A real site tab, so the panel reports a real host instead of refusing to
// describe the extension page it is being loaded as.
const site = await context.newPage();
await site
  .goto('https://www.flipkart.com/search?q=wireless+headphones', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  })
  .catch((error) => console.log('site load skipped:', error.message.split('\n')[0]));
await site.bringToFront();

const page = await context.newPage();
const panelUrl = `chrome-extension://${id}/sidepanel.html`;

async function seed(storage) {
  await page.goto(panelUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate((payload) => chrome.storage.local.set(payload), storage);
  // The app shows onboarding until a key exists. Keys are session-scoped by
  // default, so the demo needs one in session storage too. It is never used:
  // no request leaves this process.
  await page.evaluate(() =>
    chrome.storage.session.set({
      'orbit.credentials': { p_sonnet: { apiKey: 'sk-ant-demo-key-not-used' } },
    }),
  );
}

async function reload() {
  await page.goto(panelUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0) el.scrollTop = 0;
  });
}

// 1 · home: the greeting, history and composer
await seed({
  'orbit.settings': SETTINGS,
  'orbit.providers': [PROVIDER],
  'orbit.history': HISTORY,
  'orbit.checkpoint': null,
});
await reload();
await shoot(page, 'home');

// 2 · a short answer, opened from history
await reload();
await page.getByText('What DLC does Road Redemption have', { exact: false }).first().click();
await page.waitForTimeout(600);
await shoot(page, 'answer');

// 3 · the same answer with its table, chart and tiles
await reload();
await page.getByText('Compare five wireless headphones under ₹15,000', { exact: false }).first().click();
await page.waitForTimeout(600);
await shoot(page, 'rich');

// 4 · a step opened, to show the reasoning and the result behind it
await seed({
  'orbit.settings': SETTINGS,
  'orbit.providers': [PROVIDER],
  'orbit.history': HISTORY,
  'orbit.checkpoint': null,
});
await reload();
await page.getByText('Compare five wireless headphones under ₹15,000', { exact: false }).first().click();
await page.waitForTimeout(700);
const rows = await page.$$('button[aria-expanded]');
if (rows.length) {
  await rows[rows.length - 1].click();
  await page.waitForTimeout(300);
}
await shoot(page, 'step-open');

writeFileSync(join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
await context.close();
console.log('captured', Object.keys(meta).length, 'states');
