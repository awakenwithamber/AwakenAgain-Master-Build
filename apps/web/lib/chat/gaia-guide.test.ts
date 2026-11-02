import { describe, expect, it } from 'vitest';
import {
  GAIA_BEGINNER_WORDING,
  gaiaRecommendation,
  goalNeedsInterest,
} from './gaia-guide';

describe('Gaia beginner guide', () => {
  it("carries Amber's beginner wording verbatim", () => {
    expect(GAIA_BEGINNER_WORDING).toBe(
      'If you do not know where to begin, chat with Gaia! Answer a short questionnaire and she will lead you to the section that will help you the most.',
    );
  });

  it('asks the interest follow-up only for product and custom goals', () => {
    expect(goalNeedsInterest('product')).toBe(true);
    expect(goalNeedsInterest('custom')).toBe(true);
    expect(goalNeedsInterest('learn')).toBe(false);
    expect(goalNeedsInterest('grimoire')).toBe(false);
    expect(goalNeedsInterest('browse')).toBe(false);
  });

  it('routes learning to the Herb Encyclopedia', () => {
    expect(gaiaRecommendation('learn', null, '/').href).toBe('/herb-index');
  });

  it('routes product goals to the quiz, soap interest to the Soap Shop', () => {
    expect(gaiaRecommendation('product', 'sleep', '/').href).toBe('/quiz');
    expect(gaiaRecommendation('product', 'soap', '/').href).toBe('/soap-shop');
  });

  it('routes custom goals to the builders', () => {
    expect(gaiaRecommendation('custom', 'skin', '/').href).toBe('/custom-formula');
    expect(gaiaRecommendation('custom', 'soap', '/').href).toBe('/soap-builder');
  });

  it('is page-aware for browsing and grimoire goals', () => {
    expect(gaiaRecommendation('browse', null, '/shop/dreamease-capsules').href).toBe('/quiz');
    expect(gaiaRecommendation('browse', null, '/herb-index').href).toBe('/shop');
    expect(gaiaRecommendation('browse', null, '/grimoire').href).toBe('/grimoire/subscribe');
    expect(gaiaRecommendation('grimoire', null, '/grimoire').href).toBe('/grimoire/subscribe');
    expect(gaiaRecommendation('grimoire', null, '/').href).toBe('/grimoire');
  });

  it('never recommends a section with remedy or treatment wording', () => {
    for (const goal of ['product', 'learn', 'grimoire', 'custom', 'browse'] as const) {
      const rec = gaiaRecommendation(goal, 'calm', '/');
      expect(rec.label.toLowerCase()).not.toContain('remed');
      expect(rec.blurb.toLowerCase()).not.toContain('remed');
      expect(rec.blurb.toLowerCase()).not.toContain('treatment');
    }
  });
});
