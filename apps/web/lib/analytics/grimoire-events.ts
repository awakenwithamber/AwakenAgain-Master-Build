/**
 * PostHog event taxonomy — Grimoire / subscription / OTP / jobs (Workstream 4).
 *
 * DO NOT merge into lib/analytics/events.ts here — the coordinator merges.
 * This module owns the Workstream-4 event names, property schemas, and
 * ownership so the features can emit events today; merge = union these
 * entries into the canonical taxonomy.
 *
 * Conventions mirror events.ts:
 * - snake_case names, past-tense verbs, one event per user action.
 * - Every event carries implementation_source='nextjs' (super property on
 *   the client via trackGrimoireEvent, explicit payload property on the
 *   server). The staged static build uses 'legacy_static'.
 * - CLIENT=PREVIEW / SERVER=AUTHORITY: only server-owned events may be
 *   captured here — the browser can never attest an authoritative business
 *   transition (subscription created, OTP verified, job queued).
 * - NO PII, payment data, or secrets in any property. Server events carry
 *   IDs/status/price only. OTP codes NEVER appear in analytics.
 * - PostHog is observational only — the ledger/database is authoritative.
 *   Status vocabulary: WIRED (code exists) / BLOCKED (waiting on the
 *   owner's phc_ key). Analytics is NEVER marked IMPLEMENTED here.
 */
import { ANALYTICS_SOURCE, SOURCE_PROPERTY } from './events';

/* ------------------------------------------------------------------ */
/* Event names (Workstream 4)                                           */
/* ------------------------------------------------------------------ */

export const GRIMOIRE_ANALYTICS_EVENT_NAMES = {
  /** Client: customer started the Living Grimoire signup form. */
  grimoireSubscribeStarted: 'grimoire_subscribe_started',
  /**
   * Server-owned: the subscriptions Route Handler accepted and persisted
   * the record. RECORDS the fact — it is not the authority itself; the
   * subscriptions ledger is.
   */
  subscriptionCreated: 'subscription_created',
  /** Server-owned: an OTP code was issued for the Grimoire gate. */
  otpRequested: 'otp_requested',
  /** Server-owned: an OTP code was verified; a session was issued. */
  otpVerified: 'otp_verified',
  /** Server-owned: an email job was validated and queued (no real sends). */
  emailJobQueued: 'email_job_queued',
} as const;

export type GrimoireAnalyticsEventName =
  (typeof GRIMOIRE_ANALYTICS_EVENT_NAMES)[keyof typeof GRIMOIRE_ANALYTICS_EVENT_NAMES];

/* ------------------------------------------------------------------ */
/* Property schemas                                                     */
/* ------------------------------------------------------------------ */

export interface GrimoireAnalyticsEventProperties {
  grimoire_subscribe_started: { plan_id: string; price_cents: number };
  subscription_created: {
    subscription_id: string;
    status: 'pending_payment';
    plan_id: string;
    price_cents: number;
  };
  otp_requested: { request_id: string; purpose: 'grimoire_gate' };
  otp_verified: { request_id: string; purpose: 'grimoire_gate' };
  email_job_queued: {
    job_id: string;
    template: 'purchase_confirmation' | 'weekly_promo' | 'unsubscribe_confirmation' | 'review_reminder';
  };
}

type GrimoireEventOwner = 'client' | 'server';

export const GRIMOIRE_EVENT_OWNERSHIP = {
  grimoire_subscribe_started: 'client',
  subscription_created: 'server',
  otp_requested: 'server',
  otp_verified: 'server',
  email_job_queued: 'server',
} satisfies Record<GrimoireAnalyticsEventName, GrimoireEventOwner>;

export type GrimoireClientEventName = {
  [K in GrimoireAnalyticsEventName]: (typeof GRIMOIRE_EVENT_OWNERSHIP)[K] extends 'client'
    ? K
    : never;
}[GrimoireAnalyticsEventName];

export type GrimoireServerEventName = {
  [K in GrimoireAnalyticsEventName]: (typeof GRIMOIRE_EVENT_OWNERSHIP)[K] extends 'server'
    ? K
    : never;
}[GrimoireAnalyticsEventName];

/* ------------------------------------------------------------------ */
/* Client capture — SINGLE CHOKE POINT                                  */
/* ------------------------------------------------------------------ */

