/**
 * Analytics contract tests — lib/analytics/builders-events.ts (G2/G10).
 *
 * Laws under test:
 * - 14 builder events; names are snake_case with past-tense verbs.
 * - No collision with the canonical 22-event taxonomy (events.ts) — the
 *   coordinator merges; this module must not shadow it.
 * - Every event has an owner (all client) and complete traceability.
 * - Payloads stamp implementation_source: 'nextjs' and carry no PII.
 * - No superseded payment paths in the module.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  BUILDER_ANALYTICS_EVENT_NAMES,
  BUILDER_EVENT_OWNERSHIP,
  BUILDER_EVENT_TRACEABILITY,
  buildBuilderEventPayload,
  type BuilderEventName,
} from './builders-events';
import { ANALYTICS_EVENT_NAMES, EVENT_OWNERSHIP } from './events';

const ROOT = resolve(__dirname, '..', '..');

describe('builder event taxonomy shape', () => {
  it('defines exactly 14 builder events', () => {
    expect(Object.keys(BUILDER_ANALYTICS_EVENT_NAMES)).toHaveLength(14);
  });

  it('names are snake_case with past-tense verbs', () => {
    for (const name of Object.values(BUILDER_ANALYTICS_EVENT_NAMES)) {
      expect(name, name).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
    // Spot-check the past-tense verbs.
    expect(BUILDER_ANALYTICS_EVENT_NAMES.formulaBuilderStarted).toBe('formula_builder_started');
    expect(BUILDER_ANALYTICS_EVENT_NAMES.teaAddedToCart).toBe('tea_added_to_cart');
  });

  it('is merged into the canonical 62-event taxonomy with matching ownership', () => {
    // Phase 2 consolidation: the builder events were merged into the central
    // taxonomy (events.ts). This test now asserts the merge is complete and
    // ownership agrees — the interim "disjoint module" design is retired.
    const canonical = new Set(Object.values(ANALYTICS_EVENT_NAMES));
    expect(canonical.size).toBe(62);
    for (const name of Object.values(BUILDER_ANALYTICS_EVENT_NAMES)) {
      expect(canonical.has(name as never), `missing from central taxonomy: ${name}`).toBe(true);
      expect(EVENT_OWNERSHIP[name as never], `ownership mismatch: ${name}`).toBe(
        BUILDER_EVENT_OWNERSHIP[name as never],
      );
    }
  });

  it('every event has an owner — all client-owned', () => {
    const names = Object.values(BUILDER_ANALYTICS_EVENT_NAMES) as BuilderEventName[];
    for (const name of names) {
      expect(BUILDER_EVENT_OWNERSHIP[name], name).toBe('client');
    }
    expect(Object.keys(BUILDER_EVENT_OWNERSHIP)).toHaveLength(14);
  });

  it('every event has complete traceability (name → reason → legacy → owner → purpose)', () => {
    const names = Object.values(BUILDER_ANALYTICS_EVENT_NAMES) as BuilderEventName[];
    for (const name of names) {
      const t = BUILDER_EVENT_TRACEABILITY[name];
      expect(t, `traceability for ${name}`).toBeDefined();
      expect(t.reason.length).toBeGreaterThan(10);
      expect(t.legacyEquivalent.length).toBeGreaterThan(0);
      expect(t.purpose.length).toBeGreaterThan(10);
      expect(t.owner).toBe('client');
    }
  });
});

describe('builder event payloads', () => {
  it("stamps implementation_source: 'nextjs' on every payload", () => {
    const p = buildBuilderEventPayload<'formula_herb_selected'>({
      herb_id: 'lavender',
      herb_count: 1,
    });
    expect(p.implementation_source).toBe('nextjs');
  });

  it('typed payloads compile: step/blend/cart shapes', () => {
    const step = buildBuilderEventPayload<'formula_builder_step_viewed'>({
      step: 2,
      step_name: 'herbs',
    });
    expect(step.implementation_source).toBe('nextjs');

    const cart = buildBuilderEventPayload<'formula_added_to_cart'>({
      size_id: 'capsule-28',
      herb_ids: ['lavender'],
      herb_count: 1,
      unit_price_cents: 3362,
      quantity: 1,
    });
    expect(cart.unit_price_cents).toBe(3362);
  });

  it('property schemas contain no PII keys', () => {
    const pii = [
      'email',
      'name',
      'phone',
      'address',
      'customer',
      'payment',
      'card',
      'token',
      'secret',
      'password',
      'notes',
      'creation_name',
      'intention',
    ];
    // Representative payloads for every event family.
    const samples: Array<Record<string, unknown>> = [
      buildBuilderEventPayload<'formula_builder_started'>({}),
      buildBuilderEventPayload<'tea_builder_step_viewed'>({ step: 1, step_name: 'size' }),
      buildBuilderEventPayload<'formula_herb_selected'>({ herb_id: 'lavender', herb_count: 1 }),
      buildBuilderEventPayload<'tea_safety_flag_shown'>({
        flag_count: 3,
        max_severity: 'review',
        unknown_pair_count: 1,
      }),
      buildBuilderEventPayload<'formula_blend_completed'>({
        herb_ids: ['lavender'],
        herb_count: 1,
        size_id: 'capsule-28',
      }),
      buildBuilderEventPayload<'tea_added_to_cart'>({
        size_id: 'capsule-28',
        herb_ids: ['lavender'],
        herb_count: 1,
        unit_price_cents: 3362,
        quantity: 1,
      }),
    ];
    for (const s of samples) {
      for (const key of Object.keys(s)) {
        expect(pii, `PII key in payload: ${key}`).not.toContain(key);
      }
    }
  });

  it('no superseded payment paths in the analytics module', () => {
    const src = readFileSync(join(ROOT, 'lib/analytics/builders-events.ts'), 'utf8');
    expect(src).not.toMatch(/stripe|shopify|paypal|square/i);
  });
});
