/**
 * REGRESSION SUITE — PostHog analytics contracts (migration phase).
 *
 * Laws under test:
 * - Every event emitted by this Next.js app carries
 *   implementation_source='nextjs' (the staged static build uses
 *   'legacy_static') — stamped by buildEventPayload(), the single choke
 *   point for client payloads, and explicitly on server captures. This is
 *   what prevents double counting while both surfaces are live.
 * - The type system refuses server-owned events on the client tracker:
 *   the browser can never attest an authoritative business transition.
 * - No event payload (client or server) contains PII, payment details, or
 *   secrets — scanned at runtime over representative payloads for all 22
 *   events, not just the schema keys.
 * - Server capture is inert without a project token (no fetch, no throw)
 *   and posts a minimal, source-tagged payload with a key present.
 * - app/instrumentation-client.ts is PostHog's Next.js entry point and
 *   carries no hard-coded key.
 *
 * Status vocabulary: WIRED (code exists) / BLOCKED (waiting on the owner's
 * phc_ key). Analytics is NEVER marked IMPLEMENTED here.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_SOURCE,
  LEGACY_ANALYTICS_SOURCE,
  SOURCE_PROPERTY,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
} from './events';
import { buildEventPayload, track } from './posthog';
import {
  captureServerEvent,
  captureServerEventSoon,
  isServerCaptureConfigured,
  resolveServerDistinctId,
} from './posthog-server';

/** Representative, PII-free payload for every event — compile-time checked. */
const SAMPLES: { [K in AnalyticsEventName]: AnalyticsEventProperties[K] } = {
  builder_step_viewed: { step: 3, step_name: 'scent' },
  ritual_completed: {},
  base_selected: { base: 'goat-milk-shea' },
  shape_selected: { shape: 'large-wave-rectangle' },
  scent_selected: {
    path: 'custom_blend',
    oils: ['lavender', 'frankincense'],
    oil_count: 2,
    profile_tags: ['floral', 'grounding'],
  },
  blend_oil_toggled: { oil_id: 'lavender', selected: true, oil_count: 1 },
  blend_completed: {
    oils: ['lavender', 'frankincense', 'cedarwood'],
    profile_tags: ['floral', 'grounding', 'woody'],
    oil_count: 3,
  },
  botanical_selected: { botanical: 'rose-petals' },
  color_selected: { color_name: 'Rose Quartz', color_hex: '#e8b4b8', custom: false },
  soap_added_to_cart: {
    base: 'goat-milk-shea',
    shape: 'large-wave-rectangle',
    scent: { type: 'signature', recipe_id: 'moonlit-lavender' },
    botanical: 'lavender',
    color: 'custom#8a5a3b',
    bundle_mode: false,
  },
  cart_updated: { action: 'qty_change', product_handle: 'lavender-soap', qty: 2 },
  bundle_opened: {},
  bundle_slot_configured: {
    via: 'theme_apply',
    slot_index: 0,
    shape: 'large-wave-rectangle',
    base: 'goat-milk-shea',
    scent_path: 'signature',
    recipe_id: 'moonlit-lavender',
    botanical: 'lavender',
    color: 'Rose Quartz',
  },
  bundle_added_to_cart: {
    bundle_id: 'soap-style-collection-5',
    price_cents: 3577,
    savings_cents: 1208,
    slot_count: 5,
    slots: [],
  },
  shop_scent_card_clicked: { recipe_id: 'moonlit-lavender' },
  shop_bundle_card_clicked: { bundle_id: 'soap-style-collection-5' },
  seasonal_scent_interacted: { season_id: 'pumpkin-spice-oct-2026' },
  checkout_initiated: {},
  product_viewed: { product_handle: 'lavender-soap', category: 'Soaps' },
  payment_instructions_viewed: { order_id: 'AWK-TEST-0001' },
  order_completed: { order_id: 'AWK-TEST-0001', total_cents: 3577, item_count: 5 },
  order_created: { order_id: 'AWK-TEST-0001', total_cents: 3577, item_count: 5 },
};

describe('implementation-source tagging (migration)', () => {
  it("source property name and Next.js value are the documented constants", () => {
    expect(SOURCE_PROPERTY).toBe('implementation_source');
    expect(ANALYTICS_SOURCE).toBe('nextjs');
    expect(LEGACY_ANALYTICS_SOURCE).toBe('legacy_static');
    expect(ANALYTICS_SOURCE).not.toBe(LEGACY_ANALYTICS_SOURCE);
  });

  it('every event payload carries implementation_source=nextjs', () => {
    const names = Object.values(ANALYTICS_EVENT_NAMES) as AnalyticsEventName[];
    expect(names).toHaveLength(22);
    for (const name of names) {
      const payload = buildEventPayload(SAMPLES[name] as never) as Record<
        string,
        unknown
      >;
      expect(payload[SOURCE_PROPERTY], `missing source on ${name}`).toBe(
        'nextjs',
      );
    }
  });

  it('stamping never mutates the caller payload', () => {
    const props = { step: 1, step_name: 'base' } as const;
    const stamped = buildEventPayload(props);
    expect(stamped).not.toBe(props);
    expect('implementation_source' in props).toBe(false);
  });
});

describe('client/server boundary is type-enforced', () => {
  it('track() refuses server-owned events at compile time', () => {
    // @ts-expect-error — the browser must never attest order_created.
    track('order_created', {
      order_id: 'AWK-TEST-0001',
      total_cents: 3577,
      item_count: 5,
    });
  });
});

