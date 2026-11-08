import { describe, expect, it } from 'vitest';
import {
  buildQuizResultsJob,
  renderEmailMessage,
  QUIZ_FOOTER_FDA_DISCLAIMER,
} from './email';
import { getProductByHandle } from '../catalog/products';
import { siteUrl } from '../seo/config';
import {
  getQuizResult,
  QUIZ_CONCERNS,
  toQuizResultSnapshot,
  type QuizResultSnapshot,
} from '../quiz/quiz';
import {
  computeAdvisorSynthesis,
  toAdvisorResultSnapshot,
  type AdvisorAnswers,
} from '../quiz/advisor';
import { NO_SAFETY_NOTES_ON_FILE } from '../quiz/herb-enrichment';

function renderClassic(
  concernId: string,
  formId: string,
  name: string | null = 'Amber',
) {
  const snapshot = toQuizResultSnapshot(getQuizResult(concernId, formId)!);
  const job = buildQuizResultsJob('friend@example.com', {
    name,
    result: snapshot,
  });
  return renderEmailMessage(job);
}

describe('quiz_results render — Pain × Balm (classic matrix)', () => {
  const { subject, text } = renderClassic('pain', 'balm');
  const base = siteUrl();

  it('keeps the remote subject and greets by name', () => {
    expect(subject).toBe('Your Herbal Allies quiz results — Awaken Again');
    expect(text).toContain('Hello Amber,');
    expect(text).toContain('Focus: Pain & Inflammation');
    expect(text).toContain('Preferred form: Balm / Salve');
  });

  it('links each herb to its Herb Library page', () => {
    expect(text).toContain(`Herb Library: ${base}/herbal-library/turmeric`);
    expect(text).toContain(`Herb Library: ${base}/herbal-library/arnica`);
    expect(text).toContain(`Herb Library: ${base}/herbal-library/willow-bark`);
  });

  it('carries traditional use + why-it-matched built from the answers', () => {
    expect(text).toContain('Traditionally used for:');
    expect(text).toContain(
      'Why it matched you: You shared that everyday comfort after activity is a priority, and that you prefer Balm / Salve — Arnica is one of the allies',
    );
  });

  it('shows flagged-herb safety notes verbatim — never omitted', () => {
    expect(text).toContain('External use only.'); // Arnica
    expect(text).toContain(
      'Check with your healthcare provider if you take blood thinners.', // Willow bark
    );
    // Turmeric has no safety text on file → exactly one fallback line.
    const fallbacks = text.split(NO_SAFETY_NOTES_ON_FILE).length - 1;
    expect(fallbacks).toBe(1);
    // Every ally section carries a safety block.
    expect(text.split('Safety notes:').length - 1).toBe(3);
  });

  it('matches shop products per herb and omits empty blocks', () => {
    expect(text).toContain('From the shop:');
    expect(text).toContain(`${base}/shop/soothe-restore-botanical-balm`);
  });

  it('ends with the spec footer: retake, Grimoire, FDA, LLC + address', () => {
    expect(text).toContain(`Retake the quiz anytime:\n${base}/quiz`);
    expect(text).toContain('Living Grimoire');
    expect(text).toContain(`${base}/grimoire`);
    expect(text).toContain(QUIZ_FOOTER_FDA_DISCLAIMER);
    expect(text).toContain('Awaken With Amber LLC');
    expect(text).toContain('239 South 1200 West, Salt Lake City, UT 84104');
  });

  it('contains no unlock/lock framing — results are never gated', () => {
    expect(text).not.toMatch(/unlock/i);
  });
});

describe('quiz footer FDA disclaimer — verbatim against the catalog', () => {
  it('equals the disclaimer field carried by product records', () => {
    const product = getProductByHandle('happy-pill-capsules')!;
    const disclaimer = (product as Record<string, unknown>)['disclaimer'];
    expect(disclaimer).toBe(QUIZ_FOOTER_FDA_DISCLAIMER);
  });
});

describe('quiz_results render — wording sweep (every concern)', () => {
  it('never presents a herb as treating/curing/preventing anything', () => {
    for (const concern of QUIZ_CONCERNS) {
      const { text } = renderClassic(concern.id, 'tea', null);
      // The FDA disclaimer's own legal sentence is exempt.
      const body = text.split(QUIZ_FOOTER_FDA_DISCLAIMER).join('');
      expect(body, concern.id).not.toMatch(
        /\b(treat|treats|treating|cure|cures|curing|prevent|prevents|preventing|diagnose|diagnoses|diagnosing)\b/i,
      );
      // And every rendered email carries a safety block per ally.
      expect(body.split('Safety notes:').length - 1, concern.id).toBe(3);
    }
  });
});

