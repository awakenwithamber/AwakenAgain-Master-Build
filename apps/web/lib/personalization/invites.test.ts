/**
 * Profile-invite visibility rules (owner spec 2026-10-14): never on a
 * first visit, at most once per moment per visitor.
 */
import { describe, expect, it } from 'vitest';
import type { StorageLike } from './consent';
import {
  INVITE_COPY,
  INVITE_MOMENTS,
  beginSession,
  markInviteSeen,
  shouldShowInvite,
} from './invites';

function fakeStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('beginSession / first visit', () => {
  it('the first-ever session is a first visit; the flag persists', () => {
    const local = fakeStorage();
    const session = fakeStorage();
    expect(beginSession({ local, session, now: 1000 }).isFirstVisit).toBe(true);
    // Same session re-entry is not treated as a new visit decision.
    expect(beginSession({ local, session, now: 2000 }).isFirstVisit).toBe(
      false,
    );
  });

  it('a later session (new session storage, same local) is a return visit', () => {
    const local = fakeStorage();
    beginSession({ local, session: fakeStorage(), now: 1000 });
    const second = beginSession({ local, session: fakeStorage(), now: 5000 });
    expect(second.isFirstVisit).toBe(false);
  });
});

describe('shouldShowInvite', () => {
  it('never shows on a first visit', () => {
    const local = fakeStorage();
    for (const moment of INVITE_MOMENTS) {
      expect(shouldShowInvite({ local, moment, isFirstVisit: true })).toBe(
        false,
      );
    }
  });

  it('shows for a returning visitor who has not seen the moment', () => {
    const local = fakeStorage();
    expect(
      shouldShowInvite({ local, moment: 'cart', isFirstVisit: false }),
    ).toBe(true);
  });

  it('shows at most once per moment — seen moments stay hidden, others still show', () => {
    const local = fakeStorage();
    markInviteSeen(local, 'cart', 1234);
    expect(
      shouldShowInvite({ local, moment: 'cart', isFirstVisit: false }),
    ).toBe(false);
    expect(
      shouldShowInvite({ local, moment: 'quiz-results', isFirstVisit: false }),
    ).toBe(true);
  });
});

describe('invite copy', () => {
  it('every moment has a one-line benefit and an honest, existing action', () => {
    for (const moment of INVITE_MOMENTS) {
      const copy = INVITE_COPY[moment];
      expect(copy.line.length).toBeGreaterThan(20);
      expect(copy.ctaLabel.length).toBeGreaterThan(0);
      // Actions that exist today: the footer newsletter anchor, the
      // Grimoire email sign-in, or — since Phase 3 Step 3 built it —
      // the real /account profile route. Never a route that 404s.
      expect(['#newsletter-signup', '/grimoire', '/account']).toContain(copy.ctaHref);
    }
  });
});
