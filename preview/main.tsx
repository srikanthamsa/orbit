import { createRoot } from 'react-dom/client';
import App from '@/App';
import { useAgentStore } from '@/stores/agent';
import type { AgentStep, AgentTask, ProviderConfig, TaskRecord } from '@/types';
import { runDomSelfTest } from './dom-test';
import '@/entrypoints/sidepanel/style.css';

// The preview renders the real side panel against seeded state. Chrome APIs
// are absent, so the store is told to skip hydration.
useAgentStore.setState({ hydrate: async () => {} });

const params = new URLSearchParams(location.search);
const demo = params.get('demo') ?? 'home';

if (demo === 'domtest') {
  runDomSelfTest();
} else {
  seedAndRender();
}

function seedAndRender() {

const provider: ProviderConfig = {
  id: 'prov_demo',
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
};

const now = Date.now();

const history: TaskRecord[] = [
  {
    id: 'r1',
    objective: 'Compare the pricing pages of five SaaS products',
    status: 'completed',
    summary: 'Five products compared.',
    stepCount: 18,
    createdAt: now - 1000 * 60 * 90,
    completedAt: now - 1000 * 60 * 84,
    costUsd: 0.11,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
  },
  {
    id: 'r2',
    objective: 'Find 20 remote product manager jobs and compile them',
    status: 'failed',
    stepCount: 7,
    createdAt: now - 1000 * 60 * 60 * 20,
    completedAt: now - 1000 * 60 * 60 * 19,
    costUsd: 0.04,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
  },
  {
    id: 'r3',
    objective: 'Compare headphones under ₹15,000',
    status: 'completed',
    summary: 'Compared 5 headphones.',
    stepCount: 22,
    createdAt: now - 1000 * 60 * 60 * 26,
    completedAt: now - 1000 * 60 * 60 * 25,
    costUsd: 0.09,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
  },
];

const screenshot = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="880" height="540" viewBox="0 0 880 540">
  <rect width="880" height="540" fill="#f7f8fa"/>
  <rect width="880" height="56" fill="#131922"/>
  <circle cx="26" cy="28" r="7" fill="#ff5f57"/><circle cx="48" cy="28" r="7" fill="#febc2e"/><circle cx="70" cy="28" r="7" fill="#28c840"/>
  <rect x="110" y="17" width="420" height="22" rx="11" fill="#2b3442"/>
  <rect x="40" y="92" width="300" height="26" rx="6" fill="#1f2733"/>
  <rect x="40" y="140" width="150" height="14" rx="4" fill="#c4cad4"/>
  <g>
    <rect x="40" y="180" width="250" height="320" rx="12" fill="#ffffff" stroke="#e4e7ec"/>
    <rect x="56" y="196" width="218" height="150" rx="8" fill="#eef1f6"/>
    <rect x="56" y="362" width="180" height="12" rx="4" fill="#39414d"/>
    <rect x="56" y="384" width="120" height="10" rx="4" fill="#b6bdc9"/>
    <rect x="56" y="418" width="80" height="22" rx="6" fill="#0a7f5a"/>
  </g>
  <g>
    <rect x="310" y="180" width="250" height="320" rx="12" fill="#ffffff" stroke="#e4e7ec"/>
    <rect x="326" y="196" width="218" height="150" rx="8" fill="#eef1f6"/>
    <rect x="326" y="362" width="150" height="12" rx="4" fill="#39414d"/>
    <rect x="326" y="384" width="100" height="10" rx="4" fill="#b6bdc9"/>
    <rect x="326" y="418" width="90" height="22" rx="6" fill="#b06a00"/>
  </g>
  <g>
    <rect x="580" y="180" width="250" height="320" rx="12" fill="#ffffff" stroke="#e4e7ec"/>
    <rect x="596" y="196" width="218" height="150" rx="8" fill="#eef1f6"/>
    <rect x="596" y="362" width="170" height="12" rx="4" fill="#39414d"/>
    <rect x="596" y="384" width="130" height="10" rx="4" fill="#b6bdc9"/>
    <rect x="596" y="418" width="76" height="22" rx="6" fill="#0a7f5a"/>
  </g>
</svg>`)}`;

const steps: AgentStep[] = [
  {
    id: 's1',
    index: 0,
    action: { type: 'navigate', url: 'https://www.amazon.in/s?k=wireless+headphones' },
    label: 'Navigate to amazon.in/s?k=wireless+headphones',
    status: 'success',
    result: 'Navigated to the search results page.',
    observation: '',
    reasoning: 'Start from the search results so I can compare live prices and ratings.',
    at: now - 1000 * 52,
  },
  {
    id: 's2',
    index: 1,
    action: { type: 'type', elementId: 'el_1', text: 'wireless headphones under 15000' },
    label: 'Type into “Search Amazon”',
    status: 'success',
    result: 'Typed 35 characters into “Search Amazon”.',
    observation: '',
    at: now - 1000 * 44,
  },
  {
    id: 's3',
    index: 2,
    action: { type: 'press_key', key: 'Enter' },
    label: 'Press Enter',
    status: 'success',
    result: 'Pressed Enter and submitted the containing form.',
    observation: '',
    reasoning: 'Refine the query with the price ceiling instead of paging through results.',
    at: now - 1000 * 39,
  },
  {
    id: 's4',
    index: 3,
    action: { type: 'scroll', direction: 'down', amount: 700 },
    label: 'Scroll down',
    status: 'success',
    result: 'Scrolled down to 700px of 8420px.',
    observation: '',
    at: now - 1000 * 27,
  },
  {
    id: 's5',
    index: 4,
    action: { type: 'screenshot' },
    label: 'Capture screenshot',
    status: 'success',
    result: 'Captured a screenshot of the visible tab.',
    observation: '',
    reasoning: 'Product tiles render on canvas; a screenshot lets me read the sponsor labels.',
    image: screenshot,
    at: now - 1000 * 18,
  },
  {
    id: 's6',
    index: 5,
    action: { type: 'click', elementId: 'el_7' },
    label: 'Click “Sony WH-CH720N”',
    status: 'success',
    result: 'Opened the Sony WH-CH720N product page.',
    observation: '',
    reasoning: 'Open the strongest match to verify ANC, battery life and seller.',
    at: now - 1000 * 8,
  },
];

history[0].steps = steps;
history[0].tokens = 51330;
history[2].steps = steps.slice(0, 4);
history[2].tokens = 18400;

const task: AgentTask = {
  id: 'task_demo',
  objective: 'Find the five best wireless headphones under ₹15,000. Compare specs, prices and ratings.',
  status: 'running',
  currentStep: steps.length,
  maxSteps: 25,
  createdAt: now - 1000 * 60 * 2,
  updatedAt: now - 1000 * 6,
};

function seedHome() {
  useAgentStore.setState({
    hydrated: true,
    route: 'home',
    providers: [provider],
    hasKey: { [provider.id]: true },
    settings: { ...useAgentStore.getState().settings, activeProviderId: provider.id },
    history,
  });
}

function seedWorkspace(extra: Record<string, unknown> = {}) {
  useAgentStore.setState({
    hydrated: true,
    route: 'task',
    providers: [provider],
    hasKey: { [provider.id]: true },
    settings: { ...useAgentStore.getState().settings, activeProviderId: provider.id },
    history,
    task,
    steps,
    usage: { inputTokens: 48210, outputTokens: 3120, costUsd: 0.19 },
    live: {
      url: 'https://www.amazon.in/Sony-WH-CH720N-Wireless-Headphones',
      title: 'Sony WH-CH720N Wireless Noise Cancelling Headphones',
    },
    currentAction: 'Comparing the Sony WH-CH720N against the JBL Tune 770NC',
    ...extra,
  });
}

if (demo === 'workspace') {
  seedWorkspace();
} else if (demo === 'approval') {
  seedWorkspace({
    task: { ...task, status: 'waiting_for_approval' },
    currentAction: null,
    approval: {
      id: 'a1',
      kind: 'sensitive',
      title: 'Buy Sony WH-CH720N',
      detail:
        'This checkout would place an order for ₹8,990 on Amazon.in using the saved address and payment method.',
      origin: 'https://www.amazon.in/checkout',
      actionLabel: 'Buy now',
      stepIndex: 6,
    },
  });
} else if (demo === 'done') {
  seedWorkspace({
    task: { ...task, status: 'completed' },
    currentAction: null,
    cacheTurns: [
      { turn: 0, hit: 0, miss: 5480, attempt: 0, prefix: 't#0' },
      { turn: 1, hit: 5480, miss: 3120, attempt: 0, prefix: 't#1' },
      { turn: 2, hit: 8600, miss: 3210, attempt: 0, prefix: 't#2' },
      { turn: 3, hit: 11810, miss: 2860, attempt: 0, prefix: 't#3' },
      { turn: 4, hit: 14670, miss: 2905, attempt: 0, prefix: 't#4' },
      { turn: 5, hit: 17575, miss: 2980, attempt: 0, prefix: 't#5' },
    ],
    summary:
      'Top five wireless headphones under ₹15,000:\n\n1. Sony WH-CH720N — ₹8,990, 4.3★, 35h battery, 192g\n2. JBL Tune 770NC — ₹6,999, 4.2★, 70h battery\n3. boAt Nirvana Ion — ₹1,499, 4.1★, 120h with case\n4. OnePlus Bullets Wireless Z2 — ₹1,799, 4.2★, 30h\n5. Noise Buds VS104 — ₹1,199, 4.0★, 45h\n\nSony leads on comfort and ANC; JBL wins on battery; boAt and Noise are the budget picks. Prices from Amazon.in today.',
  });
} else if (demo === 'firstrun') {
  useAgentStore.setState({
    hydrated: true,
    route: 'home',
    providers: [],
    hasKey: {},
    history: [],
  });
} else if (demo === 'nokey') {
  useAgentStore.setState({
    hydrated: true,
    route: 'home',
    providers: [provider],
    hasKey: {},
    history: [],
    settings: { ...useAgentStore.getState().settings, activeProviderId: provider.id },
  });
} else if (demo === 'empty') {
  seedHome();
  useAgentStore.setState({ history: [], checkpoint: null });
} else if (demo === 'done-markdown') {
  seedWorkspace({
    task: { ...task, status: 'completed', objective: 'what ids does Road Redemption have' },
    currentAction: null,
    summary:
      '**Road Redemption** has six DLC app IDs on SteamDB.\n\n| App ID | Name | Released |\n|---|---|---|\n| 1180010 | Revengers Assemble | 6 Feb 2020 |\n| 727440 | Developer Commentary | 3 Oct 2017 |\n| 727050 | Early Prototype | 3 Oct 2017 |\n\n- App IDs only: 1180010, 727440, 727050\n- The `524890` entry is the multiplayer alpha depot',
  });
} else if (demo === 'genui') {
  seedWorkspace({
    task: { ...task, status: 'completed', objective: 'Compare five wireless headphones under 15,000' },
    currentAction: null,
    summary: 'Sony leads on comfort and noise cancelling, JBL on battery. Prices from Amazon.in today.',
    summaryBlocks: [
      {
        type: 'table',
        title: 'Headphones under ₹15,000',
        columns: ['Model', 'Price', 'Rating', 'Battery'],
        rows: [
          ['Sony WH-CH720N', '₹8,990', '4.3', '35 h'],
          ['JBL Tune 770NC', '₹6,999', '4.2', '70 h'],
          ['boAt Nirvana Ion', '₹1,499', '4.1', '120 h'],
          ['OnePlus Bullets Z2', '₹1,799', '4.2', '30 h'],
          ['Noise Buds VS104', '₹1,199', '4.0', '45 h'],
        ],
      },
      {
        type: 'chart',
        title: 'Battery life',
        chart: 'bar',
        unit: ' h',
        data: [
          { label: 'Sony', value: 35 },
          { label: 'JBL', value: 70 },
          { label: 'boAt', value: 120 },
          { label: 'OnePlus', value: 30 },
          { label: 'Noise', value: 45 },
        ],
      },
      {
        type: 'stats',
        items: [
          { label: 'Cheapest', value: '₹1,199', hint: 'Noise Buds VS104' },
          { label: 'Longest battery', value: '120 h', hint: 'boAt Nirvana Ion' },
        ],
      },
    ],
  });
} else if (demo === 'genui-b') {
  seedWorkspace({
    task: { ...task, status: 'completed', objective: 'what ids does Road Redemption have' },
    currentAction: null,
    summary: 'Six DLC entries, three of them with their own store page.',
    summaryBlocks: [
      {
        type: 'chart',
        title: 'DLC releases by year',
        chart: 'line',
        data: [
          { label: '2017', value: 4 },
          { label: '2018', value: 1 },
          { label: '2020', value: 1 },
        ],
      },
      {
        type: 'chart',
        chart: 'donut',
        data: [
          { label: 'Own store page', value: 3 },
          { label: 'Depot only', value: 3 },
        ],
      },
      {
        type: 'links',
        items: [
          { label: 'Road Redemption — DLC list', url: 'https://steamdb.info/app/300380/dlc/' },
          { label: 'Steam store page', url: 'https://store.steampowered.com/app/300380/' },
        ],
      },
    ],
  });
} else if (demo === 'conversation') {
  seedWorkspace({
    task: {
      ...task,
      status: 'completed',
      objective: 'Give me all the DLC app ids for Road Redemption',
      turns: [
        { text: 'just the ids, nothing else', at: now - 1000 * 35 },
        { text: 'Which of those are actual store pages?', at: now - 1000 * 12 },
      ],
    },
    currentAction: null,
    summary: 'Three of the six have their own store page: 1180010, 727050 and 727440.',
  });
} else if (demo === 'limit') {
  seedWorkspace({
    task: {
      ...task,
      status: 'failed',
      currentStep: 20,
      maxSteps: 20,
      objective: 'does it clean pet hair effectively?',
    },
    currentAction: null,
    error: 'Reached the 20-step limit. Review what happened, then continue or stop.',
  });
} else if (demo === 'settings') {
  seedHome();
  useAgentStore.setState({ route: 'settings' });
} else if (demo === 'connect' || demo === 'connect-fail') {
  // Connection flow without a network: the provider list starts empty and the
  // connection test resolves locally so the success / failure states are stable.
  seedHome();
  const fail = demo === 'connect-fail';
  useAgentStore.setState({
    route: 'settings',
    providers: [],
    settings: { ...useAgentStore.getState().settings, activeProviderId: undefined },
    runTest: async (id: string) => {
      useAgentStore.setState({
        testStates: {
          ...useAgentStore.getState().testStates,
          [id]: fail
            ? { status: 'error', message: 'Invalid API key (401). Check the key and try again.' }
            : { status: 'ok', message: 'Connected' },
        },
      });
    },
  });
} else if (demo === 'light') {
  seedHome();
  useAgentStore.setState({
    settings: { ...useAgentStore.getState().settings, theme: 'light' },
  });
  document.documentElement.dataset.theme = 'light';
} else {
  seedHome();
}

document.documentElement.dataset.theme = useAgentStore.getState().settings.theme;

createRoot(document.getElementById('root')!).render(<App />);
}
