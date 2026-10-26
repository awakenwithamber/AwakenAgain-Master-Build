/**
 * Gaia nudge laws (copy pack 2026-10-25 §6):
 * - Cadence: first nudge ≥60s in; ≤1 per 7 minutes; max 3 per session;
 *   a dismissal snoozes the next nudge for 7 minutes.
 * - Selection: quiz first on form pages, product-by-interest uses REAL
 *   catalog handles only, subscription for Grimoire interest, profile
 *   destination matches ProfileInvite's (/account).
 * Pure state in/out — no timers, no DOM.
 */
import { describe, expect, it } from 'vitest';
import {
  GAIA_NUDGE_INTERVAL_MS,
  initialGaiaNudgeRotation,
  nextGaiaNudge,
  recordGaiaNudgeDismissed,
  recordGaiaNudgeShown,
  type GaiaNudgeContext,
  type GaiaNudgeRotation,
} from './gaia-nudges';
import { emptyProfile, type InterestProfile } from './interests';
import { getProductByHandle } from '../catalog/products';
import { INVITE_COPY } from './invites';

const T0 = 1_000_000;

function ctx(overrides: Partial<GaiaNudgeContext> = {}): GaiaNudgeContext {
  return { pathname: '/', profile: null, ...overrides };
}

function profileWith(
  category: keyof InterestProfile,
  score: number,
): InterestProfile {
  const profile = emptyProfile();
  profile[category] = score;
  return profile;
}

describe('gaia nudge cadence', () => {
  it('shows nothing before 60 seconds', () => {
    const state = initialGaiaNudgeRotation(T0);
    expect(nextGaiaNudge(ctx(), state, T0 + 59_999)).toBeNull();
  });

  it('shows the first nudge at 60 seconds', () => {
    const state = initialGaiaNudgeRotation(T0);
    const nudge = nextGaiaNudge(ctx(), state, T0 + 60_000);
    expect(nudge).not.toBeNull();
  });

  it('enforces one nudge per 7 minutes after a show', () => {
    let state = initialGaiaNudgeRotation(T0);
    const firstAt = T0 + 60_000;
    const first = nextGaiaNudge(ctx(), state, firstAt)!;
    state = recordGaiaNudgeShown(state, first.kind, firstAt);
    expect(
      nextGaiaNudge(ctx(), state, firstAt + GAIA_NUDGE_INTERVAL_MS - 1),
    ).toBeNull();
    const second = nextGaiaNudge(
      ctx(),
      state,
      firstAt + GAIA_NUDGE_INTERVAL_MS,
    );
    expect(second).not.toBeNull();
    expect(second!.kind).not.toBe(first.kind);
  });

  it('a dismissal snoozes the next nudge for 7 minutes', () => {
    let state: GaiaNudgeRotation = initialGaiaNudgeRotation(T0);
    const shownAt = T0 + 60_000;
    const first = nextGaiaNudge(ctx(), state, shownAt)!;
    state = recordGaiaNudgeShown(state, first.kind, shownAt);
    const dismissedAt = shownAt + 30_000;
    state = recordGaiaNudgeDismissed(state, dismissedAt);
    expect(
      nextGaiaNudge(ctx(), state, dismissedAt + GAIA_NUDGE_INTERVAL_MS - 1),
    ).toBeNull();
    expect(
      nextGaiaNudge(ctx(), state, dismissedAt + GAIA_NUDGE_INTERVAL_MS),
    ).not.toBeNull();
  });

  it('never exceeds 3 nudges per session', () => {
    let state = initialGaiaNudgeRotation(T0);
    let at = T0 + 60_000;
    for (let i = 0; i < 3; i++) {
      const nudge = nextGaiaNudge(ctx(), state, at);
      expect(nudge).not.toBeNull();
      state = recordGaiaNudgeShown(state, nudge!.kind, at);
      at += GAIA_NUDGE_INTERVAL_MS;
    }
    expect(nextGaiaNudge(ctx(), state, at + GAIA_NUDGE_INTERVAL_MS)).toBeNull();
  });

  it('never repeats a kind within a session', () => {
    let state = initialGaiaNudgeRotation(T0);
    let at = T0 + 60_000;
    const kinds = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const nudge = nextGaiaNudge(ctx(), state, at);
      expect(nudge).not.toBeNull();
      expect(kinds.has(nudge!.kind)).toBe(false);
      kinds.add(nudge!.kind);
      state = recordGaiaNudgeShown(state, nudge!.kind, at);
      at += GAIA_NUDGE_INTERVAL_MS;
    }
  });
});

