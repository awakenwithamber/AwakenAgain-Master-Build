import { describe, expect, it } from 'vitest';
import {
  EvidenceContext,
  QUIZ_CONCERNS,
  QUIZ_FORMS,
  getConcern,
  getForm,
  getQuizResult,
  isValidConcernId,
  isValidFormId,
} from './quiz';

const BANNED = [
  /\bproven\b/i,
  /\bcures?\b/i,
  /\bheals?\b/i,
  /\btreats\b/i,
  /\btreatment\b/i,
  /\bdiagnos(e|is|ing)\b/i,
  /\bprevents?\b/i,
  /\btincture/i,
];

describe('quiz structure', () => {
  it('carries the legacy 8-concern × 5-form matrix', () => {
    expect(QUIZ_CONCERNS).toHaveLength(8);
    expect(QUIZ_FORMS).toHaveLength(5);
    expect(QUIZ_CONCERNS.map((c) => c.id)).toContain('sleep');
    expect(QUIZ_FORMS.map((f) => f.id)).toContain('oil-infusion');
  });

  it('never uses the word "tincture" for the liquid form', () => {
    expect(QUIZ_FORMS.find((f) => f.id === 'oil-infusion')?.label).toBe(
      'Botanical Oil Infusion',
    );
  });

  it('validators accept only known ids', () => {
    expect(isValidConcernId('sleep')).toBe(true);
    expect(isValidConcernId('zzz')).toBe(false);
    expect(isValidConcernId(undefined)).toBe(false);
    expect(isValidFormId('tea')).toBe(true);
    expect(isValidFormId('serum')).toBe(false);
  });
});

describe('recommendation engine', () => {
  it('returns allies + product handles for every concern × form pair', () => {
    for (const concern of QUIZ_CONCERNS) {
      for (const form of QUIZ_FORMS) {
        const result = getQuizResult(concern.id, form.id);
        expect(result, `${concern.id}/${form.id}`).not.toBeNull();
        expect(result!.allies.length).toBeGreaterThan(0);
        expect(result!.productHandles.length).toBeGreaterThan(0);
        expect(result!.concern.id).toBe(concern.id);
        expect(result!.form.id).toBe(form.id);
      }
    }
  });

  it('returns null for invalid inputs', () => {
    expect(getQuizResult('nope', 'tea')).toBeNull();
    expect(getQuizResult('sleep', 'nope')).toBeNull();
  });
});

describe('compliance', () => {
  it('no ally note makes cure/treatment claims or says "proven"/"tincture"', () => {
    const allNotes: string[] = [];
    for (const concern of QUIZ_CONCERNS) {
      const result = getQuizResult(concern.id, 'any');
      result!.allies.forEach((a) => allNotes.push(`${a.name}: ${a.note}`));
    }
    for (const note of allNotes) {
      for (const pattern of BANNED) {
        expect(note, `banned pattern ${pattern} in: ${note}`).not.toMatch(
          pattern,
        );
      }
    }
  });

  it('every ally carries an evidence context (never bare "proven")', () => {
    const valid: EvidenceContext[] = ['traditional', 'lab', 'human'];
    for (const concern of QUIZ_CONCERNS) {
      const result = getQuizResult(concern.id, 'any');
      for (const ally of result!.allies) {
        expect(valid).toContain(ally.evidence);
        expect(ally.latin).toBeTruthy();
      }
    }
  });

  it('getConcern/getForm resolve by id', () => {
    expect(getConcern('sleep')?.label).toBe('Sleep & Rest');
    expect(getForm('tea')?.label).toBe('Herbal Tea');
    expect(getConcern('nope')).toBeUndefined();
  });
});
