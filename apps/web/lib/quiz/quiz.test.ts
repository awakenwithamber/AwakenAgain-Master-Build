import { describe, expect, it } from 'vitest';
import {
  EvidenceContext,
  NO_QUIZ_SCREENING,
  QUIZ_CONCERNS,
  QUIZ_FORMS,
  QUIZ_SAFETY_BANNER,
  getConcern,
  getForm,
  getQuizResult,
  hasScreeningFlag,
  isValidConcernId,
  isValidFormId,
  normalizeQuizScreening,
  toQuizResultSnapshot,
  type QuizScreening,
} from './quiz';
import { FDA_STATEMENT } from '../safety/product-safety';

const PREGNANT: QuizScreening = {
  pregnantOrNursing: true,
  takingMedication: false,
  managingCondition: false,
};
const MEDICATION: QuizScreening = {
  pregnantOrNursing: false,
  takingMedication: true,
  managingCondition: false,
};
const CONDITION: QuizScreening = {
  pregnantOrNursing: false,
  takingMedication: false,
  managingCondition: true,
};

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

  it('snapshot carries the FULL result and survives a JSON round-trip (audit BROKEN-1)', () => {
    const result = getQuizResult('sleep', 'tea')!;
    const snapshot = toQuizResultSnapshot(result);
    expect(snapshot.concernId).toBe('sleep');
    expect(snapshot.formId).toBe('tea');
    expect(snapshot.allies).toEqual(result.allies);
    expect(snapshot.allies.length).toBeGreaterThan(0);
    expect(snapshot.productHandles).toEqual(result.productHandles);
    expect(snapshot.productReason).toBe(result.productReason);
    // Stored on the lead record (JSONL line / event payload) — must be
    // plain JSON data, no class instances or functions.
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

describe('safety screening (Stage 4, R-14/R-15)', () => {
  it('no flags → results identical to the pre-Stage-4 flow', () => {
    for (const concern of QUIZ_CONCERNS) {
      for (const form of QUIZ_FORMS) {
        const legacy = getQuizResult(concern.id, form.id)!;
        const explicit = getQuizResult(concern.id, form.id, NO_QUIZ_SCREENING)!;
        expect(explicit.productHandles).toEqual(legacy.productHandles);
        expect(explicit.allies).toEqual(legacy.allies);
        expect(explicit.productReason).toEqual(legacy.productReason);
        expect(explicit.withheld).toEqual([]);
        expect(explicit.hasSafetyFlags).toBe(false);
        expect(explicit.screening).toEqual(NO_QUIZ_SCREENING);
      }
    }
  });

  it('pregnancy/nursing flag withholds ingestible recommendations, keeps non-ingestibles', () => {
    // sleep + balm form: the balm (topical) may still show; the capsule
    // pick is not in this form's list, but the always-along tea blend is
    // ingestible and must be withheld.
    const result = getQuizResult('sleep', 'balm', PREGNANT)!;
    expect(result.productHandles).toContain('soothe-restore-botanical-balm');
    expect(result.productHandles).not.toContain('alchemy-tea-blend');
    expect(result.withheld).toContainEqual({
      handle: 'alchemy-tea-blend',
      reason: 'pregnancy-ingestible',
    });
    // The consultation service is not ingestible and still shows.
    expect(result.productHandles).toContain('custom-remedy-consultation');
    expect(result.hasSafetyFlags).toBe(true);
  });

  it('pregnancy/nursing flag withholds a capsule-form primary recommendation', () => {
    const result = getQuizResult('sleep', 'capsule', PREGNANT)!;
    expect(result.productHandles).not.toContain('dreamease-capsules');
    expect(result.withheld).toContainEqual({
      handle: 'dreamease-capsules',
      reason: 'pregnancy-ingestible',
    });
  });

  it('medication flag withholds SKUs whose own record safety text mentions medication', () => {
    // seasonal-gut-reset warnings: "May interact with medications…"
    const result = getQuizResult('digestive', 'capsule', MEDICATION)!;
    expect(result.productHandles).not.toContain('seasonal-gut-reset');
    expect(result.withheld).toContainEqual({
      handle: 'seasonal-gut-reset',
      reason: 'medication-interaction',
    });
    expect(result.hasSafetyFlags).toBe(true);
  });

  it('medication flag withholds the tea blend (its record warnings mention medication)', () => {
    const result = getQuizResult('sleep', 'balm', MEDICATION)!;
    expect(result.withheld.map((w) => w.handle)).toContain('alchemy-tea-blend');
    // The balm's own warnings do not mention medication — it stays.
    expect(result.productHandles).toContain('soothe-restore-botanical-balm');
  });

  it('any flag → the clinician/pharmacist banner copy is the shared constant', () => {
    for (const screening of [PREGNANT, MEDICATION, CONDITION]) {
      const result = getQuizResult('energy', 'tea', screening)!;
      expect(hasScreeningFlag(result.screening)).toBe(true);
      expect(result.hasSafetyFlags).toBe(true);
    }
    expect(QUIZ_SAFETY_BANNER).toContain('educational suggestions');
    expect(QUIZ_SAFETY_BANNER).toContain('clinician or pharmacist');
    // The quiz results surface carries the FDA sentence (R-07 via R-15).
    expect(FDA_STATEMENT).toContain(
      'not been evaluated by the Food and Drug Administration',
    );
  });

  it('managing-condition flag alone withholds nothing but still flags the banner', () => {
    const unflagged = getQuizResult('immune', 'capsule')!;
    const flagged = getQuizResult('immune', 'capsule', CONDITION)!;
    expect(flagged.productHandles).toEqual(unflagged.productHandles);
    expect(flagged.withheld).toEqual([]);
    expect(flagged.hasSafetyFlags).toBe(true);
  });

  it('screening answers persist on the result snapshot (JSON round-trip)', () => {
    const result = getQuizResult('digestive', 'capsule', {
      pregnantOrNursing: true,
      takingMedication: true,
      managingCondition: false,
    })!;
    const snapshot = toQuizResultSnapshot(result);
    expect(snapshot.screening).toEqual({
      pregnantOrNursing: true,
      takingMedication: true,
      managingCondition: false,
    });
    expect(snapshot.withheld).toEqual(result.withheld);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('normalizeQuizScreening counts only literal true as yes', () => {
    expect(normalizeQuizScreening(undefined)).toEqual(NO_QUIZ_SCREENING);
    expect(normalizeQuizScreening(null)).toEqual(NO_QUIZ_SCREENING);
    expect(
      normalizeQuizScreening({
        pregnantOrNursing: true,
        takingMedication: 'yes',
        managingCondition: 1,
      }),
    ).toEqual({
      pregnantOrNursing: true,
      takingMedication: false,
      managingCondition: false,
    });
  });
});

describe('quiz surface reframing (Stage 4, R-15) — source level', () => {
  it('the /quiz page and island carry no "Find My Remedy" / "best suited to your body" / "personalized match" language', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, resolve } = await import('node:path');
    const root = resolve(__dirname, '..', '..');
    const page = readFileSync(join(root, 'app/quiz/page.tsx'), 'utf8');
    const island = readFileSync(join(root, 'components/quiz/Quiz.tsx'), 'utf8');
    for (const src of [page, island]) {
      expect(src).not.toContain('Find My Remedy');
      expect(src).not.toContain('best suited to your body');
      expect(src).not.toContain('personalized match');
      expect(src).not.toContain('personalized herbal match');
    }
    expect(page).toContain('Explore Herbal Allies by Focus Area');
    expect(island).toContain('traditionally used to support');
    expect(island).toContain('QUIZ_SAFETY_BANNER');
    expect(island).toContain('FDA_STATEMENT');
    // The screening step exists between form and results.
    expect(island).toContain("setPhase('screening')");
    expect(island).toContain('QUIZ_SCREENING_QUESTIONS');
  });
});
