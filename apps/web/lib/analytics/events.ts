/**
 * Typed PostHog event taxonomy for Amber's Alchemy Apothecary.
 * Ported from soap-shop-build/assets/POSTHOG_EVENTS.md (v2, DRAFT).
 * snake_case names, past-tense verbs, one event per user action.
 * NO PII, payment data, or secrets in any property — oils[] are ingredient IDs only.
 */
import type { ScentSelection as ScentPayload } from '../../types';

/**
 * Implementation-source tagging (migration).
 *
 * Every event emitted by this Next.js app carries
 * `implementation_source: 'nextjs'` (super property on the client, explicit
 * payload property on the server). The staged static build uses
 * `implementation_source: 'legacy_static'`. This prevents double counting
 * while both surfaces are live and enables static-baseline vs Next.js
 * behavioral comparison in PostHog (break down any funnel or insight by
 * `implementation_source`).
 *
 * PostHog is observational only — the cart, order ledger, and database stay
 * authoritative. Status vocabulary: WIRED (code exists) / BLOCKED (waiting
 * on the owner's phc_ key). Analytics is NEVER marked IMPLEMENTED here.
 *
 * HARD BOUNDARY (owner 2026-10-05): PostHog = behavioral observation,
 * funnels, migration comparison, experimentation. Server/database =
 * authoritative pricing, orders, customers, membership, fulfillment,
 * business records. A checkout interaction is behavioral; a server-validated
 * accepted order is authoritative business state recorded as an observed
 * fact — modeled and named accordingly, never conflated. Behavioral events
 * read as observations ("customer viewed instructions"); recorded-fact
 * events read as facts ("server accepted order"), never as the authority
 * itself. The ledger (or database), not any event, is the authority.
 */
export const SOURCE_PROPERTY = 'implementation_source' as const;
export const ANALYTICS_SOURCE = 'nextjs' as const;
export const LEGACY_ANALYTICS_SOURCE = 'legacy_static' as const;

/** Canonical event names. Add new events here — never inline a string elsewhere. */
export const ANALYTICS_EVENT_NAMES = {
  builderStepViewed: 'builder_step_viewed',
  ritualCompleted: 'ritual_completed',
  baseSelected: 'base_selected',
  shapeSelected: 'shape_selected',
  scentSelected: 'scent_selected',
  blendOilToggled: 'blend_oil_toggled',
  blendCompleted: 'blend_completed',
  botanicalSelected: 'botanical_selected',
  colorSelected: 'color_selected',
  soapAddedToCart: 'soap_added_to_cart',
  cartUpdated: 'cart_updated',
  bundleOpened: 'bundle_opened',
  bundleSlotConfigured: 'bundle_slot_configured',
  bundleAddedToCart: 'bundle_added_to_cart',
  shopScentCardClicked: 'shop_scent_card_clicked',
  shopBundleCardClicked: 'shop_bundle_card_clicked',
  seasonalScentInteracted: 'seasonal_scent_interacted',
  checkoutInitiated: 'checkout_initiated',
  /** Client: customer reached a product detail page (discovery → product view). */
  productViewed: 'product_viewed',
  /** Client: order confirmation rendered — Cash App/Venmo instructions shown. */
  paymentInstructionsViewed: 'payment_instructions_viewed',
  orderCompleted: 'order_completed',
  /**
   * Server-owned: the checkout Route Handler accepted and persisted the
   * order. This event RECORDS the fact — it is not the authority itself.
   * The order ledger (later the database) is the authority; this event is
   * the canonical observed revenue count, PostHog staying observational.
   */
  orderCreated: 'order_created',
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENT_NAMES)[keyof typeof ANALYTICS_EVENT_NAMES];

interface BundleSlotProps {
  slot_index: number;
  shape: string;
  base: string;
  scent_path: 'signature' | 'custom_blend';
  recipe_id?: string;
  oils?: string[];
  oil_count?: number;
  botanical: string | null;
  color: string;
}

