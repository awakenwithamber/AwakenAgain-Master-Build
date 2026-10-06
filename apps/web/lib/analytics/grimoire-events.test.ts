/**
 * ANALYTICS CONTRACT TESTS — Grimoire / subscription / OTP / jobs (Workstream 4).
 *
 * Laws under test:
 * - Every event in this module carries implementation_source='nextjs'
 *   (client via buildGrimoireEventPayload, server via explicit property).
 * - The type system refuses server-owned events on the client tracker:
 *   the browser can never attest an authoritative business transition.
 * - No event payload contains PII, payment details, OTP codes, or secrets —
 *   scanned at runtime over representative payloads for all 5 events.
 * - Server capture is inert without a project token: no fetch, no throw.
 * - With a token set, capture posts a minimal, source-tagged payload.
 *
 * Status vocabulary: WIRED (code exists) / BLOCKED (waiting on the owner's
 * phc_ key). Analytics is NEVER marked IMPLEMENTED here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS_SOURCE, SOURCE_PROPERTY } from './events';
import {
  GRIMOIRE_ANALYTICS_EVENT_NAMES,
  GRIMOIRE_EVENT_OWNERSHIP,
  buildGrimoireEventPayload,
  captureGrimoireServerEvent,
  isGrimoireServerCaptureConfigured,
  resolveGrimoireServerDistinctId,
  type GrimoireAnalyticsEventName,
  type GrimoireAnalyticsEventProperties,
} from './grimoire-events';

/** Representative, PII-free payload for every event — compile-time checked. */
const SAMPLES: { [K in GrimoireAnalyticsEventName]: GrimoireAnalyticsEventProperties[K] } = {
  grimoire_subscribe_started: { plan_id: 'living-grimoire-monthly', price_cents: 777 },
  subscription_created: {
    subscription_id: 'SUB-20261005-ABC123',
    status: 'pending_payment',
    plan_id: 'living-grimoire-monthly',
    price_cents: 777,
  },
  otp_requested: { request_id: 'otp_abc123', purpose: 'grimoire_gate' },
  otp_verified: { request_id: 'otp_abc123', purpose: 'grimoire_gate' },
  email_job_queued: {
    job_id: 'EMAIL-20261005-ABC123',
    template: 'purchase_confirmation',
  },
};

const FORBIDDEN_PATTERNS = [
  /@[a-z0-9.-]+\.[a-z]{2,}/i, // email
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, // phone
  /\$AmberPatten/i, // payment handle
  /@AwakenwithAmber/i, // payment handle
  /posthog|phc_|sk_|secret|password|token(?!_)/i,
];

function allValues(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(allValues);
  }
  return [value];
}

describe('grimoire analytics contracts', () => {
  it('all five events are defined with ownership', () => {
    const names = Object.values(GRIMOIRE_ANALYTICS_EVENT_NAMES);
    expect(names).toHaveLength(5);
    for (const name of names) {
      expect(GRIMOIRE_EVENT_OWNERSHIP[name]).toMatch(/^(client|server)$/);
    }
    expect(GRIMOIRE_EVENT_OWNERSHIP.grimoire_subscribe_started).toBe('client');
    expect(GRIMOIRE_EVENT_OWNERSHIP.subscription_created).toBe('server');
    expect(GRIMOIRE_EVENT_OWNERSHIP.otp_requested).toBe('server');
    expect(GRIMOIRE_EVENT_OWNERSHIP.otp_verified).toBe('server');
    expect(GRIMOIRE_EVENT_OWNERSHIP.email_job_queued).toBe('server');
  });

  it('client payloads are stamped implementation_source=nextjs', () => {
    const payload = buildGrimoireEventPayload(
      GRIMOIRE_ANALYTICS_EVENT_NAMES.grimoireSubscribeStarted,
      SAMPLES.grimoire_subscribe_started,
    );
    expect(payload[SOURCE_PROPERTY]).toBe('nextjs');
    expect(payload[SOURCE_PROPERTY]).toBe(ANALYTICS_SOURCE);
  });

  it('no representative payload contains PII, payment data, OTP codes, or secrets', () => {
    for (const [name, sample] of Object.entries(SAMPLES)) {
      for (const value of allValues(sample)) {
        const text = String(value);
        for (const pattern of FORBIDDEN_PATTERNS) {
          expect(text, `event ${name}: forbidden pattern in "${text}"`).not.toMatch(pattern);
        }
      }
    }
    // OTP codes specifically never enter analytics.
    const serialized = JSON.stringify(SAMPLES);
    expect(serialized).not.toMatch(/\b\d{6}\b/);
  });

  it('server capture refuses server-owned-only events on the client path (type-level)', () => {
    // Compile-time: trackGrimoireEvent only accepts GrimoireClientEventName.
    // Runtime witness: the client-name union has exactly one member.
    const clientNames = (Object.keys(GRIMOIRE_EVENT_OWNERSHIP) as GrimoireAnalyticsEventName[])
      .filter((n) => GRIMOIRE_EVENT_OWNERSHIP[n] === 'client');
    expect(clientNames).toEqual(['grimoire_subscribe_started']);
  });
});

describe('grimoire server capture', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllGlobals();
  });

  it('is inert without a project token: no fetch, no throw', () => {
    expect(isGrimoireServerCaptureConfigured()).toBe(false);
    expect(() =>
      captureGrimoireServerEvent(
        GRIMOIRE_ANALYTICS_EVENT_NAMES.subscriptionCreated,
        SAMPLES.subscription_created,
        'server-test-id',
      ),
    ).not.toThrow();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('placeholder tokens are treated as unconfigured', () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'POSTHOG_KEY_PLACEHOLDER';
    expect(isGrimoireServerCaptureConfigured()).toBe(false);
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'REPLACE_ME';
    expect(isGrimoireServerCaptureConfigured()).toBe(false);
  });

  it('with a token, posts a source-tagged payload to /capture/', () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'phc_testtoken123';
    captureGrimoireServerEvent(
      GRIMOIRE_ANALYTICS_EVENT_NAMES.otpRequested,
      SAMPLES.otp_requested,
      'server-test-id',
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe('https://us.posthog.com/capture/');
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.event).toBe('otp_requested');
    expect(body.distinct_id).toBe('server-test-id');
    expect(body.properties.implementation_source).toBe('nextjs');
    expect(body.api_key).toBe('phc_testtoken123');
  });
});

describe('resolveGrimoireServerDistinctId', () => {
  it('prefers the browser-set posthog cookie identity', () => {
    const cookie = `ph_phc_test_posthog=${encodeURIComponent(
      JSON.stringify({ distinct_id: 'browser-abc' }),
    )}`;
    expect(resolveGrimoireServerDistinctId(cookie, 'fallback')).toBe('browser-abc');
  });

  it('falls back to the PII-free server identity', () => {
    expect(resolveGrimoireServerDistinctId(null, 'subscription:SUB-1')).toBe('subscription:SUB-1');
    expect(resolveGrimoireServerDistinctId('other=1', 'fallback')).toBe('fallback');
  });
});
