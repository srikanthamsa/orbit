import { describe, expect, it } from 'vitest';
import { analyseQuestion, checkAnswer } from '@/providers/answerCheck';

const QUESTION = 'was he a main eventer or a mid card talent in his days?';

const BIOGRAPHY =
  'That is "Hacksaw" Jim Duggan, the American retired pro wrestler (born January 14, 1954), best known for his WWF/WWE run with the 2x4 and his HOOOOO! catchphrase. He won the very first Royal Rumble in 1988 and was inducted into the WWE Hall of Fame in 2011, and here he is appearing as a legend in the SmackDown Team USA segment with CM Punk.';

const VERDICT =
  'Jim Duggan was primarily a mid-card wrestler, though a recognisable upper-mid-card name. His 1988 Royal Rumble win was a signature moment, but he was never a consistent world-title main-eventer.';

describe('question shape', () => {
  it('reads a classification as a choice between two options', () => {
    const shape = analyseQuestion(QUESTION);
    expect(shape.kind).toBe('classification');
    expect(shape.options).toHaveLength(2);
  });

  it('reads a versus question as a comparison', () => {
    const shape = analyseQuestion('which is better, the Sony WH-CH720N or the JBL Tune 770NC?');
    expect(shape.kind).toBe('classification');
    expect(analyseQuestion('Sony WH-CH720N vs JBL Tune 770NC?').kind).toBe('comparison');
  });

  it('leaves open questions alone', () => {
    expect(analyseQuestion('who is Jim Duggan?').kind).toBe('open');
    expect(analyseQuestion('find the cheapest headphones').kind).toBe('open');
    expect(analyseQuestion('does it come with a case or not?').kind).toBe('open');
  });
});

describe('answer check', () => {
  it('rejects a biography that never answers the question', () => {
    const result = checkAnswer(QUESTION, BIOGRAPHY);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('verdict');
  });

  it('accepts a verdict in the opening sentence', () => {
    expect(checkAnswer(QUESTION, VERDICT).ok).toBe(true);
  });

  it('rejects a verdict that only names the option halfway down', () => {
    const late = `He is a well known name from the 1980s with a long career in the WWF. ${VERDICT}`;
    expect(checkAnswer(QUESTION, late).ok).toBe(false);
  });

  it('does not judge open questions', () => {
    expect(checkAnswer('who is Jim Duggan?', BIOGRAPHY).ok).toBe(true);
  });

  it('requires a comparison to cover both sides', () => {
    const question = 'Sony WH-CH720N vs JBL Tune 770NC?';
    expect(checkAnswer(question, 'The Sony is the better buy for comfort.').ok).toBe(false);
    expect(checkAnswer(question, 'The Sony is better for comfort, the JBL for battery.').ok).toBe(true);
  });
});
