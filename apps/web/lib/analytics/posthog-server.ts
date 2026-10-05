/**
 * PostHog SERVER-side capture — for recording authoritative business
 * transitions as observed facts. (The Route Handler + order ledger are the
 * authority; these events record what was accepted, never claim to be the
 * authority itself.)
 * SERVER-ONLY: never import this module from a client component (it reads
 * process.env at call time and uses the /capture/ HTTP endpoint directly,
 * no posthog-js dependency).
 *
 * Rules:
 * - Only server-owned events may be emitted here — the event name type is
 *   constrained to EVENT_OWNERSHIP === 'server' at compile time, so the
 *   server can never duplicate a client interaction event.
 * - Fully inert without NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: returns false,
 *   performs no network calls, never throws. Analytics must never break
 *   order acceptance.
 * - PostHog is observational: the order ledger / database is authoritative.
 *   Capture is fire-and-forget — order acceptance never waits on analytics.
 * - NO PII, payment details, secrets, or auth credentials in any payload.
 *   Order events carry order_id/total_cents/item_count only.
 */
import {
  ANALYTICS_SOURCE,
  SOURCE_PROPERTY,
  type AnalyticsEventProperties,
  type ServerEventName,
} from './events';

const PLACEHOLDER_PATTERNS = ['POSTHOG_KEY_PLACEHOLDER', 'REPLACE_'];

interface ServerConfig {
  token: string;
  host: string;
}

/** Read fresh on every call so tests (and late-provided env) work. */
function serverConfig(): ServerConfig | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (
    !token ||
    PLACEHOLDER_PATTERNS.some((p) => token === p || token.startsWith(p))
  ) {
    return null;
  }
  const host = (
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.posthog.com'
  ).replace(/\/+$/, '');
  return { token, host };
}

/**
 * Resolve the PostHog distinct_id for a server event.
 *
 * Prefers the identity posthog-js already set in the browser (cookie
 * `ph_<token>_posthog`, JSON containing distinct_id) so client and server
 * events for the same customer session join in funnels. Falls back to a
 * stable, PII-free server identity scoped to the order — never a name,
 * email, or phone.
 */
export function resolveServerDistinctId(
  cookieHeader: string | null | undefined,
  fallbackScope: string,
): string {
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      if (!name.endsWith('_posthog')) continue;
      try {
        const data = JSON.parse(
          decodeURIComponent(part.slice(eq + 1).trim()),
        ) as { distinct_id?: unknown };
        if (typeof data?.distinct_id === 'string' && data.distinct_id) {
          return data.distinct_id;
        }
      } catch {
        /* malformed cookie — fall through to the fallback identity */
      }
    }
  }
  return `server:${fallbackScope}`;
}

/**
 * Capture a server-owned event. Returns true when the event was accepted
 * by PostHog, false when skipped (no key) or on any failure. Never throws.
 */
export async function captureServerEvent<E extends ServerEventName>(
  event: E,
  props: AnalyticsEventProperties[E],
  distinctId: string,
): Promise<boolean> {
  const cfg = serverConfig();
  if (!cfg) return false;
  try {
    const res = await fetch(`${cfg.host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: cfg.token,
        event,
        distinct_id: distinctId,
        properties: { ...props, [SOURCE_PROPERTY]: ANALYTICS_SOURCE },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fire-and-forget wrapper for Route Handlers: schedules the capture without
 * blocking the response and swallows every failure. Order acceptance must
 * never depend on analytics delivery.
 */
export function captureServerEventSoon<E extends ServerEventName>(
  event: E,
  props: AnalyticsEventProperties[E],
  distinctId: string,
): void {
  void captureServerEvent(event, props, distinctId).catch(() => {
    /* analytics failures are never customer-facing */
  });
}

/** Test hook: is server capture configured right now? */
export function isServerCaptureConfigured(): boolean {
  return serverConfig() !== null;
}