/** Property schema per event. Invalid payloads fail at compile time. */
export interface AnalyticsEventProperties {
  builder_step_viewed: { step: number; step_name: string };
  ritual_completed: Record<string, never>;
  base_selected: { base: string };
  shape_selected: { shape: string };
  scent_selected: {
    path: 'signature' | 'custom_blend';
    recipe_id?: string;
    oils?: string[];
    oil_count?: number;
    profile_tags?: string[];
  };
  blend_oil_toggled: {
    oil_id: string;
    selected: boolean;
    oil_count: number;
    slot_index?: number;
  };
  blend_completed: { oils: string[]; profile_tags: string[]; oil_count: number; slot_index?: number };
  botanical_selected: { botanical: string };
  color_selected: { color_name: string; color_hex: string; custom: boolean };
  soap_added_to_cart: {
    base: string;
    shape: string;
    scent: ScentPayload;
    botanical: string | null;
    color: string;
    bundle_mode: boolean;
  };
  cart_updated: { action: 'qty_change' | 'remove'; product_handle: string; qty?: number };
  bundle_opened: Record<string, never>;
  bundle_slot_configured: { via: 'theme_apply' | 'slot_edit' } & BundleSlotProps;
  bundle_added_to_cart: {
    bundle_id: string;
    /** Computed integer cents — never hard-coded. */
    price_cents: number;
    savings_cents: number;
    slot_count: number;
    slots: BundleSlotProps[];
  };
  shop_scent_card_clicked: { recipe_id: string };
  shop_bundle_card_clicked: { bundle_id: string };
  seasonal_scent_interacted: { season_id: string };
  checkout_initiated: Record<string, never>;
  product_viewed: { product_handle: string; category?: string };
  payment_instructions_viewed: { order_id: string };
  order_completed: { order_id: string; total_cents: number; item_count: number };
  /**
   * Server-owned order event. Payload is deliberately minimal:
   * order_id/total_cents/item_count ONLY — never customer PII, never
   * payment details. The order ledger (and later the database) is the
   * source of truth; this event is observational.
   */
  order_created: { order_id: string; total_cents: number; item_count: number };
}

/** Compile-time-checked properties for an event name. */
export type EventProps<E extends AnalyticsEventName = AnalyticsEventName> =
  AnalyticsEventProperties[E];

export type EventOwner = 'client' | 'server';

/**
 * Binding ownership table (§6): CLIENT owns customer-interaction events
 * (only the browser observes them); SERVER owns authoritative business
 * transitions (only the server can attest them). A client event must never
 * be re-emitted by the server for the same action and vice versa — this
 * map is the dedupe contract.
 *
 * 21 of the 22 events are client-owned (the interaction baseline).
 * `order_created` is the first server-owned event: emitted exactly once by
 * the checkout Route Handler after the order is validated + persisted.
 * `order_completed` stays client-owned — it answers "the customer saw the
 * confirmation / Cash App + Venmo instructions", not "the order was
 * accepted". The two events describe different actions, so they do not
 * duplicate each other; the server event is the canonical revenue count.
 *
 * `satisfies` (not a `Record` annotation) keeps the per-event literal types
 * so ServerEventName / ClientEventName below resolve correctly.
 */
export const EVENT_OWNERSHIP = {
  builder_step_viewed: 'client',
  ritual_completed: 'client',
  base_selected: 'client',
  shape_selected: 'client',
  scent_selected: 'client',
  blend_oil_toggled: 'client',
  blend_completed: 'client',
  botanical_selected: 'client',
  color_selected: 'client',
  soap_added_to_cart: 'client',
  cart_updated: 'client',
  bundle_opened: 'client',
  bundle_slot_configured: 'client',
  bundle_added_to_cart: 'client',
  shop_scent_card_clicked: 'client',
  shop_bundle_card_clicked: 'client',
  seasonal_scent_interacted: 'client',
  checkout_initiated: 'client',
  product_viewed: 'client',
  payment_instructions_viewed: 'client',
  order_completed: 'client',
  order_created: 'server',
} satisfies Record<AnalyticsEventName, EventOwner>;

/** Event names the server-side capturer may emit (compile-time enforced). */
export type ServerEventName = {
  [K in AnalyticsEventName]: (typeof EVENT_OWNERSHIP)[K] extends 'server'
    ? K
    : never;
}[AnalyticsEventName];

/**
 * Ownership-transfer lifecycle (owner precision 2026-10-05). Order is
 * exact and binding:
 *
 * LEGACY STATIC ACTIVE → NEXT.JS REPLACEMENT BUILT → FEATURE TESTED →
 * POSTHOG EVENT RECEIVED + VERIFIED → PARITY VERIFIED →
 * NEXT.JS AUTHORITATIVE → LEGACY FEATURE/EVENT SAFE TO RETIRE
 *
 * Ownership transfers ONLY after the Next.js replacement is VERIFIED —
 * never on code conversion alone. No event may sit beyond FEATURE TESTED
 * without the owner's phc_ project key installed AND observed event receipt
 * in PostHog Live Events; the stage-gate regression test
 * (ownership-transfer.test.ts) enforces this while the key is absent.
 *
 * Two dimensions, never conflated: `ownership_stage` tracks how far
 * ownership has transferred for the event; the PostHog dimension (WIRED /
 * BLOCKED / receipt VERIFIED / IMPLEMENTED) tracks whether PostHog has
 * actually observed it. A static counterpart can be LEGACY STATIC ACTIVE
 * (feature live) while its PostHog status is WIRED — inert without the
 * key, never IMPLEMENTED.
 */