describe('quiz_results render — advisor Synthesis snapshot', () => {
  const answers: AdvisorAnswers = {
    symptoms: ['pain'],
    intensity: 'moderate',
    frequency: 'often',
    duration: 'months',
    sleep: 'sound',
    stressLevel: 'steady',
    digestion: 'smooth',
    emotional: 'steady',
    triggers: [],
    timeOfDay: ['morning'],
    sensitivity: 'balanced',
    preferredFormat: 'balm',
  };

  function renderAdvisor(): { subject: string; text: string } {
    const snapshot: QuizResultSnapshot = toQuizResultSnapshot(
      getQuizResult('pain', 'balm')!,
    );
    snapshot.advisor = toAdvisorResultSnapshot(
      computeAdvisorSynthesis(answers, {
        pregnantOrNursing: false,
        takingMedication: false,
        managingCondition: false,
      }),
    );
    const job = buildQuizResultsJob('friend@example.com', {
      name: 'Amber',
      result: snapshot,
    });
    return renderEmailMessage(job);
  }

  it('keeps the Synthesis and adds safety blocks + the spec footer', () => {
    const { subject, text } = renderAdvisor();
    expect(subject).toContain('personalized Herbal Allies results');
    expect(text).toContain('Chosen because of');
    expect(text).toContain('/contact');
    // One safety block per advisor ally — none omitted.
    const allyCount = text.split('Safety notes:').length - 1;
    expect(allyCount).toBeGreaterThan(0);
    expect(text).toContain('Awaken With Amber LLC');
    expect(text).toContain('239 South 1200 West, Salt Lake City, UT 84104');
    expect(text).toContain(`Retake the quiz anytime:\n${siteUrl()}/quiz`);
    expect(text).not.toMatch(/tincture/i);
  });
});

describe('quiz_results render — Results First (2026-11-08)', () => {
  const baseAnswers: AdvisorAnswers = {
    symptoms: ['beauty'],
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
    preferredFormat: 'serum',
  };

  function renderAdvisorRun(answers: AdvisorAnswers): string {
    // The classic snapshot is only the carrier — the advisor block is
    // what this branch renders.
    const snapshot: QuizResultSnapshot = toQuizResultSnapshot(
      getQuizResult('sleep', 'tea')!,
    );
    snapshot.advisor = toAdvisorResultSnapshot(
      computeAdvisorSynthesis(answers, {
        pregnantOrNursing: false,
        takingMedication: false,
        managingCondition: false,
      }),
    );
    const job = buildQuizResultsJob('friend@example.com', {
      name: 'Amber',
      result: snapshot,
    });
    return renderEmailMessage(job).text;
  }

  it('renders a beauty run with its own pattern, grouped Body / Mind / Soul', () => {
    const text = renderAdvisorRun(baseAnswers);
    expect(text).toContain('Quiet Radiance');
    // Group headings, in order, with their section lines.
    expect(text).toContain('Body — ');
    expect(text).toContain('Soul — ');
    expect(text.indexOf('Body — ')).toBeLessThan(text.indexOf('Soul — '));
    // Five allies, five safety blocks — none omitted, none gated.
    expect(text.split('Safety notes:').length - 1).toBe(5);
    expect(text).toContain('Calendula');
    expect(text).not.toMatch(/unlock/i);
  });

  it('renders a cognitive run under the Mind heading with Mental Fog', () => {
    const text = renderAdvisorRun({
      ...baseAnswers,
      symptoms: ['cognitive'],
      preferredFormat: 'capsule',
    });
    expect(text).toContain('Mental Fog');
    expect(text).toContain('Mind — ');
    expect(text.split('Safety notes:').length - 1).toBe(5);
  });

  it('expands a two-goal run past five allies — and keeps every safety block', () => {
    const text = renderAdvisorRun({
      ...baseAnswers,
      symptoms: ['sleep', 'pain'],
      preferredFormat: 'balm',
    });
    // 5 overwhelm + 3 stagnation allies at the Results First cap.
    expect(text.split('Safety notes:').length - 1).toBe(8);
    expect(text).toContain('Arnica');
    expect(text).toContain('External use only.');
  });
});
