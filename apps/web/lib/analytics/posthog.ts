/**
 * PostHog client initialization + typed tracking.
 * CLIENT-ONLY: never import this module from a Server Component or Route Handler.
 * (Server-side capture lives in ./posthog-server.ts: a plain HTTP POST to the
 * PostHog /capture/ endpoint with the publishable project token, stamped
 * implementation_source='nextjs'. The token is publishable by design — it is
 * already exposed to the browser via NEXT_PUBLIC_*. PostHog remains
 * observational; the order/cart/database is authoritative.)
 *
 * Design for dedupe by construction: call track() ONLY from event handlers
 * (clicks, confirmed state transitions) — never from render paths or
 * unguarded effects. React StrictMode double-invocation must not double-fire:
 * handlers are user gestures, not render side-effects.
 */
import type {
  AnalyticsEventName,
  AnalyticsEventProperties,
} from './events';
import {
  ANALYTICS_SOURCE,
  EVENT_OWNERSHIP,
  SOURCE_PROPERTY,
} from './events';
import {
  browserTrafficType,
  canCaptureDetails,
  readBrowserConsentState,
  type ConsentState,
} from '../personalization/consent';

const PROJECT_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const API_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.posthog.com';

/** Inert until configured. Never throws, never invents a key. */
function isConfigured(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!PROJECT_TOKEN &&
    PROJECT_TOKEN !== 'POSTHOG_KEY_PLACEHOLDER' &&
    !PROJECT_TOKEN.startsWith('REPLACE_')
  );
}

let initPromise: Promise<void> | null = null;

/**
 * Consent gate for detailed events (owner spec 2026-10-14): typed events
 * fire ONLY after the visitor accepted analytics consent. Before any
 * choice, PostHog runs in anonymous page-count mode (init config below:
 * autocapture OFF, person profiles NEVER). A declined visitor is opted
 * out entirely (see applyAnalyticsConsent + the init reconciliation).
 */
export function hasDetailConsent(): boolean {
  return canCaptureDetails(readBrowserConsentState());
}

function currentTrafficType() {
  return browserTrafficType();
}

function currentConsentState(): ConsentState {
  return readBrowserConsentState();
}

/** Idempotent init — safe to call from any client component. */
export function initPostHog(): Promise<void> {
  if (typeof window === 'undefined' || !isConfigured()) return Promise.resolve();
  if (!initPromise) {
    initPromise = import('posthog-js').then(({ default: posthog }) => {
      // Read the persisted choice BEFORE init: a declined visitor must
      // not fire even the pageview that init would otherwise capture.
      const declined = currentConsentState() === 'declined';
      posthog.init(PROJECT_TOKEN as string, {
        api_host: API_HOST,
        capture_pageview: !declined,
        capture_pageleave: !declined,
        // Privacy-first defaults (2026-10-14): no autocapture, no person
        // profiles — before consent only anonymous page counts fire, and
        // even after consent the app emits only its typed events.
        autocapture: false,
        person_profiles: 'never',
      });
      // Migration source tagging: every event this app emits carries
      // implementation_source='nextjs' (static build uses 'legacy_static').
      // Test-traffic tagging: every event carries traffic_type so owner
      // test runs (?aa_test=1) can be filtered out of real reporting.
      posthog.register({
        [SOURCE_PROPERTY]: ANALYTICS_SOURCE,
        traffic_type: currentTrafficType(),
      });
      // Reconcile capture with the persisted consent choice on every
      // load: a past decline stays opted out until the visitor changes
      // it on the privacy page.
      if (currentConsentState() === 'declined') {
        posthog.opt_out_capturing();
      }
    });
  }
  return initPromise;
}

/**
 * Apply a consent state change to the live PostHog instance (called by
 * the consent UI via lib/personalization/client.ts). accepted → capture
 * on; declined → opt_out_capturing() (nothing fires at all); unknown
 * (after a withdrawal reset) → capture back on, but track() stays gated
 * so only anonymous page counts flow until a fresh choice.
 */
export async function applyAnalyticsConsent(state: ConsentState): Promise<void> {
  if (typeof window === 'undefined' || !isConfigured()) return;
  try {
    await initPostHog();
    const { default: posthog } = await import('posthog-js');
    if (state === 'declined') {
      posthog.opt_out_capturing();
    } else {
      posthog.opt_in_capturing();
    }
    posthog.register({ traffic_type: currentTrafficType() });
  } catch {
    /* analytics failures are never customer-facing */
  }
}

/**
 * Event names the browser may emit — client-owned events only.
 * The type system refuses server-owned events here: the browser can never
 * attest an authoritative business transition (see EVENT_OWNERSHIP §6).
 */
export type ClientEventName = {
  [K in AnalyticsEventName]: (typeof EVENT_OWNERSHIP)[K] extends 'client'
    ? K
    : never;
}[AnalyticsEventName];

/**
 * Single choke point for client event payloads: stamps the migration
 * source property on EVERY event, so no caller can forget it. Pure and
 * testable — works with or without a configured key.
 */
export function buildEventPayload<E extends AnalyticsEventName>(
  props: AnalyticsEventProperties[E],
): AnalyticsEventProperties[E] & { implementation_source: 'nextjs' } {
  return { ...props, [SOURCE_PROPERTY]: ANALYTICS_SOURCE };
}

/**
 * Typed event tracking. Drops silently when unconfigured (no key yet) —
 * analytics must never break the customer experience.
 * Chained after init so capture can never fire before initialization.
 */
export function track<E extends ClientEventName>(
  event: E,
  props: AnalyticsEventProperties[E],
): void {
  if (!isConfigured()) return;
  // Consent gate (2026-10-14): detailed events only after acceptance.
  if (!hasDetailConsent()) return;
  const payload = buildEventPayload(props);
  initPostHog()
    .then(() => import('posthog-js'))
    .then(({ default: posthog }) => {
      posthog.capture(event, payload as Record<string, unknown>);
    })
    .catch(() => {
      /* analytics failures are never customer-facing */
    });
}

/**
 * Idempotent variant for once-per-session events (e.g. ritual_completed):
 * guarded by a key so re-renders and back-navigation can't double-fire.
 */
const firedKeys = new Set<string>();
export function trackOnce<E extends ClientEventName>(
  key: string,
  event: E,
  props: AnalyticsEventProperties[E],
): void {
  if (firedKeys.has(key)) return;
  firedKeys.add(key);
  track(event, props);
}

/** Test hook: is the tracker live right now? */
export function isPostHogLive(): boolean {
  return isConfigured() && initPromise !== null;
}
