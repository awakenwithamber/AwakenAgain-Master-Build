/**
 * Results PDF — Body / Mind / Soul organization (Results First,
 * owner decision 2026-11-08).
 *
 * The PDF writer emits uncompressed content streams, so the document
 * text is directly searchable in the bytes. These tests build real
 * PDFs from real syntheses and pin: the dimension group headings in
 * Body / Mind / Soul order, a safety block for every ally, and the
 * new patterns rendering through the document.
 */
import { describe, expect, it } from 'vitest';
import { buildQuizResultsPdf } from './results-pdf';
import {
  computeAdvisorSynthesis,
  toAdvisorResultSnapshot,
  type AdvisorAnswers,
} from './advisor';
import { NO_QUIZ_SCREENING } from './quiz';

function pdfText(answers: AdvisorAnswers): string {
  const snapshot = toAdvisorResultSnapshot(
    computeAdvisorSynthesis(answers, NO_QUIZ_SCREENING),
  );
  const bytes = buildQuizResultsPdf({
    snapshot,
    name: 'Amber',
    dateStr: 'November 8, 2026',
  });
  return Buffer.from(bytes).toString('latin1');
}

const BASE: Omit<AdvisorAnswers, 'symptoms'> = {
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
};

describe('buildQuizResultsPdf — Results First organization', () => {
  it('renders a beauty run under Body / Mind / Soul with the new pattern', () => {
    const text = pdfText({ ...BASE, symptoms: ['beauty'] });
    expect(text).toContain('Quiet Radiance');
    expect(text).toContain('Body');
    expect(text).toContain('Soul');
    // Headings appear in Body → Mind → Soul document order (only the
    // dimensions this run actually has: Body and Soul).
    expect(text.indexOf('Body')).toBeLessThan(text.indexOf('Soul'));
    // One safety block per ally — five allies, none omitted.
    expect(text.split('Safety notes:').length - 1).toBe(5);
    expect(text).toContain('Calendula');
  });

  it('renders a cognitive run with the Mind grouping and Mental Fog', () => {
    const text = pdfText({ ...BASE, symptoms: ['cognitive'] });
    expect(text).toContain('Mental Fog');
    expect(text).toContain('Mind');
    expect(text.split('Safety notes:').length - 1).toBe(5);
  });
});
