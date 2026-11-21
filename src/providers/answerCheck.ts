/**
 * Local answer-shape checks.
 *
 * A model that is handed a biography will summarise the biography, even when
 * the question asked for a verdict. Nothing here calls an API: it reads the
 * question, reads the answer the model is about to finish with, and says
 * whether the answer actually addresses what was asked. The orchestrator turns
 * a rejection into one correction turn, so a bad answer costs one retry rather
 * than a wrong result.
 */

export type QuestionKind = 'classification' | 'comparison' | 'open';

export interface QuestionShape {
  kind: QuestionKind;
  /** The options a classification question offers, key terms only. */
  options: string[][];
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'their', 'they', 'them',
  'was', 'were', 'are', 'is', 'been', 'being', 'his', 'her', 'its', 'our', 'you', 'not',
  'days', 'day', 'time', 'times', 'ever', 'really', 'actually', 'kind', 'sort', 'more',
  'most', 'less', 'least', 'than', 'then', 'also', 'just', 'only', 'very', 'much',
  'one', 'two', 'get', 'got', 'make', 'made', 'good', 'best', 'better', 'worse',
]);

const QUESTION_WORDS =
  /^(is|are|was|were|does|do|did|can|could|should|would|will|has|have|had|am|may|might|which|who|whom|whose|what|when|where|why|how)\b/i;

/** Words that carry the distinction between two offered options. */
function terms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function stripLead(value: string): string {
  return value
    .replace(/^(?:is|was|were|are|does|did|do|should|would|can|could|will|has|have|had)\s+/i, '')
    .replace(/^(?:he|she|it|they|this|that|the\s+\w+)\s+/i, '')
    .replace(/^(?:a|an|the)\s+/i, '')
    .replace(/[?.!]+$/, '')
    .trim();
}

/**
 * Only two shapes are enforced, because only those have a checkable contract:
 * a classification must name one of its options, a comparison must touch both
 * sides. Everything else is left to the prompt.
 */
export function analyseQuestion(question: string): QuestionShape {
  const text = question.replace(/\s+/g, ' ').trim();
  if (!text) return { kind: 'open', options: [] };

  const clean = text.replace(/[?.!]+$/, '');

  // "A vs B" is a comparison however the sentence opens.
  const versus = /\b(.{2,48}?)\s+(?:vs\.?|versus)\s+(.{2,48})$/i.exec(clean);
  if (versus) {
    const left = terms(stripLead(versus[1]));
    const right = terms(stripLead(versus[2]));
    if (left.length && right.length) return { kind: 'comparison', options: [left, right] };
  }

  if (!QUESTION_WORDS.test(text)) return { kind: 'open', options: [] };

  const orParts = clean.split(/\s+or\s+/i);
  if (orParts.length === 2) {
    const left = terms(stripLead(orParts[0]));
    // "or not" and short tails are not a choice between two things.
    if (!/\bnot\b/i.test(orParts[1])) {
      const right = terms(stripLead(orParts[1]).split(/\s+(?:in|at|during|for|on|back)\s+/i)[0]);
      if (left.length && right.length) return { kind: 'classification', options: [left, right] };
    }
  }

  return { kind: 'open', options: [] };
}

const sentence = (text: string): string => {
  const match = /^[\s\S]*?[.!?](?=\s|$)/.exec(text.trim());
  return (match?.[0] ?? text).toLowerCase();
};

const mentions = (haystack: string, terms: string[]): boolean =>
  terms.some((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(haystack));

export interface AnswerCheck {
  ok: boolean;
  reason?: string;
}

/**
 * The answer has to open with the verdict. For a classification that means one
 * of the offered options in the first sentence; for a comparison, both sides
 * somewhere in the answer and at least one in the opening.
 */
export function checkAnswer(question: string, answer: string): AnswerCheck {
  const shape = analyseQuestion(question);
  if (shape.kind === 'open') return { ok: true };
  const opening = sentence(answer);
  const whole = answer.toLowerCase();

  if (shape.kind === 'classification') {
    const named = shape.options.some((option) => mentions(opening, option));
    if (named) return { ok: true };
    const anywhere = shape.options.find((option) => mentions(whole, option));
    return {
      ok: false,
      reason: anywhere
        ? `It asks for a verdict between "${shape.options[0].join(' ')}" and "${shape.options[1].join(' ')}", and the answer only mentions that later. Open with the verdict.`
        : `It asks for a verdict between "${shape.options[0].join(' ')}" and "${shape.options[1].join(' ')}", and the answer never picks one.`,
    };
  }

  const [left, right] = shape.options;
  const coversLeft = mentions(whole, left);
  const coversRight = mentions(whole, right);
  const opensWithOne = mentions(opening, left) || mentions(opening, right);
  if (coversLeft && coversRight && opensWithOne) return { ok: true };
  return {
    ok: false,
    reason: 'It asks you to compare two things. Open with which one wins and cover both.',
  };
}
