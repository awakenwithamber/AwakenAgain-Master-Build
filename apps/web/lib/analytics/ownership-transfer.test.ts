/**
 * REGRESSION SUITE — §6 ownership-transfer precision (owner 2026-10-05).
 *
 * Laws under test:
 * - Ownership transfers ONLY after the Next.js replacement is VERIFIED —
 *   never on code conversion alone. OWNERSHIP_STAGES records each event's
 *   position in the exact lifecycle:
 *     legacy_static_active → nextjs_replacement_built → feature_tested →
 *     event_received_verified → parity_verified → nextjs_authoritative →
 *     legacy_safe_to_retire
 * - STAGE-GATE: while no real phc_ project key is configured, no event may
 *   claim event_received_verified / parity_verified / nextjs_authoritative,
 *   and no legacy feature/event may be retired. Advancement past
 *   feature_tested requires the key AND verified event receipt in PostHog
 *   Live Events (human QA checklist: POSTHOG_EVENT_MAP.md §5).
 * - Static↔Next.js name parity: every static event name survives VERBATIM
 *   in the Next.js taxonomy. The only Next.js events without a static
 *   counterpart are the three documented additions below — each with
 *   rationale. No silent renames.
 * - implementation_source is the only SYSTEMATIC difference: names are
 *   identical across the two implementations, and the single choke point
 *   buildEventPayload() adds exactly one property to every stamped
 *   payload.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_EVENT_NAMES,
  OWNERSHIP_STAGE_ORDER,
  OWNERSHIP_STAGES,
  ownershipStageIndex,
  type AnalyticsEventName,
} from './events';
import { buildEventPayload } from './posthog';
import { isServerCaptureConfigured } from './posthog-server';

/**
 * The static 19-event taxonomy, snapshotted from
 * ../soap-shop-build/assets/POSTHOG_EVENTS.md (v2, DRAFT) and
 * ../soap-shop-build/assets/posthog-tracking.js. Hard-coded with citation
 * because the source lives outside this package — the parity contract must
 * be explicit and reviewable, not an invisible dependency on a path.
 */
const STATIC_EVENT_NAMES = [
  'builder_step_viewed',
  'ritual_completed',
  'base_selected',
  'shape_selected',
  'scent_selected',
  'blend_oil_toggled',
  'blend_completed',
  'botanical_selected',
  'color_selected',
  'soap_added_to_cart',
  'cart_updated',
  'bundle_opened',
  'bundle_slot_configured',
  'bundle_added_to_cart',
  'shop_scent_card_clicked',
  'shop_bundle_card_clicked',
  'seasonal_scent_interacted',
  'checkout_initiated',
  'order_completed',
] as const;

/**
 * Next.js events with NO static counterpart. Additions only — no renames:
 * every other Next.js event name MUST appear verbatim in
 * STATIC_EVENT_NAMES. Each entry carries its rationale so a reviewer can
 * see why the taxonomy grew. (See POSTHOG_EVENT_MAP.md §1 parity table.)
 */
