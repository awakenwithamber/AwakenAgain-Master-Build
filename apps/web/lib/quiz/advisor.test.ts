/**
 * Restored Guided Wellness Quiz engine — locks the port (2026-10-22).
 *
 * Pins: the legacy synthesis behavior (patterns, signals, ally cap),
 * catalog resolution of every legacy recommendation id, the safety
 * screening applied to product suggestions, the lead-validation
 * normalization, and the compliance law over the restored copy (the
 * banned word never appears; Amber's "why these allies" narrative is
 * framed as her perspective, not medical causation).
 *
 * Results First revision (owner decision 2026-11-08) — CHANGED PINS:
 * the ally cap is now 8 with a floor of 5 (was a flat cap of 6), the
 * engine honors each pattern's minMatches gate, and the four goals
 * that used to hit the generic fallback (beauty, hormones, cognitive,
 * wellness) now route to their own patterns. The two tests that
 * asserted the old behavior were rewritten in place; everything else
 * about the legacy synthesis is pinned as before.
 */
import { describe, expect, it } from 'vitest';
import {
  ADVISOR_ALLY_CAP,
  ADVISOR_ALLY_FLOOR,
  ADVISOR_GOALS,
  ADVISOR_HERB_RECOMMENDATIONS,
  ADVISOR_PATTERNS,
  ADVISOR_WHY_ALLIES_PARAGRAPHS,
  advisorLegacyIds,
  computeAdvisorSynthesis,
  gatherAdvisorSignals,
  gatherAllies,
  groupByDimension,
  normalizeAdvisorAnswers,
  synthesizePatterns,
  toAdvisorResultSnapshot,
  type AdvisorAnswers,
} from './advisor';
import { NO_QUIZ_SCREENING, type QuizScreening } from './quiz';
import { getHerb } from '../catalog/herbs';

const BASE: AdvisorAnswers = {
  symptoms: ['sleep', 'stress'],
  intensity: 'significant',
  frequency: 'daily',
  duration: 'months',
  sleep: 'broken',
  stressLevel: 'stretched',
  digestion: 'smooth',
  emotional: 'overwhelmed',
  triggers: ['work-pressure', 'screens-late'],
  timeOfDay: ['evening'],
  sensitivity: 'balanced',
  preferredFormat: 'no-preference',
};

describe('legacy synthesis behavior', () => {
  it('finds nervous-system overwhelm for racing, sleepless stress', () => {
    const signals = gatherAdvisorSignals(BASE);
    expect(signals).toContain('racing-mind');
    expect(signals).toContain('light-sleep');
    expect(signals).toContain('duration-long');
    const scored = synthesizePatterns(BASE.symptoms, signals);
    expect(scored[0].pattern.id).toBe('nervous-overwhelm');
    expect(scored.length).toBeLessThanOrEqual(2);
  });

  it('falls back to the legacy default when nothing scores', () => {
    // A lone energy goal matches Stress Depletion's symptom list once,
    // below its own minMatches of 2 — the legacy fallback still lands
    // the run on Stress Depletion, exactly as the original did.
    const scored = synthesizePatterns(['energy'], []);
    expect(scored).toHaveLength(1);
    expect(scored[0].pattern.id).toBe('stress-depletion');
    const scoredSleep = synthesizePatterns(['sleep'], []);
    expect(scoredSleep[0].pattern.id).toBe('nervous-overwhelm');
  });

  it('gathers the floor of five allies, deduped, each with a why-line', () => {
    const s = computeAdvisorSynthesis(BASE, NO_QUIZ_SCREENING);
    // Results First (2026-11-08): at least five botanicals, always.
    // BASE matches Nervous System Overwhelm alone at pattern level
    // (Stress Depletion's second symptom match is absent), so the run
    // is exactly the primary pattern's five.
    expect(s.allies.length).toBe(5);
    expect(new Set(s.allies.map((a) => a.id)).size).toBe(s.allies.length);
    for (const ally of s.allies) {
      expect(ally.name.length).toBeGreaterThan(0);
      expect(ally.whyLine).toContain('Chosen');
      expect(ally.primaryBenefit.length).toBeGreaterThan(0);
    }
    expect(s.patterns[0].pattern.id).toBe('nervous-overwhelm');
    // Preferred form falls to the primary pattern's form (tea).
    expect(s.formKey).toBe('loose-tea');
  });

  it('honors an explicit format preference and maps legacy ids', () => {
    const s = computeAdvisorSynthesis(
      { ...BASE, preferredFormat: 'capsule' },
      NO_QUIZ_SCREENING,
    );
    expect(s.formKey).toBe('capsule');
    const legacy = advisorLegacyIds(s);
    expect(legacy.concernId).toBe('sleep');
    expect(legacy.formId).toBe('capsule');
  });

  it('produces the ritual set for the matched patterns (cap 3)', () => {
    const s = computeAdvisorSynthesis(BASE, NO_QUIZ_SCREENING);
    expect(s.rituals.length).toBe(3);
  });
});