describe('gaia nudge selection', () => {
  it('leads with the quiz on the form guide and builder pages', () => {
    const state = initialGaiaNudgeRotation(T0);
    for (const pathname of [
      '/custom-formula',
      '/custom-formula/tea',
      '/custom-formula/capsules',
    ]) {
      const nudge = nextGaiaNudge(ctx({ pathname }), state, T0 + 60_000);
      expect(nudge?.kind).toBe('quiz');
      expect(nudge?.href).toBe('/quiz');
      expect(nudge?.text).toContain('lost in the garden');
    }
  });

  it('leads with the quiz when the campaign utm mentions the quiz', () => {
    const state = initialGaiaNudgeRotation(T0);
    const nudge = nextGaiaNudge(
      ctx({ utmCampaign: 'fall-quiz-drive', utmSource: 'instagram' }),
      state,
      T0 + 60_000,
    );
    expect(nudge?.kind).toBe('quiz');
  });

  it('suggests tea to browsers on shop pages with no profile signal', () => {
    const state = initialGaiaNudgeRotation(T0);
    const nudge = nextGaiaNudge(
      ctx({ pathname: '/shop' }),
      state,
      T0 + 60_000,
    );
    expect(nudge?.kind).toBe('tea');
    expect(nudge?.href).toBe('/custom-formula/tea');
  });

  it('picks a real catalog product for the top interest', () => {
    const state = initialGaiaNudgeRotation(T0);
    for (const category of ['herbs', 'soaps', 'readings', 'articles', 'quiz'] as const) {
      const nudge = nextGaiaNudge(
        ctx({ profile: profileWith(category, 10) }),
        state,
        T0 + 60_000,
      );
      expect(nudge?.kind, `category ${category}`).toBe('product');
      expect(nudge?.productHandle).toBeTruthy();
      expect(
        getProductByHandle(nudge!.productHandle!),
        `handle ${nudge!.productHandle} must exist in the catalog`,
      ).toBeDefined();
      expect(nudge?.href).toBe(`/shop/${nudge!.productHandle}`);
      expect(nudge?.text).toContain(
        getProductByHandle(nudge!.productHandle!)!.title,
      );
    }
  });

  it('suggests the subscription when the Grimoire is the top interest', () => {
    const state = initialGaiaNudgeRotation(T0);
    const nudge = nextGaiaNudge(
      ctx({ profile: profileWith('grimoire', 9) }),
      state,
      T0 + 60_000,
    );
    expect(nudge?.kind).toBe('subscription');
    expect(nudge?.href).toBe('/grimoire');
    expect(nudge?.text).toContain('$7.77');
  });

  it('profile nudge destination matches ProfileInvite (no drift)', () => {
    const state = initialGaiaNudgeRotation(T0);
    const nudge = nextGaiaNudge(ctx(), state, T0 + 60_000);
    expect(nudge?.kind).toBe('profile');
    expect(nudge?.href).toBe(INVITE_COPY['quiz-results'].ctaHref);
    expect(nudge?.href).toBe('/account');
  });

  it('a tied or weak profile yields no product nudge', () => {
    const state = initialGaiaNudgeRotation(T0);
    const tied = emptyProfile();
    tied.herbs = 10;
    tied.soaps = 10;
    const nudge = nextGaiaNudge(
      ctx({ pathname: '/journal', profile: tied }),
      state,
      T0 + 60_000,
    );
    expect(nudge?.kind).not.toBe('product');
  });
});
