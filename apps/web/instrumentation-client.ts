/**
 * PostHog's documented Next.js client entry point (next@15
 * instrumentation-client.ts). Runs once when the client bundle boots —
 * before any page renders — so PostHog is ready for the earliest
 * interactions.
 *
 * LOCATION MATTERS: this file must sit at the project root (next to
 * app/). It previously lived inside app/, where Next never picked it
 * up — the eager init silently never ran and $pageview depended on some
 * tracked interaction happening first. Moved 2026-10-14 as part of the
 * consent-gate work, which needs the anonymous page count to fire on
 * every page before any consent choice exists.
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
import { initPostHog } from './lib/analytics/posthog';

initPostHog().catch(() => {
  /* analytics failures are never customer-facing */
});
