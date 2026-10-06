/**
 * PostHog CLIENT tracker for the content event taxonomy (G4, G6, G7,
 * G15, G16). Server-side capture lives in ./content-posthog-server.ts.
 *
 * Typed track() for client-owned content events only, reusing the single
 * posthog-js init (./posthog.ts). Fully inert without
 * NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN — no network calls, no throws.
 * Analytics never breaks the customer experience.
 * Status: WIRED — BLOCKED on the owner's phc_ key.
 */
import { initPostHog } from './posthog';
import {
  CONTENT_ANALYTICS_EVENT_NAMES,
  CONTENT_EVENT_OWNERSHIP,
  buildContentEventPayload,
  type ContentAnalyticsEventProperties,
  type ContentClientEventName,
} from './content-events';

const PROJECT_TOKEN =
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
    : undefined;

function isConfigured(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!PROJECT_TOKEN &&
    PROJECT_TOKEN !== 'POSTHOG_KEY_PLACEHOLDER' &&
    !PROJECT_TOKEN.startsWith('REPLACE_')
  );
}

/**
 * Typed client tracker for content events. Drops silently when
 * unconfigured. Call only from event handlers / confirmed transitions —
 * never from render paths.
 */
export function trackContent<E extends ContentClientEventName>(
  event: E,
  props: ContentAnalyticsEventProperties[E],
): void {
  // Runtime backstop (the type system already enforces this): server-owned
  // events can never be attested by the browser.
  const owner = CONTENT_EVENT_OWNERSHIP[event];
  if (owner !== 'client') return;
  if (!isConfigured()) return;
  const payload = buildContentEventPayload(props);
  initPostHog()
    .then(() => import('posthog-js'))
    .then(({ default: posthog }) => {
      posthog.capture(event, payload as Record<string, unknown>);
    })
    .catch(() => {
      /* analytics failures are never customer-facing */
    });
}

/** Idempotent variant — one fire per key per session. */
const firedKeys = new Set<string>();
export function trackContentOnce<E extends ContentClientEventName>(
  key: string,
  event: E,
  props: ContentAnalyticsEventProperties[E],
): void {
  if (firedKeys.has(key)) return;
  firedKeys.add(key);
  trackContent(event, props);
}

export { CONTENT_ANALYTICS_EVENT_NAMES };
