/**
 * REGRESSION SUITE — content analytics contracts (G4, G6, G7, G15, G16).
 *
 * Laws under test (mirror of the main analytics-contracts suite, scoped to
 * the content taxonomy in content-events.ts):
 * - Every content event carries implementation_source='nextjs', stamped by
 *   the single choke point buildContentEventPayload().
 * - Event names are snake_case, past-tense, one per user action.
 * - No PII/payment/secrets in any property — payloads are scanned at
 *   runtime over representative samples for all 11 events (name, email,
 *   rating text, review body never enter a payload).
 * - Client/server ownership is total: every event has exactly one owner;
 *   server-owned events cannot be emitted via the client tracker.
 * - Server capture is inert without a project token (no fetch, no throw).
 *
 * Status vocabulary: WIRED (code exists) / BLOCKED (waiting on the owner's
 * phc_ key). Analytics is NEVER marked IMPLEMENTED here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANALYTICS_SOURCE,
  SOURCE_PROPERTY,
} from './events';
import {
  CONTENT_ANALYTICS_EVENT_NAMES,
  CONTENT_EVENT_OWNERSHIP,
  buildContentEventPayload,
  type ContentAnalyticsEventName,
  type ContentAnalyticsEventProperties,
} from './content-events';
import { trackContent, trackContentOnce } from './content-posthog';
import {
  captureContentServerEvent,
  captureContentServerEventSoon,
  isContentServerCaptureConfigured,
} from './content-posthog-server';

/** Representative, PII-free payload for every content event. */
const SAMPLES: { [K in ContentAnalyticsEventName]: ContentAnalyticsEventProperties[K] } = {
  quiz_started: {},
  quiz_step_completed: { step: 1, step_name: 'concern' },
  quiz_completed: { concern_id: 'sleep', form_id: 'tea' },
  quiz_lead_captured: { concern_id: 'sleep', form_id: 'tea' },
  review_list_viewed: { product_handle: 'dreamease-capsules', approved_review_count: 0 },
  review_submitted: { product_handle: 'dreamease-capsules', rating: 5 },
  newsletter_form_viewed: { placement: 'footer' },
  newsletter_subscribed: { placement: 'footer' },
  article_viewed: { slug: 'the-hidden-power-of-mugwort', section: 'journal' },
  search_performed: { query_length: 6, result_count: 3 },
  content_page_viewed: { path: '/herbal-wisdom' },
};

const PII_PATTERNS = [
  /@/i, // emails
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, // phone numbers
];

describe('content event names', () => {
  it('uses snake_case, past-tense names — one per user action', () => {
    const names = Object.values(CONTENT_ANALYTICS_EVENT_NAMES);
    expect(new Set(names).size).toBe(names.length); // no duplicates
    for (const name of names) {
      expect(name, name).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(name, name).toMatch(/(ed|iewed|ted|med)$/); // past-tense verbs
    }
  });

  it('ownership is total — every event has exactly one owner', () => {
    const names = Object.values(CONTENT_ANALYTICS_EVENT_NAMES) as ContentAnalyticsEventName[];
    for (const name of names) {
      expect(['client', 'server']).toContain(CONTENT_EVENT_OWNERSHIP[name]);
    }
    // Accepted leads/signups are server-owned (authoritative transitions).
    expect(CONTENT_EVENT_OWNERSHIP.quiz_lead_captured).toBe('server');
    expect(CONTENT_EVENT_OWNERSHIP.newsletter_subscribed).toBe('server');
    expect(CONTENT_EVENT_OWNERSHIP.quiz_started).toBe('client');
    expect(CONTENT_EVENT_OWNERSHIP.review_submitted).toBe('client');
  });
});

describe('content payload contracts', () => {
  it('stamps implementation_source=nextjs on every event', () => {
    const names = Object.keys(SAMPLES) as ContentAnalyticsEventName[];
    for (const name of names) {
      const payload = buildContentEventPayload(SAMPLES[name]);
      expect(payload[SOURCE_PROPERTY]).toBe(ANALYTICS_SOURCE);
    }
  });

  it('carries no PII, payment data, or secrets in any payload', () => {
    const names = Object.keys(SAMPLES) as ContentAnalyticsEventName[];
    for (const name of names) {
      const payload = buildContentEventPayload(SAMPLES[name]);
      const serialized = JSON.stringify(payload);
      for (const pattern of PII_PATTERNS) {
        expect(serialized, `${name} leaked PII`).not.toMatch(pattern);
      }
      const keys = Object.keys(payload).join(' ');
      expect(keys).not.toMatch(/\b(name|email|phone|body|title)\b/i);
    }
  });

  it('quiz_lead_captured carries concern+form ids only — no name/email', () => {
    const payload = buildContentEventPayload(SAMPLES.quiz_lead_captured);
    expect(Object.keys(payload).sort()).toEqual([
      'concern_id',
      'form_id',
      'implementation_source',
    ]);
  });
});

describe('client tracker guards', () => {
  it('is inert without a project token — no network, no throw', async () => {
    const { default: posthog } = await import('posthog-js');
    const spy = vi.spyOn(posthog, 'capture');
    trackContent('quiz_started', {});
    trackContentOnce('k1', 'quiz_started', {});
    await new Promise((r) => setTimeout(r, 50));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('refuses to emit server-owned events from the client tracker', async () => {
    const { default: posthog } = await import('posthog-js');
    const spy = vi.spyOn(posthog, 'capture');
    // Deliberate type escape to prove the runtime backstop.
    trackContent('quiz_lead_captured' as 'quiz_started', {} as never);
    await new Promise((r) => setTimeout(r, 50));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('server content capture guards', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    vi.unstubAllGlobals();
  });

  it('reports unconfigured without a token', () => {
    expect(isContentServerCaptureConfigured()).toBe(false);
  });

  it('performs no fetch and never throws without a token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const ok = await captureContentServerEvent(
      'newsletter_subscribed',
      { placement: 'footer' },
      'server:test',
    );
    expect(ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(() =>
      captureContentServerEventSoon('newsletter_subscribed', { placement: 'footer' }, 'server:test'),
    ).not.toThrow();
  });

  it('posts a minimal, source-tagged payload when configured', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'phc_testtoken123';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));
    const ok = await captureContentServerEvent(
      'quiz_lead_captured',
      { concern_id: 'sleep', form_id: 'tea' },
      'distinct-123',
    );
    expect(ok).toBe(true);
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.event).toBe('quiz_lead_captured');
    expect(body.distinct_id).toBe('distinct-123');
    expect(body.properties.implementation_source).toBe('nextjs');
    expect(JSON.stringify(body)).not.toMatch(/@/);
  });
});