describe('event payloads are PII / payment / secret free (runtime scan)', () => {
  const FORBIDDEN_VALUE_PATTERNS: RegExp[] = [
    // email addresses
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    // phone numbers (US-style 10 digit)
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    // payment handles — Cash App / Venmo must NEVER appear in analytics
    /\$Amber[A-Za-z0-9]*/i,
    /@AwakenwithAmber/i,
    /\bvenmo\b/i,
    /\bcash[\s_-]?app\b/i,
    // cards, secrets, credentials
    /\b\d{13,19}\b/, // card-number-like digit runs
    /\b(cvv|cvc|secret|password|passwd|credential|private[_-]?key|ssn)\b/i,
  ];

  it('no stamped payload for any of the 22 events matches a forbidden pattern', () => {
    const names = Object.values(ANALYTICS_EVENT_NAMES) as AnalyticsEventName[];
    const violations: string[] = [];
    for (const name of names) {
      const payload = buildEventPayload(SAMPLES[name] as never);
      const json = JSON.stringify(payload);
      for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
        if (pattern.test(json)) {
          violations.push(`${name}: value matches ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('server order_created carries order_id/total_cents/item_count ONLY (+ source)', () => {
    const payload = buildEventPayload(SAMPLES.order_created) as Record<
      string,
      unknown
    >;
    const keys = Object.keys(payload).sort();
    expect(keys).toEqual(
      ['implementation_source', 'item_count', 'order_id', 'total_cents'].sort(),
    );
  });
});

describe('server capture (lib/analytics/posthog-server.ts)', () => {
  const ENV_KEY = 'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN';
  const ENV_HOST = 'NEXT_PUBLIC_POSTHOG_HOST';
  let savedKey: string | undefined;
  let savedHost: string | undefined;

  beforeEach(() => {
    savedKey = process.env[ENV_KEY];
    savedHost = process.env[ENV_HOST];
    delete process.env[ENV_KEY];
    delete process.env[ENV_HOST];
  });

  afterEach(() => {
    if (savedKey === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = savedKey;
    if (savedHost === undefined) delete process.env[ENV_HOST];
    else process.env[ENV_HOST] = savedHost;
    vi.unstubAllGlobals();
  });

  it('is inert without a key: no fetch, no throw, reports unconfigured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(isServerCaptureConfigured()).toBe(false);
    await expect(
      captureServerEvent(
        'order_created',
        { order_id: 'AWK-TEST-0001', total_cents: 3577, item_count: 5 },
        'server:order:AWK-TEST-0001',
      ),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(() =>
      captureServerEventSoon(
        'order_created',
        { order_id: 'AWK-TEST-0001', total_cents: 3577, item_count: 5 },
        'server:order:AWK-TEST-0001',
      ),
    ).not.toThrow();
  });

  it('placeholder tokens are treated as unconfigured', () => {
    process.env[ENV_KEY] = 'POSTHOG_KEY_PLACEHOLDER';
    expect(isServerCaptureConfigured()).toBe(false);
    process.env[ENV_KEY] = 'REPLACE_WITH_KEY';
    expect(isServerCaptureConfigured()).toBe(false);
  });

  it('with a key: POSTs a minimal source-tagged payload to /capture/', async () => {
    process.env[ENV_KEY] = 'phc_testkey123';
    process.env[ENV_HOST] = 'https://us.posthog.com';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await captureServerEvent(
      'order_created',
      { order_id: 'AWK-TEST-0001', total_cents: 3577, item_count: 5 },
      'customer-distinct-id',
    );

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://us.posthog.com/capture/');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as {
      api_key: string;
      event: string;
      distinct_id: string;
      properties: Record<string, unknown>;
    };
    expect(body.api_key).toBe('phc_testkey123');
    expect(body.event).toBe('order_created');
    expect(body.distinct_id).toBe('customer-distinct-id');
    expect(body.properties.implementation_source).toBe('nextjs');
    expect(Object.keys(body.properties).sort()).toEqual(
      ['implementation_source', 'item_count', 'order_id', 'total_cents'].sort(),
    );
  });

  it('capture failure resolves false — never rejects into the order flow', async () => {
    process.env[ENV_KEY] = 'phc_testkey123';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );
    await expect(
      captureServerEvent(
        'order_created',
        { order_id: 'AWK-TEST-0001', total_cents: 3577, item_count: 5 },
        'server:order:AWK-TEST-0001',
      ),
    ).resolves.toBe(false);
  });

  it('resolveServerDistinctId prefers the PostHog browser cookie', () => {
    const cookie =
      `ph_phc_testkey123_posthog=${encodeURIComponent(
        JSON.stringify({ distinct_id: 'browser-abc', $device_id: 'dev-1' }),
      )}; other=1`;
    expect(resolveServerDistinctId(cookie, 'order:AWK-1')).toBe('browser-abc');
  });

  it('resolveServerDistinctId falls back to a PII-free server identity', () => {
    expect(resolveServerDistinctId(null, 'order:AWK-1')).toBe(
      'server:order:AWK-1',
    );
    expect(
      resolveServerDistinctId('ph_x_posthog=not-json{{{', 'order:AWK-1'),
    ).toBe('server:order:AWK-1');
  });
});

describe('instrumentation-client.ts (Next.js client entry point)', () => {
  it('delegates to initPostHog and carries no hard-coded key', () => {
    const src = readFileSync(
      new URL('../../app/instrumentation-client.ts', import.meta.url),
      'utf8',
    );
    expect(src).toContain('initPostHog');
    expect(src).not.toMatch(/phc_[A-Za-z0-9]+/);
    expect(src).not.toContain('POSTHOG_KEY_PLACEHOLDER');
    expect(src).toMatch(/inert/i);
  });
});
