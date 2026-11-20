/**
 * End-to-end: the real extension, a real page, a mocked OpenAI endpoint.
 * Build first: ORBIT_E2E=1 npx wxt build
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const executablePath = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);
const extensionPath = new URL('../.output-e2e/chrome-mv3', import.meta.url).pathname;

const pageHtml = `<!doctype html>
<html><head><meta charset="utf-8"><title>ORBIT test page</title></head>
<body style="font-family: sans-serif; padding: 40px">
  <h1>Test form</h1>
  <input id="name" placeholder="Your name" />
  <button id="go" onclick="document.getElementById('result').textContent='clicked'">Search</button>
  <p id="result"></p>
</body></html>`;

const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(pageHtml);
});
await new Promise((resolve) => server.listen(5200, resolve));

const scripted = [
  { type: 'find', query: 'name', reasoning: 'Locate the name field first.' },
  {
    type: 'batch',
    actions: [
      { type: 'type', elementId: 'el_1', text: 'hello' },
      { type: 'click', elementId: 'el_2' },
    ],
    reasoning: 'Fill the name and press search in one batch.',
  },
  { type: 'finish', summary: 'Completed the test.', reasoning: 'The find and batch succeeded.' },
];
let modelCalls = 0;
let controlSeenDuringRun = false;
const requestBodies = [];

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'orbit-e2e-')), {
  executablePath,
  headless: true,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-first-run',
  ],
});

try {
  const target = await context.newPage();
  await target.goto('http://localhost:5200/');

  await context.route('https://api.openai.com/v1/chat/completions', async (route) => {
    modelCalls += 1;
    requestBodies.push(JSON.parse(route.request().postData() ?? '{}'));
    if (modelCalls === 1) {
      try {
        await target.waitForFunction(() => !!document.getElementById('__orbit_control__'), null, {
          timeout: 5000,
        });
        controlSeenDuringRun = true;
      } catch {
        controlSeenDuringRun = false;
      }
    }
    const action = scripted[Math.min(modelCalls - 1, scripted.length - 1)];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: `call_${modelCalls}`,
                  type: 'function',
                  function: { name: 'orbit_action', arguments: JSON.stringify(action) },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 30 },
      }),
    });
  });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extensionId = new URL(worker.url()).host;

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await panel.evaluate(async () => {
    await chrome.storage.local.set({
      'orbit.settings': {
        theme: 'dark',
        maxSteps: 10,
        maxCostUsd: 1,
        approvalMode: 'sensitive',
        sessionOnlyKeys: false,
        activeProviderId: 'p_e2e',
      },
      'orbit.providers': [{ id: 'p_e2e', provider: 'openai', model: 'gpt-4o-mini' }],
      'orbit.credentials': { p_e2e: { apiKey: 'sk-test-key' } },
      'orbit.history': [],
    });
    await chrome.storage.local.remove('orbit.checkpoint');
  });
  await panel.reload();
  await panel.waitForSelector('textarea');

  const errors = [];
  panel.on('pageerror', (err) => errors.push(err.message));

  await target.bringToFront();
  await panel.locator('textarea').fill('Type hello and press Search');
  await panel.getByRole('button', { name: 'Start task' }).click();

  await panel.getByText('Completed the test.').first().waitFor({ timeout: 30000 });

  const inputValue = await target.locator('#name').inputValue();
  const result = await target.locator('#result').innerText();
  const timeline = await panel.locator('ol li').count();
  const controlRemovedAfter = (await target.locator('#__orbit_control__').count()) === 0;
  const storedKeyInPrompt = requestBodies.some((body) => JSON.stringify(body).includes('sk-test-key'));
  await panel.waitForTimeout(1200);
  const tabGroup = await panel.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'http://localhost:5200/*' });
    if (!tab?.id || tab.groupId === undefined || tab.groupId === -1) return null;
    const group = await chrome.tabGroups.get(tab.groupId);
    return { title: group.title, color: group.color };
  });

  console.log('model calls:', modelCalls);
  console.log('input value:', JSON.stringify(inputValue));
  console.log('button result:', JSON.stringify(result));
  console.log('timeline steps:', timeline);
  console.log('control layer during run:', controlSeenDuringRun);
  console.log('control layer removed after:', controlRemovedAfter);
  console.log('tab group:', JSON.stringify(tabGroup));
  console.log('tool history in final request:', JSON.stringify(requestBodies.at(-1)?.messages?.slice(-3) ?? []).slice(0, 160));
  console.log('key leaked into prompt:', storedKeyInPrompt);
  console.log('page errors:', errors.length ? errors : 'none');

  const ok =
    modelCalls === 3 &&
    inputValue === 'hello' &&
    result === 'clicked' &&
    timeline === 2 &&
    controlSeenDuringRun &&
    controlRemovedAfter &&
    tabGroup?.title === 'ORBIT' &&
    tabGroup?.color === 'green' &&
    !storedKeyInPrompt &&
    errors.length === 0;
  console.log(ok ? 'E2E PASS' : 'E2E FAIL');
  process.exitCode = ok ? 0 : 1;
} finally {
  await context.close();
  server.close();
}