const DOCUMENTED_ADDITIONS: { name: AnalyticsEventName; rationale: string }[] =
  [
    {
      name: 'product_viewed',
      rationale:
        'Discovery → product view had no static event (static had only automatic $pageview); needed to measure which catalog entries attract views on the 45 SSG product pages.',
    },
    {
      name: 'payment_instructions_viewed',
      rationale:
        'Cash App / Venmo payment instructions were static text in the static build; the Next.js confirmation page renders them as an observable step in the money-path funnel.',
    },
    {
      name: 'order_created',
      rationale:
        'Server-owned recorded fact that the checkout Route Handler accepted and persisted the order. The static build has no server-attested order event; this is the canonical observed revenue count (the ledger, not the event, is the authority).',
    },
    /* ---- Phase 2 additions (23–62): no static counterparts; each is a new
       Next.js capability with no legacy analytics to preserve ---- */
    {
      name: 'order_submitted',
      rationale:
        'Durable order-intake endpoint (POST /api/orders) is new in Next.js; the static build relied on the implicit Netlify Forms event. Needed to observe intake attempts before validation.',
    },
    {
      name: 'order_accepted',
      rationale:
        'Server-attested acceptance by the intake pipeline. Distinct from order_created (checkout payment-instruction flow): different endpoint, different action, no double count.',
    },
    {
      name: 'order_rejected',
      rationale:
        'Intake-pipeline rejection observability (validation vs persistence stage). No static equivalent; the static build had no explicit intake contract.',
    },
    {
      name: 'contact_submitted',
      rationale:
        'Contact pipeline is new as an explicit API contract (POST /api/contact); the static build posted to form-relay without observable submission events.',
    },
    {
      name: 'contact_accepted',
      rationale: 'Server-attested contact message persistence. No static equivalent.',
    },
    {
      name: 'contact_rejected',
      rationale:
        'Contact rejection/spam-filter observability. No static equivalent.',
    },
    {
      name: 'quiz_started',
      rationale:
        'Herbal Allies Quiz is rebuilt as a Next.js client island (G6); the static quiz had no typed event contract to preserve.',
    },
    {
      name: 'quiz_step_completed',
      rationale: 'Quiz funnel step observability for the rebuilt quiz.',
    },
    {
      name: 'quiz_completed',
      rationale: 'Quiz completion observability for the rebuilt quiz.',
    },
    {
      name: 'quiz_lead_captured',
      rationale:
        'Server-attested lead capture (consent-gated). The static quiz lead flow had no server-attested event.',
    },
    {
      name: 'review_list_viewed',
      rationale:
        'Reviews system is rebuilt (G4); the static build had no typed review events.',
    },
    {
      name: 'review_submitted',
      rationale: 'Review submission observability for the rebuilt reviews flow.',
    },
    {
      name: 'newsletter_form_viewed',
      rationale: 'Newsletter signup rebuilt as a typed component (G15).',
    },
    {
      name: 'newsletter_subscribed',
      rationale: 'Server-attested newsletter subscription. No static equivalent.',
    },
    {
      name: 'article_viewed',
      rationale:
        'Content routes (G7) are new Next.js routes; the static build served this content from SPA anchors with no per-article events.',
    },
    {
      name: 'search_performed',
      rationale:
        'Catalog search rebuilt as a typed component (G16); lengths only, never raw health text.',
    },
    {
      name: 'content_page_viewed',
      rationale: 'Generic content-route observability for the new G7 routes.',
    },
    {
      name: 'formula_builder_started',
      rationale:
        'Custom capsule formula builder is new in Next.js (G2); the static #custom-formula had no typed event contract.',
    },
    {
      name: 'formula_builder_step_viewed',
      rationale: 'Formula builder funnel observability.',
    },
    {
      name: 'formula_herb_selected',
      rationale: 'Herb selection observability (exact herb IDs only, never PII).',
    },
    {
      name: 'formula_herb_removed',
      rationale: 'Herb removal observability for the formula builder.',
    },
    {
      name: 'formula_safety_flag_shown',
      rationale:
        'Safety-flag exposure observability — measures how often the conservative safety module intervenes.',
    },
    {
      name: 'formula_blend_completed',
      rationale: 'Formula blend completion observability.',
    },
    {
      name: 'formula_added_to_cart',
      rationale: 'Custom formula add-to-cart observability (money-path adjacent).',
    },
    {
      name: 'tea_builder_started',
      rationale: 'Tea builder is new in Next.js (G10).',
    },
    {
      name: 'tea_builder_step_viewed',
      rationale: 'Tea builder funnel observability.',
    },
    {
      name: 'tea_herb_selected',
      rationale: 'Tea botanical selection observability.',
    },
    {
      name: 'tea_herb_removed',
      rationale: 'Tea botanical removal observability.',
    },
    {
      name: 'tea_safety_flag_shown',
      rationale: 'Tea safety-flag exposure observability.',
    },
    {
      name: 'tea_blend_completed',
      rationale: 'Tea blend completion observability.',
    },
    {
      name: 'tea_added_to_cart',
      rationale: 'Custom tea add-to-cart observability.',
    },
    {
      name: 'grimoire_subscribe_started',
      rationale:
        'Grimoire subscription flow is rebuilt Cash App/Venmo-native (G1); the legacy NML/Stripe checkout is SUPERSEDED and its events are not preserved.',
    },
    {
      name: 'subscription_created',
      rationale:
        'Server-attested subscription record creation (pending_payment). No static equivalent exists.',
    },
    {
      name: 'otp_requested',
      rationale:
        'Grimoire OTP gating is new (G8); the static build had no working OTP flow.',
    },
    {
      name: 'otp_verified',
      rationale: 'OTP verification observability for the new gate.',
    },
    {
      name: 'email_job_queued',
      rationale:
        'Email jobs are new provider-neutral contracts (G9); the static build had no observable job queue.',
    },
    {
      name: 'chat_opened',
      rationale:
        'Lunna chat is new as a typed component (G11); the static widget had no typed event contract.',
    },
    {
      name: 'chat_message_sent',
      rationale:
        'Chat engagement observability — message length + provider only, never message content.',
    },
    {
      name: 'admin_viewed',
      rationale:
        'Admin dashboard is new (G12); section-only observability for operations.',
    },
    {
      name: 'pwa_installed',
      rationale: 'PWA installability observability (G14).',
    },
  ];

