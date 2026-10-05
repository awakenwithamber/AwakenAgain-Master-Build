/**
 * PostHog's documented Next.js client entry point (next@15
 * instrumentation-client.ts). Runs once when the client bundle boots —
 * before any page renders — so PostHog is ready for the earliest
 * interactions.
 *
 * Delegates to the single analytics init (lib/analytics/posthog.ts):
 * initPostHog() is the ONLY place posthog-js is initialized, and it is
 * idempotent — the lazy init inside track() and this eager call cannot
 * double-initialize.
 *
 * Fully inert without NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: no errors, no
 * network calls, no console noise. Analytics must never break the customer
 * experience. Status: WIRED — BLOCKED on the owner's phc_ key.
 */
import { initPostHog } from '../lib/analytics/posthog';

initPostHog().catch(() => {
  /* analytics failures are never customer-facing */
});
