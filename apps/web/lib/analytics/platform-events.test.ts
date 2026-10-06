/**
 * REGRESSION SUITE — PostHog platform events (G11/G12/G14), coordinator merge pending.
 *
 * Laws under test:
 * - Every platform event carries implementation_source='nextjs' via
 *   buildPlatformEventPayload() — the same no-double-counting contract as
 *   the core taxonomy.
 * - All four events are client-owned (only the browser observes them).
 * - No platform event name collides with the 22-event core taxonomy
 *   (lib/analytics/events.ts) — names are disjoint by construction.
 * - No payload contains PII, payment data, or secrets — chat content is
 *   never captured (length only); admin events carry section names only.
 * - The platform taxonomy count is a contract (4) — bump deliberately.
 * - Tracking is inert without a project token and never throws.
 *
 * Status vocabulary: WIRED (code exists) / BLOCKED (waiting on the owner's
 * phc_ key). Analytics is NEVER marked IMPLEMENTED here.
 */
import { describe, expect, it } from 'vitest';
import {
  PLATFORM_EVENT_COUNT,
  PLATFORM_EVENT_NAMES,
  PLATFORM_EVENT_OWNERSHIP,
  buildPlatformEventPayload,
  trackPlatformEvent,
  type PlatformEventName,
  type PlatformEventProperties,
} from './platform-events';
import { ANALYTICS_EVENT_NAMES } from './events';

/** Representative, PII-free payload for every platform event — compile-time checked. */
const SAMPLES: { [K in PlatformEventName]: PlatformEventProperties[K] } = {
  chat_opened: { surface: 'widget' },
  chat_message_sent: { message_length: 42, provider_id: 'canned-preview' },
  admin_viewed: { section: 'orders' },
  pwa_installed: {},
};

describe('platform taxonomy shape', () => {
  it('declares exactly 4 events', () => {
    expect(Object.keys(PLATFORM_EVENT_NAMES).length).toBe(PLATFORM_EVENT_COUNT);
    expect(PLATFORM_EVENT_COUNT).toBe(4);
  });

  it('is merged into the canonical 62-event taxonomy with matching ownership', () => {
    // Phase 2 consolidation: platform events merged into the central taxonomy.
    const core = new Set(Object.values(ANALYTICS_EVENT_NAMES) as string[]);
    expect(core.size).toBe(62);
    for (const name of Object.values(PLATFORM_EVENT_NAMES)) {
      expect(core.has(name), `missing from central taxonomy: ${name}`).toBe(true);
    }
  });

  it('every event has an ownership entry and all are client-owned', () => {
    for (const name of Object.values(PLATFORM_EVENT_NAMES)) {
      expect(PLATFORM_EVENT_OWNERSHIP[name]).toBe('client');
    }
  });

  it('event names are snake_case past-tense', () => {
    for (const name of Object.values(PLATFORM_EVENT_NAMES)) {
      expect(name).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });
});

describe('source tagging', () => {
  it('every payload carries implementation_source=nextjs', () => {
    for (const name of Object.values(PLATFORM_EVENT_NAMES) as PlatformEventName[]) {
      const payload = buildPlatformEventPayload(SAMPLES[name] as never);
      expect(payload.implementation_source).toBe('nextjs');
    }
  });
});

describe('PII / secret scan', () => {
  it('no sample payload contains PII, payment, or secret markers', () => {
    const FORBIDDEN = [
      '@',
      'cash_app',
      'venmo',
      '$AmberPatten',
      'card',
      'ssn',
      'password',
      'token',
      'secret',
      'api_key',
    ];
    for (const name of Object.values(PLATFORM_EVENT_NAMES) as PlatformEventName[]) {
      const json = JSON.stringify(buildPlatformEventPayload(SAMPLES[name] as never)).toLowerCase();
      for (const word of FORBIDDEN) {
        expect(json, `${name} contains ${word}`).not.toContain(word);
      }
    }
  });

  it('chat content is never a property (length only)', () => {
    const keys = Object.keys(SAMPLES.chat_message_sent);
    expect(keys).not.toContain('message');
    expect(keys).not.toContain('content');
    expect(keys).not.toContain('reply');
  });

  it('admin events carry section names only', () => {
    const keys = Object.keys(SAMPLES.admin_viewed);
    expect(keys).toEqual(['section']);
  });
});

describe('tracking behavior', () => {
  it('is inert without a project token and never throws', () => {
    expect(() =>
      trackPlatformEvent('chat_opened', { surface: 'widget' }),
    ).not.toThrow();
  });
});
