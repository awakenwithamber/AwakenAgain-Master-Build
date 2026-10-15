/**
 * Browser glue for the personalization slice (owner spec 2026-10-14).
 * The pure rules live in ./consent.ts, ./interests.ts, ./invites.ts and
 * ./home-personalization.ts (all unit-tested with injected storage);
 * this module binds them to the real window.localStorage /
 * sessionStorage and to PostHog side effects. Client-only.
 */
import {
  chooseConsent,
  readConsentState,
  withdrawConsent,
  type ConsentChoice,
  type ConsentState,
  type StorageLike,
} from './consent';
import {
  clearProfile,
  readProfile,
  recordInterest,
  topInterest,
  type InterestCategory,
} from './interests';
import { applyAnalyticsConsent } from '../analytics/posthog';
import {
  beginSession,
  markInviteSeen,
  shouldShowInvite,
  type InviteMoment,
} from './invites';

export const CONSENT_CHANGED_EVENT = 'aa:consent-changed';

function local(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function session(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function notifyConsentChanged(): void {
  try {
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

export function getConsentStateNow(): ConsentState {
  const store = local();
  return store ? readConsentState(store) : 'unknown';
}

/** Accept or decline: persist, reconcile PostHog, notify listeners. */
export function applyConsentChoiceNow(choice: ConsentChoice): ConsentState {
  const store = local();
  const state = store ? chooseConsent(store, choice) : choice;
  void applyAnalyticsConsent(state);
  notifyConsentChanged();
  return state;
}

/**
 * Withdraw consent and delete local personalization data (privacy page):
 * interest profile wiped, persisted choice cleared (back to 'unknown'),
 * PostHog opted out until a fresh choice is made.
 */
export function withdrawAndDeleteNow(): void {
  const store = local();
  if (store) {
    const result = withdrawConsent(store);
    if (result.wipeInterests) clearProfile(store);
    void applyAnalyticsConsent(result.posthogOptOut ? 'declined' : 'unknown');
  }
  notifyConsentChanged();
}

/** Accrue interest for an engagement — internally consent-gated. */
export function recordInterestNow(category: InterestCategory, points = 1): void {
  const store = local();
  if (store) recordInterest(store, category, points);
}

/** The visitor's clear top interest, or null (no consent / no signal / tie). */
export function topInterestNow(): InterestCategory | null {
  const store = local();
  if (!store) return null;
  if (readConsentState(store) !== 'accepted') return null;
  return topInterest(readProfile(store));
}

/** True when this browser session is the visitor's first-ever session. */
export function isFirstVisitNow(): boolean {
  const localStore = local();
  const sessionStore = session();
  if (!localStore || !sessionStore) return true;
  return beginSession({ local: localStore, session: sessionStore, now: Date.now() })
    .isFirstVisit;
}

/**
 * Invite visibility for this page load, applying the once-per-moment
 * rule: when this returns true the moment is immediately marked seen,
 * so the invite can never render twice for this visitor.
 */
export function inviteVisibleNow(moment: InviteMoment): boolean {
  const localStore = local();
  const sessionStore = session();
  if (!localStore || !sessionStore) return false;
  const { isFirstVisit } = beginSession({
    local: localStore,
    session: sessionStore,
    now: Date.now(),
  });
  const show = shouldShowInvite({ local: localStore, moment, isFirstVisit });
  if (show) markInviteSeen(localStore, moment, Date.now());
  return show;
}
