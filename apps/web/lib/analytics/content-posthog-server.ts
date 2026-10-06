/**
 * PostHog SERVER-side capture for the content event taxonomy.
 *
 * Records accepted leads/signups as observed facts — the lead store is the
 * authority, never this event.
 *
 * SERVER-ONLY: never import this module from a client component.
 *
 * Inert without NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: <redacted>
 * fire-and-forget; acceptance never waits on analytics.
 * Status: WIRED — BLOCKED on the owner's phc_ key.
 */
import { ANALYTICS_SOURCE, SOURCE_PROPERTY } from './events';
import {
  CONTENT_EVENT_OWNERSHIP,
  type ContentAnalyticsEventProperties,
  type ContentServerEventName,
} from './content-events';

/**
 * Server-side capture for server-owned content events. Returns true when
 * PostHog accepted the event, false when skipped or on any failure.
 * Never throws.
 */
export async function captureContentServerEvent<E extends ContentServerEventName>(
  event: E,
  props: ContentAnalyticsEventProperties[E],
  distinctId: string,
): Promise<boolean> {
  const owner = CONTENT_EVENT_OWNERSHIP[event];
  if (owner !== 'server') return false;
  const token =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
      : undefined;
  if (
    !token ||
    token === 'POSTHOG_KEY_PLACEHOLDER' ||
    token.startsWith('REPLACE_')
  ) {
    return false;
  }
  const host = (
    (typeof process !== 'undefined' &&
      process.env.NEXT_PUBLIC_POSTHOG_HOST) ||
    'https://us.posthog.com'
  ).replace(/\/+$/, '');
  try {
    const res = await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: token,
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
 * blocking the response and swallows every failure.
 */
export function captureContentServerEventSoon<E extends ContentServerEventName>(
  event: E,
  props: ContentAnalyticsEventProperties[E],
  distinctId: string,
): void {
  void captureContentServerEvent(event, props, distinctId).catch(() => {
    /* analytics failures are never customer-facing */
  });
}

/** Test hook: is server content capture configured right now? */
export function isContentServerCaptureConfigured(): boolean {
  const token =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
      : undefined;
  return (
    !!token &&
    token !== 'POSTHOG_KEY_PLACEHOLDER' &&
    !token.startsWith('REPLACE_')
  );
}