/**
 * Build the client payload: stamps implementation_source='nextjs'.
 * Client events never carry PII — the subscribe-started event carries
 * plan_id/price_cents only.
 */
export function buildGrimoireEventPayload<N extends GrimoireClientEventName>(
  name: N,
  properties: GrimoireAnalyticsEventProperties[N],
): GrimoireAnalyticsEventProperties[N] & { implementation_source: 'nextjs' } {
  return { ...properties, [SOURCE_PROPERTY]: ANALYTICS_SOURCE };
}

/**
 * CLIENT-ONLY track helper. Calls init-less posthog lazily: fully inert
 * when the project token is absent or this is not a browser. Never throws.
 */
export function trackGrimoireEvent<N extends GrimoireClientEventName>(
  name: N,
  properties: GrimoireAnalyticsEventProperties[N],
): void {
  if (typeof window === 'undefined') return;
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token || token === 'POSTHOG_KEY_PLACEHOLDER' || token.startsWith('REPLACE_')) {
    return;
  }
  import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.capture(name, buildGrimoireEventPayload(name, properties));
    })
    .catch(() => {
      /* analytics must never break the experience */
    });
}

/* ------------------------------------------------------------------ */
/* Server capture — SERVER ONLY (never import from a client component)  */
/* ------------------------------------------------------------------ */

const PLACEHOLDER_PATTERNS = ['POSTHOG_KEY_PLACEHOLDER', 'REPLACE_'];

interface GrimoireServerConfig {
  token: string;
  host: string;
}

/** Read fresh on every call so tests (and late-provided env) work. */
function grimoireServerConfig(): GrimoireServerConfig | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token || PLACEHOLDER_PATTERNS.some((p) => token === p || token.startsWith(p))) {
    return null;
  }
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.posthog.com').replace(
    /\/+$/,
    '',
  );
  return { token, host };
}

export function isGrimoireServerCaptureConfigured(): boolean {
  return grimoireServerConfig() !== null;
}

/**
 * Resolve the distinct_id for a server event: prefer the identity
 * posthog-js already set in the browser cookie; fall back to a stable,
 * PII-free server identity scoped to the record — never a name, email,
 * or phone.
 */
export function resolveGrimoireServerDistinctId(
  cookieHeader: string | null,
  fallback: string,
): string {
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const trimmed = part.trim();
      if (trimmed.startsWith('ph_') && trimmed.includes('_posthog=')) {
        try {
          const json = decodeURIComponent(trimmed.slice(trimmed.indexOf('=') + 1));
          const parsed = JSON.parse(json) as { distinct_id?: unknown };
          if (typeof parsed.distinct_id === 'string' && parsed.distinct_id.length > 0) {
            return parsed.distinct_id;
          }
        } catch {
          /* fall through to fallback */
        }
      }
    }
  }
  return fallback;
}

function serverPayload<N extends GrimoireServerEventName>(
  name: N,
  properties: GrimoireAnalyticsEventProperties[N],
  distinctId: string,
): Record<string, unknown> {
  return {
    api_key: grimoireServerConfig()?.token,
    event: name,
    distinct_id: distinctId,
    properties: { ...properties, [SOURCE_PROPERTY]: ANALYTICS_SOURCE },
  };
}

/**
 * Fire-and-forget server capture. Inert without a project token: performs
 * no network calls, never throws. Analytics must never break subscription
 * acceptance, OTP issuance, or job queueing.
 */
export function captureGrimoireServerEvent<N extends GrimoireServerEventName>(
  name: N,
  properties: GrimoireAnalyticsEventProperties[N],
  distinctId: string,
): void {
  const config = grimoireServerConfig();
  if (!config) return;
  const payload = serverPayload(name, properties, distinctId);
  void fetch(`${config.host}/capture/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* analytics is observational — never a failure path */
  });
}

/**
 * Defer capture past the response so acceptance latency never waits on
 * analytics. Uses queueMicrotask when available (safe in Route Handlers);
 * falls back to a direct call.
 */
export function captureGrimoireServerEventSoon<N extends GrimoireServerEventName>(
  name: N,
  properties: GrimoireAnalyticsEventProperties[N],
  distinctId: string,
): void {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(() => captureGrimoireServerEvent(name, properties, distinctId));
  } else {
    captureGrimoireServerEvent(name, properties, distinctId);
  }
}