export const OWNERSHIP_STAGE_ORDER = [
  'legacy_static_active',
  'nextjs_replacement_built',
  'feature_tested',
  'event_received_verified',
  'parity_verified',
  'nextjs_authoritative',
  'legacy_safe_to_retire',
] as const;

export type OwnershipStage = (typeof OWNERSHIP_STAGE_ORDER)[number];

/** Index of a stage in the lifecycle order — the stage-gate test's yardstick. */
export function ownershipStageIndex(stage: OwnershipStage): number {
  return OWNERSHIP_STAGE_ORDER.indexOf(stage);
}

/**
 * Per-event ownership stage (2026-10-05 current truth). No phc_ key exists,
 * so no event sits beyond FEATURE TESTED. `shop_scent_card_clicked` and
 * `shop_bundle_card_clicked` are taxonomy-reserved names only — their
 * Next.js emission wiring does not exist yet, so they remain
 * LEGACY STATIC ACTIVE (the static counterpart is the active
 * implementation; WIRED, not IMPLEMENTED, on both sides).
 *
 * Stage semantics:
 * - legacy_static_active: transfer not started; Next.js replacement not
 *   yet built/wired.
 * - nextjs_replacement_built: emission code wired into the Next.js feature.
 * - feature_tested: feature exists, emission wired, feature/contract tests
 *   passing. PostHog receipt still BLOCKED on the owner's key.
 *
 * Updating any event beyond feature_tested requires BOTH the key AND
 * verified event receipt; the stage-gate test fails otherwise.
 */
export const OWNERSHIP_STAGES: Record<AnalyticsEventName, OwnershipStage> = {
  builder_step_viewed: 'feature_tested',
  ritual_completed: 'feature_tested',
  base_selected: 'feature_tested',
  shape_selected: 'feature_tested',
  scent_selected: 'feature_tested',
  blend_oil_toggled: 'feature_tested',
  blend_completed: 'feature_tested',
  botanical_selected: 'feature_tested',
  color_selected: 'feature_tested',
  soap_added_to_cart: 'feature_tested',
  cart_updated: 'feature_tested',
  bundle_opened: 'feature_tested',
  bundle_slot_configured: 'feature_tested',
  bundle_added_to_cart: 'feature_tested',
  shop_scent_card_clicked: 'legacy_static_active',
  shop_bundle_card_clicked: 'legacy_static_active',
  seasonal_scent_interacted: 'feature_tested',
  checkout_initiated: 'feature_tested',
  product_viewed: 'feature_tested',
  payment_instructions_viewed: 'feature_tested',
  order_completed: 'feature_tested',
  order_created: 'feature_tested',
};

/**
 * Server-owned events still planned for later API phases (§6). Reserved
 * names — the taxonomy must not gain a client event with any of these names.
 * `order_created` was promoted from this list to a real server event
 * (2026-10-05): emitted by `POST /api/checkout` via
 * `lib/analytics/posthog-server.ts`.
 * PostHog remains observational: the order/cart/database is the source of truth.
 */
export const SERVER_EVENTS_PLANNED = [
  'cart_configuration_accepted',
  'pricing_validation_passed',
  'pricing_validation_failed',
  'subscription_confirmed',
] as const;

/** Guard: planned server events must not collide with the client taxonomy. */
const _collisionCheck: readonly string[] = SERVER_EVENTS_PLANNED.filter((n) =>
  (Object.values(ANALYTICS_EVENT_NAMES) as string[]).includes(n),
);
if (_collisionCheck.length > 0) {
  throw new Error(`Analytics ownership collision: ${(_collisionCheck as string[]).join(', ')}`);
}

/** The 22-event count is a contract — bump deliberately, not accidentally. */
const EVENT_COUNT = 22;
const _countCheck: Record<AnalyticsEventName, true> = {
  builder_step_viewed: true,
  ritual_completed: true,
  base_selected: true,
  shape_selected: true,
  scent_selected: true,
  blend_oil_toggled: true,
  blend_completed: true,
  botanical_selected: true,
  color_selected: true,
  soap_added_to_cart: true,
  cart_updated: true,
  bundle_opened: true,
  bundle_slot_configured: true,
  bundle_added_to_cart: true,
  shop_scent_card_clicked: true,
  shop_bundle_card_clicked: true,
  seasonal_scent_interacted: true,
  checkout_initiated: true,
  product_viewed: true,
  payment_instructions_viewed: true,
  order_completed: true,
  order_created: true,
};
if (Object.keys(_countCheck).length !== EVENT_COUNT) {
  throw new Error('Analytics taxonomy drift: expected 22 events');
}