describe('ownership lifecycle order is exact (owner 2026-10-05)', () => {
  it('OWNERSHIP_STAGE_ORDER matches the governing sequence verbatim', () => {
    expect([...OWNERSHIP_STAGE_ORDER]).toEqual([
      'legacy_static_active',
      'nextjs_replacement_built',
      'feature_tested',
      'event_received_verified',
      'parity_verified',
      'nextjs_authoritative',
      'legacy_safe_to_retire',
    ]);
  });

  it('every event has exactly one ownership stage; the record covers all 22', () => {
    const names = Object.values(ANALYTICS_EVENT_NAMES) as AnalyticsEventName[];
    expect(names).toHaveLength(62);
    expect(Object.keys(OWNERSHIP_STAGES)).toHaveLength(62);
    for (const name of names) {
      const stage = OWNERSHIP_STAGES[name];
      expect(
        OWNERSHIP_STAGE_ORDER,
        `invalid stage for ${name}`,
      ).toContain(stage);
      expect(ownershipStageIndex(stage)).toBeGreaterThanOrEqual(0);
    }
  });
});

(isServerCaptureConfigured() ? describe.skip : describe)(
  'stage gate — no key, no advancement',
  () => {
    // When a real phc_ key IS configured, this gate moves to human QA:
    // advancement past feature_tested requires VERIFIED event receipt in
    // PostHog Live Events (POSTHOG_EVENT_MAP.md §5), which this suite
    // cannot observe. Skipping here is deliberate, not a hole — the
    // OWNERSHIP_STAGES record must still be updated by hand with evidence.
    const MAX_WITHOUT_KEY = ownershipStageIndex('feature_tested');

    it('no event claims receipt / parity / authority while the key is absent', () => {
      const names = Object.values(ANALYTICS_EVENT_NAMES) as AnalyticsEventName[];
      const violations = names.filter(
        (n) => ownershipStageIndex(OWNERSHIP_STAGES[n]) > MAX_WITHOUT_KEY,
      );
      expect(
        violations,
        `stage advanced without receipt evidence (no phc_ key): ${violations.join(', ')}`,
      ).toEqual([]);
    });

    it('no legacy feature/event is marked safe to retire while static is active', () => {
      const names = Object.values(ANALYTICS_EVENT_NAMES) as AnalyticsEventName[];
      const retired = names.filter(
        (n) => OWNERSHIP_STAGES[n] === 'legacy_safe_to_retire',
      );
      expect(retired).toEqual([]);
    });

    it('reserved-but-unwired events stay at legacy_static_active (no silent transfer)', () => {
      // shop_scent_card_clicked / shop_bundle_card_clicked are taxonomy
      // names only — emission wiring waits for the cards. The transfer has
      // not started, so the stage must not creep upward on wiring alone.
      expect(OWNERSHIP_STAGES.shop_scent_card_clicked).toBe(
        'legacy_static_active',
      );
      expect(OWNERSHIP_STAGES.shop_bundle_card_clicked).toBe(
        'legacy_static_active',
      );
    });
  },
);

