/**
 * Measures real DeepSeek prompt-cache reuse for ORBIT's transcript.
 *
 *   DEEPSEEK_API_KEY=sk-... node scripts/cache-probe.mjs [turns]
 *
 * It builds the exact bodies the extension sends (same builders, same system
 * prompt, same tool schema) for a synthetic run whose page observations are
 * page-sized, sends them one after another like a real session, and reports
 * what the API says about each one: prompt_cache_hit_tokens against
 * prompt_cache_miss_tokens.
 *
 * Nothing here is estimated. The numbers printed are the provider's.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TURNS = Number(process.argv[2] ?? 12);
const KEY = process.env.DEEPSEEK_API_KEY;
if (!KEY) {
  console.error('DEEPSEEK_API_KEY is not set. Nothing was measured.');
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'orbit-cache-'));
const bundle = join(work, 'providers.mjs');
execFileSync(
  'npx',
  ['--yes', 'esbuild', 'src/providers/openai.ts', '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`],
  { stdio: 'inherit' },
);
execFileSync(
  'npx',
  ['--yes', 'esbuild', 'src/providers/prompt.ts', '--bundle', '--format=esm', '--platform=node', `--outfile=${join(work, 'prompt.mjs')}`],
  { stdio: 'inherit' },
);

const { buildOpenAIBody } = await import(bundle);
const { SYSTEM_PROMPT } = await import(join(work, 'prompt.mjs'));
rmSync(work, { recursive: true, force: true });

/** A page digest of roughly the size a real product page produces. */
function page(index) {
  const elements = Array.from(
    { length: 55 },
    (_, i) =>
      `[el_${i + 1}] <a> "Item ${i + 1} for turn ${index}" href=https://shop.example/item/${index}/${i + 1}`,
  ).join('\n');
  const text = Array.from(
    { length: 18 },
    (_, i) => `Line ${i + 1} of visible page text describing the product, price and delivery terms.`,
  ).join('\n');
  return [
    `URL: https://shop.example/product/${index}`,
    'TITLE: Wireless headphones under 15,000',
    'ACCESSIBILITY TREE:',
    'region “Results”',
    '  list “Products”',
    '    listitem “Sony WH-CH720N”',
    '    listitem “JBL Tune 770NC”',
    'Interactive elements (55 total):',
    elements,
    'Visible page text (untrusted):',
    text,
  ].join('\n');
}

const steps = Array.from({ length: TURNS }, (_, i) => ({
  id: `step-probe-${i + 1}`,
  action: { type: 'click', elementId: `el_${(i % 50) + 1}` },
  reasoning: `Open listing ${i + 1} to compare its price.`,
  result: `Clicked el_${(i % 50) + 1} “Item ${i + 1}”.`,
  observation: page(i + 1),
  status: 'success',
}));

const request = (count) => ({
  system: `${SYSTEM_PROMPT}\n\nRuntime capability: Screenshots are NOT available for this model. Never call screenshot; use element ids or click_at.`,
  initialMessage: `OBJECTIVE: compare five wireless headphones under 15,000\n\nINITIAL SNAPSHOT\n${page(0)}`,
  steps: steps.slice(0, count),
  current: { observation: page(count) },
  includeImages: false,
});

const rows = [];
let previous = null;
for (let turn = 1; turn <= TURNS; turn++) {
  // The page the model is looking at is the one the last step produced.
  const body = buildOpenAIBody(
    'deepseek-flash',
    { ...request(turn), current: turn === 0 ? undefined : { observation: page(turn) } },
    false,
    false,
    true,
  );
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) {
    console.error(`turn ${turn}: HTTP ${response.status}`, JSON.stringify(json).slice(0, 400));
    break;
  }
  const usage = json.usage ?? {};
  const hit = usage.prompt_cache_hit_tokens ?? 0;
  const miss = usage.prompt_cache_miss_tokens ?? Math.max(0, (usage.prompt_tokens ?? 0) - hit);
  const rate = hit + miss > 0 ? (hit / (hit + miss)) * 100 : 0;
  const prefix = JSON.stringify(body.messages);

  const shifted =
    previous && !prefix.startsWith(previous)
      ? 'PREFIX CHANGED before its end — cache cannot be reused'
      : previous
        ? 'extends the previous request'
        : 'first request';

  rows.push({ turn, hit, miss, rate, total: usage.prompt_tokens ?? 0, shifted });
  console.log(
    `turn ${String(turn).padStart(2)}  ${hit.toLocaleString().padStart(7)} hit  ${miss.toLocaleString().padStart(6)} miss  ${rate.toFixed(1).padStart(5)}%  ${shifted}`,
  );
  previous = prefix;
}

const hit = rows.reduce((sum, row) => sum + row.hit, 0);
const miss = rows.reduce((sum, row) => sum + row.miss, 0);
console.log(
  `\nsession: ${rows.length} requests, ${hit.toLocaleString()} hit / ${miss.toLocaleString()} miss, ` +
    `${((hit / Math.max(1, hit + miss)) * 100).toFixed(1)}% cached`,
);
const steady = rows.filter((row) => row.turn > 1);
if (steady.length) {
  const steadyRate =
    steady.reduce((sum, row) => sum + row.rate, 0) / steady.length;
  console.log(`steady state (turns 2+): ${steadyRate.toFixed(1)}% per turn`);
}
const breaks = rows.filter((row) => row.shifted.startsWith('PREFIX CHANGED'));
if (breaks.length) {
  console.log(`\nprefix broke at turn(s): ${breaks.map((row) => row.turn).join(', ')}`);
}
