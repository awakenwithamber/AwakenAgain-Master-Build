/**
 * Results First flow pins (owner decision 2026-11-08).
 *
 * The audit's root cause #1 was structural: the quiz ended at an
 * email-capture wall, so a visitor who completed the quiz and did not
 * complete the form — or hit any failure at it — saw no results at
 * all. These tests pin the corrected structure at the component seam:
 * the lead phase does not exist, there is no skip link (nothing to
 * skip), completing the screening goes straight to the results, and
 * the session persistence is wired. The engine side is pinned too:
 * a full Synthesis is computed from answers alone — no email, no
 * account, no network anywhere in the pipeline.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  computeAdvisorSynthesis,
  type AdvisorAnswers,
} from './advisor';
import { NO_QUIZ_SCREENING } from './quiz';

const quizSource = readFileSync(
  new URL('../../components/quiz/Quiz.tsx', import.meta.url),
  'utf8',
);

describe('Results First — the component structure', () => {
  it('has no lead/email phase and no skip link', () => {
    expect(quizSource).not.toContain("phase === 'lead'");
    expect(quizSource).not.toContain("setPhase('lead')");
    expect(quizSource).not.toContain('Skip —');
    expect(quizSource).not.toContain('quiz-ghost');
  });

  it('carries no gating or unlocking framing anywhere', () => {
    expect(quizSource).not.toMatch(/unlock/i);
    expect(quizSource).not.toMatch(/enter your email to/i);
  });

  it('completing the screening goes straight to the results', () => {
    const start = quizSource.indexOf('const completeScreening');
    const end = quizSource.indexOf('const restart');
    const body = quizSource.slice(start, end);
    expect(body).toContain("setPhase('results')");
  });

  it('wires the session persistence (refresh-safe answers + results)', () => {
    expect(quizSource).toContain("from '../../lib/quiz/quiz-session'");
    expect(quizSource).toContain('loadQuizSession');
    expect(quizSource).toContain('saveQuizSession');
    expect(quizSource).toContain('clearQuizSession');
    expect(quizSource).toContain('window.sessionStorage');
  });

  it('renders the allies grouped by Body / Mind / Soul, each with its safety block', () => {
    expect(quizSource).toContain('groupByDimension');
    expect(quizSource).toContain('Safety notes:');
    expect(quizSource).toContain('safetyLinesFor');
  });

  it('keeps the email as an optional results-page panel with the split consent', () => {
    expect(quizSource).toContain('Want these in your inbox?');
    expect(quizSource).toContain(
      'We&rsquo;ll email you your Herbal Allies so you have a copy.',
    );
    expect(quizSource).toContain('newsletterConsent: lead.newsletter');
  });
});

describe('Results First — results need no email at all', () => {
  it('computes a complete Synthesis from answers alone', () => {
    const answers: AdvisorAnswers = {
      symptoms: ['cognitive'],
      intensity: 'significant',
      frequency: 'daily',
      duration: 'months',
      sleep: 'light',
      stressLevel: 'stretched',
      digestion: 'smooth',
      emotional: 'flat',
      triggers: ['screens-late'],
      timeOfDay: ['morning'],
      sensitivity: 'balanced',
      preferredFormat: 'capsule',
    };
    const s = computeAdvisorSynthesis(answers, NO_QUIZ_SCREENING);
    expect(s.patterns[0].pattern.id).toBe('mental-fog');
    expect(s.allies.length).toBeGreaterThanOrEqual(5);
    expect(s.summaryLines.length).toBeGreaterThan(0);
    expect(s.rituals.length).toBeGreaterThan(0);
  });
});
