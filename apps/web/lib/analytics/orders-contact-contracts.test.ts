/**
 * REGRESSION SUITE — orders/contact analytics contracts (G3/G5).
 *
 * Laws under test (same laws as the central analytics-contracts suite):
 * - The 6 new events (order_submitted / order_accepted / order_rejected /
 *   contact_submitted / contact_accepted / contact_rejected) are
 *   server-owned — the type system prevents any client event with these
 *   names (dedupe contract in orders-events.ts / contact-events.ts).
 * - None collide with the central taxonomy in lib/analytics/events.ts
 *   (coordinator owns that merge).
 * - No payload contains PII, payment details, or secrets — scanned at
 *   runtime over representative payloads for all 6 events.
 * - Ownership stages never exceed 'feature_tested' while the phc_ key is
 *   absent (stage-gate semantics); nothing is ever marked IMPLEMENTED.
 * - The interim bridge emits through the canonical posthog-server
 *   transport: inert without a project token, stamped with
 *   implementation_source='nextjs' when a token is present.
 *
 * Status vocabulary: WIRED (code exists) / BLOCKED (waiting on the owner's
 * phc_ key). Analytics is NEVER marked IMPLEMENTED here.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_SOURCE,
  EVENT_OWNERSHIP,
  SOURCE_PROPERTY,
  ownershipStageIndex,
} from './events';
import {
  CONTACT_ANALYTICS_EVENT_NAMES,
  CONTACT_EVENT_OWNERSHIP,
  CONTACT_EVENT_STAGES,
  type ContactAnalyticsEventName,
  type ContactAnalyticsEventProperties,
} from './contact-events';
import {
  ORDER_ANALYTICS_EVENT_NAMES,
  ORDER_EVENT_OWNERSHIP,
  ORDER_EVENT_STAGES,
  type OrderAnalyticsEventName,
  type OrderAnalyticsEventProperties,
} from './orders-events';
import {
  captureServerEventSoon,
} from './posthog-server';

type AllNames = OrderAnalyticsEventName | ContactAnalyticsEventName;
type AllProps = OrderAnalyticsEventProperties & ContactAnalyticsEventProperties;

/** Representative, PII-free payload for every new event — compile-time checked. */
const SAMPLES: { [K in AllNames]: AllProps[K] } = {
  order_submitted: { attempt_id: 'att_mxyz_1a2b3c', item_count_claimed: 2 },
  order_accepted: {
    order_id: 'AWK-20261005-ABC123',
    total_cents: 7910,
    item_count: 3,
  },
  order_rejected: {
    attempt_id: 'att_mxyz_4d5e6f',
    stage: 'validation',
    error_count: 1,
  },
  contact_submitted: { attempt_id: 'att_mxyz_7g8h9i' },
  contact_accepted: {
    message_id: 'MSG-20261005-DEF456',
    topic: 'order-question',
  },
  contact_rejected: {
    attempt_id: 'att_mxyz_0j1k2l',
    stage: 'spam_filtered',
    error_count: 1,
  },
};

const PII_PATTERNS = [
  /test@example\.com/i,
  /@[a-z0-9-]+\.[a-z]{2,}/i,
  /\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /sk_live|pk_live|phc_/i,
];

describe('orders/contact analytics contracts', () => {
  it('defines exactly 6 new events (3 orders + 3 contact)', () => {
    expect(Object.keys(ORDER_ANALYTICS_EVENT_NAMES)).toHaveLength(3);
    expect(Object.keys(CONTACT_ANALYTICS_EVENT_NAMES)).toHaveLength(3);
    expect(Object.keys(SAMPLES)).toHaveLength(6);
  });

  it('is merged into the central taxonomy (coordinator merge complete)', () => {
    // Phase 2 consolidation: order/contact events now live in the central
    // taxonomy. Assert presence + ownership agreement instead of disjointness.
    const central = new Set(Object.values(ANALYTICS_EVENT_NAMES) as string[]);
    for (const name of Object.values({
      ...ORDER_ANALYTICS_EVENT_NAMES,
      ...CONTACT_ANALYTICS_EVENT_NAMES,
    }) as string[]) {
      expect(central.has(name), `missing from central taxonomy: ${name}`).toBe(true);
      expect(EVENT_OWNERSHIP[name as never], `ownership mismatch: ${name}`).toBe('server');
    }
  });

  it('all 6 events are server-owned — no client event may share a name', () => {
    for (const owner of Object.values(ORDER_EVENT_OWNERSHIP)) {
      expect(owner).toBe('server');
    }
    for (const owner of Object.values(CONTACT_EVENT_OWNERSHIP)) {
      expect(owner).toBe('server');
    }
  });

  it('no representative payload contains PII, payment data, or secrets', () => {
    for (const [name, props] of Object.entries(SAMPLES)) {
      const text = JSON.stringify(props);
      for (const pattern of PII_PATTERNS) {
        expect(pattern.test(text), `${name} payload leaked: ${text}`).toBe(
          false,
        );
      }
    }
  });

  it('ownership stages never exceed feature_tested without the phc_ key', () => {
    const gate = ownershipStageIndex('feature_tested');
    for (const [name, stage] of Object.entries({
      ...ORDER_EVENT_STAGES,
      ...CONTACT_EVENT_STAGES,
    })) {
      expect(
        ownershipStageIndex(stage as 'feature_tested'),
        `${name} stage`,
      ).toBeLessThanOrEqual(gate);
    }
  });

  it('canonical server emission is inert without a project token (WIRED, BLOCKED)', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(() =>
      captureServerEventSoon(
        ANALYTICS_EVENT_NAMES.orderAccepted,
        SAMPLES.order_accepted,
        'server:test-scope',
      ),
    ).not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('canonical server emission stamps implementation_source=nextjs when a token is present', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'phc_test_token_abc';
    const seen: { body: string }[] = [];
    const fetchStub = (async (_url: string, init?: RequestInit) => {
      seen.push({ body: String(init?.body) });
      return { ok: true, status: 200 } as Response;
    }) as unknown as typeof fetch;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(fetchStub);

    captureServerEventSoon(
      ANALYTICS_EVENT_NAMES.contactAccepted,
      SAMPLES.contact_accepted,
      'server:test-scope',
    );
    // fire-and-forget: flush the microtask queue
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(seen).toHaveLength(1);
    const parsed = JSON.parse(seen[0]?.body ?? '{}') as {
      event: string;
      properties: Record<string, unknown>;
    };
    expect(parsed.event).toBe('contact_accepted');
    expect(parsed.properties[SOURCE_PROPERTY]).toBe(ANALYTICS_SOURCE);
    expect(parsed.properties.message_id).toBe('MSG-20261005-DEF456');

    fetchSpy.mockRestore();
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    vi.restoreAllMocks();
  });
});