describe('catalog resolution', () => {
  it('legacy recommendation ids resolve, except the two known legacy-only ids', () => {
    // magnolia + kava appear in the legacy per-goal pool but have no
    // record in the current 306-herb catalog; the pool is kept verbatim
    // as legacy data and never rendered directly. Everything else —
    // including every ally the patterns can surface — must resolve.
    const KNOWN_LEGACY_ONLY = new Set(['magnolia', 'kava']);
    const missing: string[] = [];
    for (const ids of Object.values(ADVISOR_HERB_RECOMMENDATIONS)) {
      for (const id of ids) {
        const alias =
          { 'devil-claw': 'devils-claw', 'lion-mane': 'lions-mane', bacopa: 'brahmi', 'rose-hip': 'rosehip' }[id] ?? id;
        if (!getHerb(alias) && !KNOWN_LEGACY_ONLY.has(id)) missing.push(id);
      }
    }
    expect(missing).toEqual([]);
    expect(ADVISOR_GOALS).toHaveLength(10);
    for (const pattern of Object.values(ADVISOR_PATTERNS)) {
      for (const ally of pattern.allies) {
        const alias =
          { 'devil-claw': 'devils-claw', 'lion-mane': 'lions-mane', bacopa: 'brahmi', 'rose-hip': 'rosehip' }[ally.id] ?? ally.id;
        expect(getHerb(alias), `pattern ally ${ally.id}`).toBeTruthy();
      }
    }
  });

  it('every pattern ally resolves with catalog detail', () => {
    for (const pattern of Object.values(ADVISOR_PATTERNS)) {
      for (const ally of pattern.allies) {
        expect(ally.benefit.length).toBeGreaterThan(0);
        expect(ally.whySource.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('safety screening on advisor product suggestions', () => {
  const pregnancy: QuizScreening = {
    pregnantOrNursing: true,
    takingMedication: false,
    managingCondition: false,
  };

  it('withholds ingestible products under the pregnancy flag', () => {
    const open = computeAdvisorSynthesis(BASE, NO_QUIZ_SCREENING);
    expect(open.productHandles).toContain('dreamease-capsules');
    const screened = computeAdvisorSynthesis(BASE, pregnancy);
    expect(screened.productHandles).not.toContain('dreamease-capsules');
    expect(screened.withheld.map((w) => w.handle)).toContain('dreamease-capsules');
    expect(
      screened.withheld.every((w) => w.reason === 'pregnancy-ingestible'),
    ).toBe(true);
  });

  it('snapshot round-trips through JSON with the advisor block intact', () => {
    const snap = toAdvisorResultSnapshot(computeAdvisorSynthesis(BASE, NO_QUIZ_SCREENING));
    const round = JSON.parse(JSON.stringify(snap));
    expect(round.primaryPattern).toBe('Nervous System Overwhelm');
    expect(round.allies.length).toBe(snap.allies.length);
    expect(round.answers.symptoms).toEqual(['sleep', 'stress']);
  });
});

describe('normalization of untrusted answers', () => {
  it('drops unknown ids and caps symptoms at five', () => {
    const n = normalizeAdvisorAnswers({
      symptoms: ['sleep', 'bogus', 'energy', 'stress', 'immune', 'pain', 'beauty'],
      intensity: 'loud',
      triggers: ['work-pressure', 'nope'],
    });
    expect(n).not.toBeNull();
    expect(n!.symptoms).toEqual(['sleep', 'energy', 'stress', 'immune', 'pain']);
    expect(n!.intensity).toBeNull();
    expect(n!.triggers).toEqual(['work-pressure']);
  });

  it('rejects non-objects', () => {
    expect(normalizeAdvisorAnswers('nope')).toBeNull();
    expect(normalizeAdvisorAnswers(null)).toBeNull();
  });
});

describe('compliance law over the restored copy', () => {
  it("Amber's narrative is perspective-framed, never disease-causation", () => {
    const joined = ADVISOR_WHY_ALLIES_PARAGRAPHS.join(' ');
    expect(joined).toContain("In Amber's work");
    expect(joined.toLowerCase()).not.toContain('causes disease');
    expect(joined.toLowerCase()).not.toContain('turn into disease');
    expect(joined.toLowerCase()).not.toContain('cure');
  });
});

/* ------------------------------------------------------------------ */
/* Results First (owner decision 2026-11-08)                           */
/* ------------------------------------------------------------------ */

const answersFor = (
  symptoms: string[],
  extra: Partial<AdvisorAnswers> = {},
): AdvisorAnswers => ({
  symptoms,
  intensity: 'moderate',
  frequency: 'frequent',
  duration: 'weeks',
  sleep: 'restful',
  stressLevel: 'calm',
  digestion: 'smooth',
  emotional: 'steady',
  triggers: [],
  timeOfDay: [],
  sensitivity: 'balanced',
  preferredFormat: 'no-preference',
  ...extra,
});

describe('Results First — pattern coverage (2026-11-08)', () => {
  it.each([
    ['beauty', 'quiet-radiance'],
    ['hormones', 'hormonal-flux'],
    ['cognitive', 'mental-fog'],
    ['wellness', 'foundational-balance'],
  ])(
    'routes a lone %s goal to its own pattern, never the generic fallback',
    (goal, patternId) => {
      const s = computeAdvisorSynthesis(answersFor([goal]), NO_QUIZ_SCREENING);
      expect(s.patterns[0].pattern.id).toBe(patternId);
      expect(s.allies.length).toBeGreaterThanOrEqual(ADVISOR_ALLY_FLOOR);
      expect(s.rituals.length).toBeGreaterThan(0);
    },
  );

  it('routes a cognitive goal to Mental Fog even with no fog signal', () => {
    // With a calm/steady profile no mental-fog signal is derived, so
    // Stress Depletion (which lists cognitive among its symptoms)
    // would tie on score — honoring its minMatches of 2 keeps the
    // cognitive pattern primary.
    const s = computeAdvisorSynthesis(answersFor(['cognitive']), NO_QUIZ_SCREENING);
    expect(s.patterns[0].pattern.id).toBe('mental-fog');
    expect(s.patterns.map((p) => p.pattern.id)).not.toContain('stress-depletion');
  });

  it('expands toward eight only when a second chosen goal contributes', () => {
    const s = computeAdvisorSynthesis(answersFor(['sleep', 'pain']), NO_QUIZ_SCREENING);
    expect(s.patterns.map((p) => p.pattern.id)).toContain('stagnation');
    // 5 overwhelm allies + 3 distinct stagnation allies, at the cap.
    expect(s.allies.length).toBe(ADVISOR_ALLY_CAP);
    expect(s.allies.map((a) => a.id)).toContain('arnica');
    expect(new Set(s.allies.map((a) => a.id)).size).toBe(s.allies.length);
  });

  it('never pads the list from a booster-only second pattern', () => {
    // Constructed scored pair: immune-strain scored on signals alone
    // and the visitor never chose the immune goal — its allies must
    // not be gathered.
    const scored = [
      { pattern: ADVISOR_PATTERNS['nervous-overwhelm'], score: 9 },
      { pattern: ADVISOR_PATTERNS['immune-strain'], score: 4 },
    ];
    const allies = gatherAllies(scored, ['sleep'], ['sleep']);
    expect(allies).toHaveLength(ADVISOR_ALLY_FLOOR);
    expect(allies.every((a) => a.patternName === 'Nervous System Overwhelm')).toBe(true);
  });

  it('holds the floor and the cap on a broad four-goal run', () => {
    const s = computeAdvisorSynthesis(
      answersFor(['sleep', 'stress', 'pain', 'digestion']),
      NO_QUIZ_SCREENING,
    );
    expect(s.allies.length).toBeGreaterThanOrEqual(ADVISOR_ALLY_FLOOR);
    expect(s.allies.length).toBeLessThanOrEqual(ADVISOR_ALLY_CAP);
  });
});

describe('Results First — Body / Mind / Soul dimensions (2026-11-08)', () => {
  it('tags every pattern and resolves a dimension for every ally', () => {
    for (const pattern of Object.values(ADVISOR_PATTERNS)) {
      expect(['body', 'mind', 'soul']).toContain(pattern.dimension);
    }
    const s = computeAdvisorSynthesis(answersFor(['sleep', 'pain']), NO_QUIZ_SCREENING);
    for (const ally of s.allies) {
      expect(['body', 'mind', 'soul']).toContain(ally.dimension);
    }
    // This run's allies span all three dimensions.
    expect(new Set(s.allies.map((a) => a.dimension)).size).toBe(3);
  });

  it('groups in Body / Mind / Soul order and carries dimensions into the snapshot', () => {
    const s = computeAdvisorSynthesis(answersFor(['sleep', 'pain']), NO_QUIZ_SCREENING);
    const groups = groupByDimension(s.allies);
    expect(groups.map((g) => g.section.id)).toEqual(['body', 'mind', 'soul']);
    expect(groups.map((g) => g.section.heading)).toEqual(['Body', 'Mind', 'Soul']);
    const snap = toAdvisorResultSnapshot(s);
    expect(snap.allies.every((a) => a.dimension !== undefined)).toBe(true);
    expect(snap.patterns[0].dimension).toBe('mind');
  });
});

describe('compliance law over the NEW pattern copy (2026-11-08)', () => {
  it('uses traditional-use framing only — no remedy or outcome claims', () => {
    for (const id of ['quiet-radiance', 'hormonal-flux', 'mental-fog', 'foundational-balance']) {
      const p = ADVISOR_PATTERNS[id];
      const text = [
        p.summary,
        p.rootSupport,
        ...p.allies.map((a) => a.benefit),
      ].join(' ');
      expect(text.toLowerCase(), id).not.toMatch(
        /\b(remedy|remedies|treat|treats|cure|cures|prevent|prevents|diagnose|diagnoses|heal|heals)\b/,
      );
    }
  });
});
