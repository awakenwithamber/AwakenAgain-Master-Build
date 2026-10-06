/**
 * PostHog platform events — G11 (Lunna chat), G12 (admin), G14 (PWA).
 *
 * SEPARATE FILE BY DESIGN: the coordinator merges this taxonomy into
 * lib/analytics/events.ts. Until then, this module is the single source of
 * truth for these event names and property schemas. Nothing here edits
 * events.ts; nothing here renames anything in events.ts.
 *
 * Same laws as the core taxonomy:
 * - snake_case names, past-tense verbs, one event per user action.
 * - Every event carries implementation_source='nextjs' (stamped here).
 * - NO PII, payment data, or secrets in any property — chat messages are
 *   never captured; only message length + provider id. Admin events carry
 *   section names only, never order/customer data.
 * - Status vocabulary: WIRED (code exists) / BLOCKED (waiting on the
 *   owner's phc_ key). Analytics is NEVER marked IMPLEMENTED here.
 *
 * PostHog stays observational: admin views observe operator behavior; the
 * order ledger / database remains authoritative.
 *
 * TRACEABILITY (owner directive 2026-10-05 ~17:45 MDT: every addition needs
 * name → reason → legacy equivalent → owner → purpose):
 *
 * | name              | reason added                              | legacy equivalent                          | owner  | purpose                                                        |
 * |-------------------|-------------------------------------------|--------------------------------------------|--------|----------------------------------------------------------------|
 * | chat_opened       | measure Lunna concierge adoption (G11)    | none (legacy chat had no analytics)        | client | funnel: open → message; concierge usefulness                   |
 * | chat_message_sent | measure engagement depth; provider id for | none (legacy chat had no analytics)        | client | message volume + which provider served (post-binding compare)  |
 * |                   | post-provider-binding comparison          |                                            |        |                                                                |
 * | admin_viewed      | internal ops visibility (G12)             | none (legacy admin.html untracked)         | client | which ops views get used; internal only, never customer funnels |
 * | pwa_installed     | measure PWA installability success (G14)  | none (legacy manifest untracked)           | client | install conversion for the standalone experience               |
 *
 * All four are NET-NEW (no legacy PostHog equivalent); they do not
 * duplicate any of the 22 core taxonomy events — names are disjoint by
 * construction (enforced by platform-events.test.ts).
 */
import { ANALYTICS_SOURCE, SOURCE_PROPERTY } from './events';

/** Canonical platform event names. Add new events here — never inline a string elsewhere. */
export const PLATFORM_EVENT_NAMES = {
  /** Lunna concierge preview opened (G11). */
  chatOpened: 'chat_opened',
  /** Customer sent a message to Lunna (G11). */
  chatMessageSent: 'chat_message_sent',
  /** Operator viewed an admin section (G12). Internal only. */
  adminViewed: 'admin_viewed',
  /** Browser fired the PWA appinstalled event (G14). */
  pwaInstalled: 'pwa_installed',
} as const;

export type PlatformEventName =
  (typeof PLATFORM_EVENT_NAMES)[keyof typeof PLATFORM_EVENT_NAMES];

export type AdminSectionName = 'overview' | 'orders' | 'leads' | 'reviews' | 'broadcast';

/** Property schema per event. Invalid payloads fail at compile time. */
export interface PlatformEventProperties {
  chat_opened: { surface: 'widget' };
  /**
   * Message content is NEVER captured — length + provider id only.
   * (Chat content could contain health questions; it stays out of analytics.)
   */
  chat_message_sent: { message_length: number; provider_id: string };
  /** Section name only — never order/customer data. */
  admin_viewed: { section: AdminSectionName };
  pwa_installed: Record<string, never>;
}

/** Compile-time-checked properties for a platform event name. */
export type PlatformEventProps<E extends PlatformEventName = PlatformEventName> =
  PlatformEventProperties[E];

export type PlatformEventOwner = 'client';

/**
 * Ownership: all four platform events are client-owned — only the browser
 * observes a chat interaction, an admin page view, or a PWA install.
 */
export const PLATFORM_EVENT_OWNERSHIP = {
  chat_opened: 'client',
  chat_message_sent: 'client',
  admin_viewed: 'client',
  pwa_installed: 'client',
} satisfies Record<PlatformEventName, PlatformEventOwner>;

/**
 * Single choke point for platform event payloads: stamps the migration
 * source property on EVERY event. Pure and testable — works with or
 * without a configured key.
 */
export function buildPlatformEventPayload<E extends PlatformEventName>(
  props: PlatformEventProperties[E],
): PlatformEventProperties[E] & { implementation_source: 'nextjs' } {
  return { ...props, [SOURCE_PROPERTY]: ANALYTICS_SOURCE };
}

function isConfigured(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN !== 'POSTHOG_KEY_PLACEHOLDER' &&
    !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN.startsWith('REPLACE_')
  );
}

let initPromise: Promise<void> | null = null;

function initOnce(): Promise<void> {
  if (typeof window === 'undefined' || !isConfigured()) return Promise.resolve();
  if (!initPromise) {
    initPromise = import('posthog-js').then(({ default: posthog }) => {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN as string, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.posthog.com',
        capture_pageview: false,
        capture_pageleave: false,
      });
      posthog.register({ [SOURCE_PROPERTY]: ANALYTICS_SOURCE });
    });
  }
  return initPromise;
}

/**
 * Typed platform event tracking. Drops silently when unconfigured (no key
 * yet) — analytics must never break the experience. Fire-and-forget;
 * failures are never customer-facing.
 */
export function trackPlatformEvent<E extends PlatformEventName>(
  event: E,
  props: PlatformEventProperties[E],
): void {
  if (!isConfigured()) return;
  const payload = buildPlatformEventPayload(props);
  initOnce()
    .then(() => import('posthog-js'))
    .then(({ default: posthog }) => {
      posthog.capture(event, payload as Record<string, unknown>);
    })
    .catch(() => {
      /* analytics failures are never user-facing */
    });
}

/**
 * Idempotent variant for once-per-page events (e.g. admin_viewed):
 * guarded by a key so re-renders can't double-fire.
 */
const firedKeys = new Set<string>();
export function trackPlatformEventOnce<E extends PlatformEventName>(
  key: string,
  event: E,
  props: PlatformEventProperties[E],
): void {
  if (firedKeys.has(key)) return;
  firedKeys.add(key);
  trackPlatformEvent(event, props);
}

/** The platform taxonomy count is a contract — bump deliberately, not accidentally. */
export const PLATFORM_EVENT_COUNT = 4;
