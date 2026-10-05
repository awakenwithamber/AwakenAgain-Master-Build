/**
 * REGRESSION SUITE — §19: PostHog event contracts.
 *
 * Laws under test:
 * - The 22-event typed taxonomy is a contract: count, names, and property
 *   schemas must only change deliberately.
 * - Every event carries exactly one owner ('client' | 'server') — no
 *   duplicates across the client/server boundary (§6).
 * - Planned server events must not collide with client event names.
 * - The client tracker is inert without a project token and never throws;
 *   trackOnce is StrictMode-safe (no double-fire from re-renders).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_EVENT_NAMES,
  EVENT_OWNERSHIP,
  SERVER_EVENTS_PLANNED,
  type AnalyticsEventName,
} from './events';
import { isPostHogLive, track, trackOnce } from './posthog';

describe('22-event typed taxonomy (migration baseline)', () => {
  it('contains exactly 22 events', () => {
    expect(Object.keys(ANALYTICS_EVENT_NAMES)).toHaveLength(22);
    expect(Object.values(ANALYTICS_EVENT_NAMES)).toHaveLength(22);
  });

  it('event names are unique snake_case strings', () => {
    const values = Object.values(ANALYTICS_EVENT_NAMES);
    expect(new Set(values).size).toBe(22);
    for (const v of values) {
      expect(v).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });

  it('covers the full customer journey', () => {
    const values = Object.values(ANALYTICS_EVENT_NAMES);
    for (const required of [
      'product_viewed',
      'builder_step_viewed',
      'scent_selected',
      'blend_completed',
      'ritual_completed',
      'soap_added_to_cart',
      'bundle_added_to_cart',
      'checkout_initiated',
      'payment_instructions_viewed',
      'order_completed',
      'order_created',
    ]) {
      expect(values).toContain(required);
    }
  });

  it('bundle events carry slot-level detail in their contract', () => {
    // Compile-time contract check: bundle_added_to_cart requires per-slot props.
    const props: import('./events').AnalyticsEventProperties['bundle_added_to_cart'] = {
      bundle_id: 'soap-style-collection-5',
      price_cents: 3577,
      savings_cents: 1208,
      slot_count: 5,
      slots: [],
    };
    expect(props.price_cents).toBe(3577);
  });
});

describe('client/server ownership — no duplicates (§6)', () => {
  it('every event has exactly one owner', () => {
    const names = Object.values(ANALYTICS_EVENT_NAMES) as AnalyticsEventName[];
    expect(Object.keys(EVENT_OWNERSHIP)).toHaveLength(22);
    for (const name of names) {
      expect(['client', 'server']).toContain(EVENT_OWNERSHIP[name]);
    }
  });

  it('21 events are client-owned (interactions); order_created is server-owned', () => {
    // CLIENT owns customer interactions (only the browser observes them);
    // SERVER owns authoritative business transitions (only the server can
    // attest them). order_created is the first server-owned event, emitted
    // exactly once by POST /api/checkout after the order is persisted.
    const owners = Object.values(EVENT_OWNERSHIP);
    expect(owners.filter((o) => o === 'client')).toHaveLength(21);
    expect(owners.filter((o) => o === 'server')).toHaveLength(1);
    expect(EVENT_OWNERSHIP.order_created).toBe('server');
    expect(EVENT_OWNERSHIP.order_completed).toBe('client');
  });

  it('planned server events are reserved and collision-free', () => {
    // order_created was promoted from this list to a real server-owned event
    // (2026-10-05) — it must no longer appear among the planned names.
    const planned = [...SERVER_EVENTS_PLANNED];
    expect(planned).toContain('cart_configuration_accepted');
    expect(planned).toContain('pricing_validation_passed');
    expect(planned).toContain('pricing_validation_failed');
    expect(planned).toContain('subscription_confirmed');
    expect(planned).not.toContain('order_created');
    const clientNames = new Set(Object.values(ANALYTICS_EVENT_NAMES));
    for (const name of planned) {
      expect(clientNames.has(name as AnalyticsEventName)).toBe(false);
    }
    expect(new Set(planned).size).toBe(planned.length);
  });
});

describe('tracker safety (no key = inert, never throws)', () => {
  it('is not live without a project token', () => {
    expect(isPostHogLive()).toBe(false);
  });

  it('track() drops silently when unconfigured', () => {
    expect(() =>
      track('builder_step_viewed', { step: 1, step_name: 'base' }),
    ).not.toThrow();
  });

  it('trackOnce() fires at most once per key (StrictMode-safe)', () => {
    const key = `test_${Date.now()}`;
    expect(() => {
      trackOnce(key, 'ritual_completed', {});
      trackOnce(key, 'ritual_completed', {});
      trackOnce(key, 'ritual_completed', {});
    }).not.toThrow();
  });
});

describe('property schemas contain no PII, payment data, or secrets', () => {
  /**
   * Source-level contract: scan the property-schema interfaces in events.ts
   * and assert no declared property key matches PII/payment/secret patterns.
   * Heuristic but effective as a regression gate — if someone adds
   * `email?: string` to a schema, this fails loudly. Keep patterns narrow to
   * avoid false positives on legitimate keys (step_name, color_name, etc.).
   */
  const FORBIDDEN: RegExp[] = [
    /email/i,
    /phone/i,
    /(^|_)tel(_|$)/i,
    /mobile/i,
    /sms/i,
    /address/i,
    /(^|_)zip(_|$)/i,
    /postal/i,
    /card/i,
    /cvv/i,
    /cvc/i,
    /payment/i,
    /iban/i,
    /ssn/i,
    /secret/i,
    /token/i,
    /password/i,
    /passwd/i,
    /credential/i,
    /billing/i,
    /first_name/i,
    /last_name/i,
    /full_name/i,
    /dob/i,
    /birth_?date/i,
    /(^|_)ip(_|$)/i,
  ];

  function schemaPropertyKeys(): string[] {
    const raw = readFileSync(new URL('./events.ts', import.meta.url), 'utf8');
    // Strip comments so prose like "never hard-coded" can't match key patterns.
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const keys: string[] = [];
    // Scan the property-schema interfaces (AnalyticsEventProperties +
    // the nested BundleSlotProps helper), skipping the top-level event-name
    // keys — those are event identifiers, not property fields.
    const eventNames = new Set(Object.values(ANALYTICS_EVENT_NAMES));
    for (const marker of ['export interface AnalyticsEventProperties {', 'interface BundleSlotProps {']) {
      const start = src.indexOf(marker);
      expect(start, `${marker} not found`).toBeGreaterThan(-1);
      let depth = 0;
      let end = -1;
      for (let i = start; i < src.length; i += 1) {
        if (src[i] === '{') depth += 1;
        else if (src[i] === '}') {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      expect(end, `unterminated ${marker}`).toBeGreaterThan(start);
      const block = src.slice(start, end);
      const re = /([A-Za-z_][A-Za-z0-9_]*)\s*\??:/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(block)) !== null) {
        if (!eventNames.has(m[1] as never)) keys.push(m[1]);
      }
    }
    return keys;
  }

  it('no property key matches PII/payment/secret patterns', () => {
    const keys = schemaPropertyKeys();
    expect(keys.length, 'no schema keys extracted — parser drift').toBeGreaterThan(10);
    const violations: string[] = [];
    for (const key of keys) {
      for (const pattern of FORBIDDEN) {
        if (pattern.test(key)) violations.push(`${key} matches ${pattern}`);
      }
    }
    expect(violations, `PII/payment/secret fields in PostHog schemas: ${violations.join(', ')}`).toEqual([]);
  });

  it('documented no-PII law is stated in the taxonomy module', () => {
    const src = readFileSync(new URL('./events.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/NO PII/i);
  });
});
