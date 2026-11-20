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
      enum: ['navigate', 'click', 'click_at', 'type', 'scroll', 'press_key', 'screenshot', 'wait', 'find', 'batch', 'finish'],
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
    query: { type: 'string', description: 'Label, text or role fragment to search for. Required for find.' },
    role: { type: 'string', description: 'Optional ARIA role filter for find, e.g. button, link, textbox.' },
    limit: { type: 'number', description: 'Maximum find matches, 1–20. Optional, default 8.' },
    actions: {
      type: 'array',
      description: 'For batch: 2–5 sequential click/type/scroll steps using ids from this snapshot.',
      items: BATCH_STEP_SCHEMA,
      minItems: 1,
      maxItems: 5,
    },
    summary: { type: 'string', description: 'Final answer or summary for the user. Required for finish.' },
    reasoning: { type: 'string', description: 'One short sentence explaining why this action is the right next step.' },
  },
  required: ['type', 'reasoning'],
} as const;

export const ACTION_TOOL_DESCRIPTION = [
  'Perform exactly one browser action in the user’s active tab. The action may be a single step, a find search, or a batch of compatible steps.',
  'Use element ids only from the latest snapshot. Never invent ids or CSS selectors.',
  'Batch only actions that share the current page state; a batch stops at the first failure.',
  'Call finish when the objective is complete or blocked and you have the answer for the user.',
].join(' ');

export function stripEmpty(action: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(action)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}
