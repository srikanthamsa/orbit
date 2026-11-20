import { z } from 'zod';

/**
 * Optional visual blocks the model can attach to a finish call. They are
 * deliberately flat (arrays of strings and numbers) so every provider's tool
 * schema subset can express them.
 */
export const AnswerBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('table'),
    title: z.string().max(80).optional(),
    columns: z.array(z.string().min(1).max(40)).min(1).max(6),
    rows: z
      .array(z.array(z.string().max(120)).min(1).max(6))
      .min(1)
      .max(30),
  }),
  z.object({
    type: z.literal('chart'),
    title: z.string().max(80).optional(),
    chart: z.enum(['bar', 'line', 'donut']),
    unit: z.string().max(12).optional(),
    data: z
      .array(z.object({ label: z.string().min(1).max(40), value: z.number() }))
      .min(2)
      .max(12),
  }),
  z.object({
    type: z.literal('stats'),
    title: z.string().max(80).optional(),
    items: z
      .array(
        z.object({
          label: z.string().min(1).max(40),
          value: z.string().min(1).max(24),
          hint: z.string().max(40).optional(),
        }),
      )
      .min(1)
      .max(4),
  }),
  z.object({
    type: z.literal('links'),
    title: z.string().max(80).optional(),
    items: z
      .array(z.object({ label: z.string().min(1).max(60), url: z.string().url() }))
      .min(1)
      .max(8),
  }),
]);

export type AnswerBlock = z.infer<typeof AnswerBlockSchema>;
export type AnswerBlockType = AnswerBlock['type'];

export const BatchStepSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), elementId: z.string().min(1) }),
  z.object({ type: z.literal('type'), elementId: z.string().min(1), text: z.string() }),
  z.object({
    type: z.literal('scroll'),
    direction: z.enum(['up', 'down']),
    amount: z.number().int().positive().max(5000).optional(),
  }),
]);

export const BrowserActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('navigate'), url: z.string().url() }),
  z.object({ type: z.literal('click'), elementId: z.string().min(1) }),
  z.object({
    type: z.literal('search'),
    query: z.string().min(1).max(200),
  }),
  z.object({
    type: z.literal('click_at'),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }),
  z.object({ type: z.literal('type'), elementId: z.string().min(1), text: z.string() }),
  z.object({
    type: z.literal('scroll'),
    direction: z.enum(['up', 'down']),
    amount: z.number().int().positive().max(5000).optional(),
  }),
  z.object({ type: z.literal('press_key'), key: z.string().min(1).max(32) }),
  z.object({ type: z.literal('screenshot') }),
  z.object({ type: z.literal('wait'), duration: z.number().int().min(100).max(15000) }),
  z.object({
    type: z.literal('find'),
    query: z.string().min(1).max(160),
    role: z.string().max(40).optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  z.object({
    type: z.literal('batch'),
    actions: z.array(BatchStepSchema).min(1).max(5),
  }),
  z.object({
    type: z.literal('finish'),
    summary: z.string().min(1),
    // A malformed visual block must never invalidate a correct answer: each
    // block is validated on its own and silently dropped when it does not fit.
    ui: z
      .array(z.unknown())
      .max(3)
      .optional()
      .transform((raw) => {
        const blocks = (raw ?? [])
          .map((item) => AnswerBlockSchema.safeParse(item))
          .flatMap((result) => (result.success ? [result.data] : []));
        return blocks.length > 0 ? blocks : undefined;
      }),
  }),
]);

/** DuckDuckGo's no-JavaScript endpoint: a plain result list the agent can read. */

export type BrowserAction = z.infer<typeof BrowserActionSchema>;
export type BatchStep = z.infer<typeof BatchStepSchema>;
export type ActionType = BrowserAction['type'];

export function parseAction(raw: unknown): BrowserAction {
  return BrowserActionSchema.parse(raw);
}

export function describeAction(action: BrowserAction, elementLabel?: string): string {
  switch (action.type) {
    case 'navigate':
      return `Navigate to ${action.url}`;
    case 'search':
      return `Search the web for “${action.query}”`;
    case 'click':
      return elementLabel ? `Click “${elementLabel}”` : `Click ${action.elementId}`;
    case 'click_at':
      return `Click at ${(action.x * 100).toFixed(0)}%, ${(action.y * 100).toFixed(0)}% of the viewport`;
    case 'type':
      return elementLabel
        ? `Type into “${elementLabel}”`
        : `Type into ${action.elementId}`;
    case 'scroll':
      return `Scroll ${action.direction}`;
    case 'press_key':
      return `Press ${action.key}`;
    case 'screenshot':
      return 'Capture screenshot';
    case 'wait':
      return `Wait ${(action.duration / 1000).toFixed(1)}s`;
    case 'find':
      return `Find “${action.query}”`;
    case 'batch':
      return `Run ${action.actions.length} actions (${action.actions.map((step) => step.type).join(' → ')})`;
    case 'finish':
      return 'Finish task';
  }
}
