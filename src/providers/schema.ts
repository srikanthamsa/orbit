export const ACTION_TOOL_NAME = 'orbit_action';

const BATCH_STEP_SCHEMA = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['click', 'type', 'scroll'],
      description: 'The step to run. Batch steps share the current page state.',
    },
    elementId: { type: 'string', description: 'Element id from the latest snapshot. Required for click and type.' },
    text: { type: 'string', description: 'Text to type. Required for type.' },
    direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction. Required for scroll.' },
    amount: { type: 'number', description: 'Pixels to scroll. Optional, default 600.' },
  },
  required: ['type'],
} as const;

export const ACTION_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['navigate', 'search', 'click', 'click_at', 'type', 'scroll', 'press_key', 'screenshot', 'wait', 'find', 'batch', 'finish'],
      description: 'The next browser action to take. Use find to locate an accessible control, or batch to run 2–5 click/type/scroll steps.',
    },
    url: { type: 'string', description: 'Absolute http(s) URL. Required for navigate.' },
    elementId: { type: 'string', description: 'Element id from the latest snapshot, e.g. el_12. Required for click and type.' },
    x: { type: 'number', description: 'Horizontal position 0..1 relative to the viewport. Required for click_at.' },
    y: { type: 'number', description: 'Vertical position 0..1 relative to the viewport. Required for click_at.' },
    text: { type: 'string', description: 'Text to type. Required for type.' },
    direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction. Required for scroll.' },
    amount: { type: 'number', description: 'Pixels to scroll. Optional, default 600.' },
    key: { type: 'string', description: 'Key to press, e.g. Enter, Tab, Escape. Required for press_key.' },
    duration: { type: 'number', description: 'Milliseconds to wait. Required for wait.' },
    query: { type: 'string', description: 'For find: a label, text or role fragment. For search: the web query, short and specific.' },
    role: { type: 'string', description: 'Optional ARIA role filter for find, e.g. button, link, textbox.' },
    limit: { type: 'number', description: 'Maximum find matches, 1–20. Optional, default 8.' },
    actions: {
      type: 'array',
      description: 'For batch: 2–5 sequential click/type/scroll steps using ids from this snapshot.',
      items: BATCH_STEP_SCHEMA,
      minItems: 1,
      maxItems: 5,
    },
    summary: { type: 'string', description: 'The user\'s answer, written as a chat assistant would: plain prose, answer first, one to three sentences, no markdown, no tables, no bold. Required for finish.' },
    ui: {
      type: 'array',
      maxItems: 3,
      description:
        'Optional visual blocks for the answer. Use a table when comparing three or more items, a chart when numbers trend over time or split into parts, stats for one or two headline figures, links for a short list of destinations. Omit when the answer is one value or a sentence.',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['table', 'chart', 'stats', 'links'] },
          title: { type: 'string', description: 'Short label above the block. Optional.' },
          columns: {
            type: 'array',
            items: { type: 'string' },
            description: 'table only: column headings, first column is the row label.',
          },
          rows: {
            type: 'array',
            items: { type: 'array', items: { type: 'string' } },
            description: 'table only: one array of cell strings per row, same length as columns.',
          },
          chart: { type: 'string', enum: ['bar', 'line', 'donut'], description: 'chart only.' },
          unit: { type: 'string', description: 'chart only: short suffix such as "₹" or "%".' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: { type: 'number' },
              },
              required: ['label', 'value'],
            },
            description: 'chart only: 2–12 label/value pairs.',
          },
          items: {
            type: 'array',
            description:
              'stats: {@label, value, hint?}; links: {@label, url}.',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: { type: 'string' },
                hint: { type: 'string' },
                url: { type: 'string' },
              },
              required: ['label'],
            },
          },
        },
        required: ['type'],
      },
    },
    reasoning: { type: 'string', description: 'One short sentence explaining why this action is the right next step.' },
  },
  required: ['type', 'reasoning'],
} as const;

export const ACTION_TOOL_DESCRIPTION = [
  'Perform exactly one browser action in the user’s active tab. The action may be a single step, a find search, or a batch of compatible steps.',
  'Use search to look the answer up on the web when the current page cannot answer it.',
  'Use element ids only from the latest snapshot. Never invent ids or CSS selectors.',
  'Batch only actions that share the current page state; a batch stops at the first failure.',
  'Call finish when the objective is complete or blocked and you have the answer for the user.',
  'Attach ui blocks only when a table, chart, stats row or link list shows the answer better than prose.',
].join(' ');

export function stripEmpty(action: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(action)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}
