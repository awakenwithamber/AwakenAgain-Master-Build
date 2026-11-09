/**
 * Gaia profile script — locks the owner's shape (Gaia build):
 * every profile field has exactly one step, in order, with its
 * requirement stated up front; the tour covers the features; the
 * quiz invitation points at the real quiz; and the copy stays inside
 * the wording canon (enticing about the experience, never a remedy
 * or a guaranteed outcome).
 */
import { describe, expect, it } from 'vitest';
import {
  GAIA_MODE_QUESTION,
  GAIA_PROFILE_STEPS,
  GAIA_QUIZ_INVITATION,
  GAIA_TOUR_STOPS,
  gaiaProfileStep,
} from './gaia-profile';

describe('guided steps', () => {
  it('covers every field exactly once, in order', () => {
    expect(GAIA_PROFILE_STEPS.map((s) => s.field)).toEqual([
      'full_name',
      'birthday',
      'bio',
      'photo',
      'phone',
      'address',
      'birth_chart',
      'socials',
      'privacy',
    ]);
  });

  it('every step states its requirement before input', () => {
    for (const step of GAIA_PROFILE_STEPS) {
      expect(step.prompt.length).toBeGreaterThan(20);
      expect(step.requirement.length).toBeGreaterThan(10);
    }
    expect(gaiaProfileStep('birthday')?.requirement).toMatch(/13/);
    expect(gaiaProfileStep('birthday')?.requirement).toMatch(/never shown publicly/i);
    expect(gaiaProfileStep('photo')?.requirement).toMatch(/strip/i);
    expect(gaiaProfileStep('privacy')?.required).toBe(true);
    expect(gaiaProfileStep('phone')?.required).toBe(false);
  });
});

describe('skip or tour', () => {
  it('the gate question offers both paths honestly', () => {
    expect(GAIA_MODE_QUESTION).toMatch(/straight to the form/i);
    expect(GAIA_MODE_QUESTION).toMatch(/same questions/i);
  });

  it('the tour walks the features one at a time', () => {
    expect(GAIA_TOUR_STOPS.length).toBeGreaterThanOrEqual(5);
    const titles = GAIA_TOUR_STOPS.map((s) => s.title).join(' ');
    expect(titles).toMatch(/feed/i);
    expect(titles).toMatch(/favorites/i);
    expect(titles).toMatch(/allies/i);
    expect(titles).toMatch(/star chart/i);
    expect(titles).toMatch(/progress/i);
  });

  it('copy stays inside the wording canon — no remedy or outcome promises', () => {
    const all = [
      GAIA_MODE_QUESTION,
      ...GAIA_TOUR_STOPS.map((s) => `${s.title} ${s.body}`),
      ...GAIA_PROFILE_STEPS.map((s) => `${s.prompt} ${s.requirement}`),
      GAIA_QUIZ_INVITATION.body,
    ].join(' ');
    expect(all).not.toMatch(/\b(cure|cures|treat|treats|treatment|heal|heals|remedy|remedies)\b/i);
    expect(all).not.toMatch(/guarantee/i);
  });
});

describe('quiz invitation', () => {
  it('points at the real quiz and names the allies it feeds', () => {
    expect(GAIA_QUIZ_INVITATION.ctaHref).toBe('/quiz');
    expect(GAIA_QUIZ_INVITATION.body).toMatch(/herbal allies/i);
  });
});
