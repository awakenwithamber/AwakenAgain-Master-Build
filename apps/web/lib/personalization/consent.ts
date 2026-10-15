/**
 * Analytics consent state machine (owner spec 2026-10-14 — privacy-first
 * personalization). Pure and storage-injectable so the rules are unit
 * tested without a browser.
 *
 * STATES
 *   unknown  — the visitor has not chosen yet. ONLY basic anonymous page
 *              counts may be collected (PostHog $pageview with person
 *              profiles and autocapture OFF). No interest profile accrues
 *              and no detailed event fires.
 *   accepted — full consented capture: typed PostHog events fire and the
 *              first-party interest profile (./interests.ts) may accrue.
 *   declined — the visitor said no. PostHog opt_out_capturing() applies:
 *              nothing is captured at all, not even page counts, and the
 *              choice is honored permanently until the visitor changes it
 *              (footer "Privacy Choices" link / the privacy page control).
 *
 * TRANSITIONS
 *   choose('accepted' | 'declined') — from any state; persists the choice.
 *   withdraw() — back to 'unknown' (consent reset) AND returns the side
 *              effects the caller must apply: wipe the interest profile
 *              and opt PostHog out until a fresh choice is made.
 *
 * The choice lives in localStorage only. No PII, no fingerprinting —
 * this module stores one word: 'accepted' or 'declined'.
 */

export type ConsentState = 'unknown' | 'accepted' | 'declined';

export type ConsentChoice = 'accepted' | 'declined';

export const CONSENT_STORAGE_KEY = 'aa_analytics_consent_v1';

/** Minimal storage surface (window.localStorage satisfies this). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Read the persisted choice. Absence (or garbage) means 'unknown'. */
export function readConsentState(storage: StorageLike): ConsentState {
  try {
    const raw = storage.getItem(CONSENT_STORAGE_KEY);
    if (raw === 'accepted' || raw === 'declined') return raw;
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Persist a fresh choice from any state; returns the new state. */
export function chooseConsent(
  storage: StorageLike,
  choice: ConsentChoice,
): ConsentState {
  try {
    storage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    /* storage unavailable (private mode) — the in-memory state still applies */
  }
  return choice;
}

/**
 * Withdraw consent entirely: clears the persisted choice (back to
 * 'unknown' — the consent bar may ask again on a later visit) and tells
 * the caller which side effects to apply. PostHog opt-out happens in the
 * browser glue (lib/personalization/client.ts) because only it may touch
 * posthog-js.
 */
export function withdrawConsent(storage: StorageLike): {
  state: ConsentState;
  wipeInterests: true;
  posthogOptOut: true;
} {
  try {
    storage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    /* ignore — reset is best-effort */
  }
  return { state: 'unknown', wipeInterests: true, posthogOptOut: true };
}

/** Detailed analytics events may fire only in the accepted state. */
export function canCaptureDetails(state: ConsentState): boolean {
  return state === 'accepted';
}

/** Anonymous page counts may fire unless the visitor declined. */
export function canCountPageviews(state: ConsentState): boolean {
  return state !== 'declined';
}

/**
 * Test-traffic tagging (owner spec 2026-10-14): a visit carrying
 * ?aa_test=1 is tagged test traffic; the tag persists for the rest of the
 * browser session so multi-page test runs stay tagged. Every PostHog
 * event carries `traffic_type: 'test' | 'real'` (registered as a super
 * property in lib/analytics/posthog.ts).
 */
export const TRAFFIC_TYPE_KEY = 'aa_traffic_type';
export type TrafficType = 'test' | 'real';

export function resolveTrafficType(input: {
  search: string;
  session: StorageLike;
}): TrafficType {
  try {
    const params = new URLSearchParams(input.search);
    if (params.get('aa_test') === '1') {
      input.session.setItem(TRAFFIC_TYPE_KEY, 'test');
      return 'test';
    }
    return input.session.getItem(TRAFFIC_TYPE_KEY) === 'test'
      ? 'test'
      : 'real';
  } catch {
    return 'real';
  }
}

/* --- Browser adapters (the only window-touching code in this module) --- */

/** Consent state from the real browser storage; 'unknown' when unavailable. */
export function readBrowserConsentState(): ConsentState {
  try {
    return readConsentState(window.localStorage);
  } catch {
    return 'unknown';
  }
}

/** Traffic type for the current page load (see resolveTrafficType). */
export function browserTrafficType(): TrafficType {
  try {
    return resolveTrafficType({
      search: window.location.search,
      session: window.sessionStorage,
    });
  } catch {
    return 'real';
  }
}
