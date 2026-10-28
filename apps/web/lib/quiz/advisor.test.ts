/**
 * Restored Guided Wellness Quiz engine — locks the port (2026-10-22).
 *
 * Pins: the legacy synthesis behavior (patterns, signals, ally cap),
 * catalog resolution of every legacy recommendation id, the safety
 * screening applied to product suggestions, the lead-validation
 * normalization, and the compliance law over the restored copy (the
 * banned word never appears; Amber's "why these allies" narrative is
 * framed as her perspective, not medical causation).
 */
import { describe, expect, it } from 'vitest';
import {
  ADVISOR_GOALS,
  ADVISOR_HERB_RECOMMENDATIONS,
  ADVISOR_PATTERNS,
  ADVISOR_WHY_ALLIES_PARAGRAPHS,
  advisorLegacyIds,
  computeAdvisorSynthesis,
  gatherAdvisorSignals,
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
    const scored = synthesizePatterns(['beauty'], []);
    expect(scored).toHaveLength(1);
    expect(scored[0].pattern.id).toBe('stress-depletion');
    const scoredSleep = synthesizePatterns(['sleep'], []);
    expect(scoredSleep[0].pattern.id).toBe('nervous-overwhelm');
  });

  it('gathers at most six allies, deduped, each with a why-line', () => {
    const s = computeAdvisorSynthesis(BASE, NO_QUIZ_SCREENING);
    expect(s.allies.length).toBeGreaterThan(0);
    expect(s.allies.length).toBeLessThanOrEqual(6);
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