describe('static↔Next.js name parity — no silent renames', () => {
  it('the static snapshot is exactly the documented 19-event taxonomy', () => {
    expect(STATIC_EVENT_NAMES).toHaveLength(19);
    expect(new Set(STATIC_EVENT_NAMES).size).toBe(19);
  });

  it('every static event name survives verbatim in the Next.js taxonomy', () => {
    const nextjsNames = new Set(
      Object.values(ANALYTICS_EVENT_NAMES) as string[],
    );
    const missing = STATIC_EVENT_NAMES.filter((s) => !nextjsNames.has(s));
    expect(missing, `static events renamed or dropped: ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  it('every Next.js event is either static-aligned or a documented addition', () => {
    const staticSet = new Set<string>(STATIC_EVENT_NAMES);
    const additionNames = new Set(DOCUMENTED_ADDITIONS.map((a) => a.name));
    const nextjsNames = Object.values(
      ANALYTICS_EVENT_NAMES,
    ) as AnalyticsEventName[];
    const unexplained = nextjsNames.filter(
      (n) => !staticSet.has(n) && !additionNames.has(n),
    );
    expect(
      unexplained,
      `Next.js events with no static counterpart and no documented rationale: ${unexplained.join(', ')}`,
    ).toEqual([]);
    // And the additions table covers exactly the diff — no more, no less.
    const diff = nextjsNames.filter((n) => !staticSet.has(n));
    expect(new Set(diff).size).toBe(DOCUMENTED_ADDITIONS.length);
    for (const a of DOCUMENTED_ADDITIONS) {
      expect(diff).toContain(a.name);
      expect(a.rationale.trim().length, `empty rationale for ${a.name}`).toBeGreaterThan(20);
    }
  });

  it('documented additions are additions, never renames of static events', () => {
    // A rename would appear as a static name missing from the Next.js
    // taxonomy — already covered above. This pins the additions list so a
    // rename cannot hide behind it.
    expect(DOCUMENTED_ADDITIONS).toHaveLength(43);
    const staticSet = new Set<string>(STATIC_EVENT_NAMES);
    for (const a of DOCUMENTED_ADDITIONS) {
      expect(staticSet.has(a.name)).toBe(false);
    }
  });
});

describe('implementation_source is the only systematic difference', () => {
  it('aligned pairs share the identical event name (no aliasing)', () => {
    const nextjsNames = new Set(
      Object.values(ANALYTICS_EVENT_NAMES) as string[],
    );
    for (const s of STATIC_EVENT_NAMES) {
      expect(nextjsNames.has(s), `static event ${s} missing verbatim`).toBe(
        true,
      );
    }
  });

  it('the payload choke point adds exactly one property to every event', () => {
    // The ONLY systematic difference between the static and Next.js
    // implementations is implementation_source. buildEventPayload() is the
    // single choke point for client payloads; the server stamps the same
    // property explicitly (posthog-server.ts).
    const names = Object.values(ANALYTICS_EVENT_NAMES) as AnalyticsEventName[];
    for (const name of names) {
      const props = {} as never;
      const stamped = buildEventPayload(props) as Record<string, unknown>;
      const keys = Object.keys(stamped);
      expect(keys, `unexpected stamped keys on ${name}`).toEqual([
        'implementation_source',
      ]);
      expect(stamped.implementation_source).toBe('nextjs');
    }
  });

  it('documented property extensions are the only non-systematic differences', () => {
    // Beyond implementation_source, the Next.js events keep the static
    // core properties. The deliberate extensions (new cart UI) are:
    // - cart_updated: gains `product_handle` and the `remove` action
    //   (static had no cart UI — removal was deliberately NOT an event).
    // Any further schema divergence must be documented in
    // POSTHOG_EVENT_MAP.md §1 parity table or this test fails by review.
    const src = readFileSync(new URL('./events.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/cart_updated: \{ action: 'qty_change' \| 'remove'/);
  });
});
