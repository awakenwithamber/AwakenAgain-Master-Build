/**
 * PostHog event taxonomy for the custom formula builders (G2 capsules,
 * G10 tea) — Amber's Alchemy Apothecary.
 *
 * SEPARATE MODULE — do not merge into lib/analytics/events.ts without the
 * coordinator: events.ts carries a compile-time 22-event count guard, and
 * the ownership-transfer lifecycle tracks those 22 events. This module is
 * the pending-merge proposal for the builder events. Every event below
 * carries `implementation_source: 'nextjs'` and full traceability
 * (name → reason → legacy equivalent → owner → purpose) per the Phase 2
 * directive. Consolidation with the canonical taxonomy (e.g. reusing
 * `builder_step_viewed` / `blend_completed`) is the coordinator's merge
 * decision — the names here are deliberately prefixed so nothing collides
 * in the meantime.
 *
 * PostHog stays observational: PII, payment data, and secrets never appear
 * in properties (herb_ids are ingredient IDs only, like oils[] in the soap
 * taxonomy). WIRED, never IMPLEMENTED — receipt is BLOCKED on the owner's
 * phc_ key.
 */
import { initPostHog } from './posthog';
import { ANALYTICS_SOURCE, SOURCE_PROPERTY } from './events';

/** Builder event names. Add new events here — never inline a string elsewhere. */
export const BUILDER_ANALYTICS_EVENT_NAMES = {
  formulaBuilderStarted: 'formula_builder_started',
  formulaStepViewed: 'formula_builder_step_viewed',
  formulaHerbSelected: 'formula_herb_selected',
  formulaHerbRemoved: 'formula_herb_removed',
  formulaSafetyFlagShown: 'formula_safety_flag_shown',
  formulaBlendCompleted: 'formula_blend_completed',
  formulaAddedToCart: 'formula_added_to_cart',
  teaBuilderStarted: 'tea_builder_started',
  teaStepViewed: 'tea_builder_step_viewed',
  teaHerbSelected: 'tea_herb_selected',
  teaHerbRemoved: 'tea_herb_removed',
  teaSafetyFlagShown: 'tea_safety_flag_shown',
  teaBlendCompleted: 'tea_blend_completed',
  teaAddedToCart: 'tea_added_to_cart',
} as const;

export type BuilderEventName =
  (typeof BUILDER_ANALYTICS_EVENT_NAMES)[keyof typeof BUILDER_ANALYTICS_EVENT_NAMES];

/** Property schema per event. Invalid payloads fail at compile time. */
export interface BuilderEventProperties {
  formula_builder_started: Record<string, never>;
  formula_builder_step_viewed: { step: number; step_name: string };
  formula_herb_selected: { herb_id: string; herb_count: number };
  formula_herb_removed: { herb_id: string; herb_count: number };
  formula_safety_flag_shown: {
    flag_count: number;
    max_severity: string;
    unknown_pair_count: number;
  };
  formula_blend_completed: {
    herb_ids: string[];
    herb_count: number;
    size_id: string;
  };
  formula_added_to_cart: {
    size_id: string;
    herb_ids: string[];
    herb_count: number;
    unit_price_cents: number;
    quantity: number;
  };
  tea_builder_started: Record<string, never>;
  tea_builder_step_viewed: { step: number; step_name: string };
  tea_herb_selected: { herb_id: string; herb_count: number };
  tea_herb_removed: { herb_id: string; herb_count: number };
  tea_safety_flag_shown: {
    flag_count: number;
    max_severity: string;
    unknown_pair_count: number;
  };
  tea_blend_completed: { herb_ids: string[]; herb_count: number; size_id: string };
  tea_added_to_cart: {
    size_id: string;
    herb_ids: string[];
    herb_count: number;
    unit_price_cents: number;
    quantity: number;
  };
}

/** Compile-time-checked properties for a builder event name. */
export type BuilderEventProps<E extends BuilderEventName = BuilderEventName> =
  BuilderEventProperties[E];

export type BuilderEventOwner = 'client' | 'server';

/**
 * Ownership: every builder event is client-owned — only the browser
 * observes these interactions. No server-owned builder events exist yet;
 * a server event (e.g. formula order accepted) would be recorded by the
 * checkout handler's existing order_created event, not duplicated here.
 */
export const BUILDER_EVENT_OWNERSHIP: Record<BuilderEventName, BuilderEventOwner> = {
  formula_builder_started: 'client',
  formula_builder_step_viewed: 'client',
  formula_herb_selected: 'client',
  formula_herb_removed: 'client',
  formula_safety_flag_shown: 'client',
  formula_blend_completed: 'client',
  formula_added_to_cart: 'client',
  tea_builder_started: 'client',
  tea_builder_step_viewed: 'client',
  tea_herb_selected: 'client',
  tea_herb_removed: 'client',
  tea_safety_flag_shown: 'client',
  tea_blend_completed: 'client',
  tea_added_to_cart: 'client',
};

/**
 * Traceability per the Phase 2 directive:
 * name → reason → legacy equivalent → owner → purpose.
 */
export interface BuilderEventTrace {
  reason: string;
  legacyEquivalent: string;
  owner: BuilderEventOwner;
  purpose: string;
}

export const BUILDER_EVENT_TRACEABILITY: Record<BuilderEventName, BuilderEventTrace> = {
  formula_builder_started: {
    reason: 'Funnel entry for the G2 capsule builder — measures builder discovery.',
    legacyEquivalent: 'none (legacy #custom-formula had no analytics)',
    owner: 'client',
    purpose: 'Count capsule-builder sessions for conversion analysis.',
  },
  formula_builder_step_viewed: {
    reason: 'Step-level funnel for the capsule ritual (size → herbs → safety → reveal).',
    legacyEquivalent: 'none (legacy cc steps had no analytics)',
    owner: 'client',
    purpose: 'Find drop-off steps in the capsule builder.',
  },
  formula_herb_selected: {
    reason: 'Observe which botanicals customers choose for capsules.',
    legacyEquivalent: 'none',
    owner: 'client',
    purpose: 'Herb popularity + formula composition insights (ingredient IDs only).',
  },
  formula_herb_removed: {
    reason: 'Symmetric removal signal for herb selection.',
    legacyEquivalent: 'none',
    owner: 'client',
    purpose: 'Distinguish exploration from final formulas.',
  },
  formula_safety_flag_shown: {
    reason: 'The safety module is a core differentiator — measure flag exposure.',
    legacyEquivalent: 'none (legacy had a checkbox, no flags)',
    owner: 'client',
    purpose: 'Correlate flag severity with completion; prove flags render.',
  },
  formula_blend_completed: {
    reason: 'Capsule ritual completed (reveal reached with a valid formula).',
    legacyEquivalent: 'none',
    owner: 'client',
    purpose: 'Builder completion rate — the revenue-funnel midpoint.',
  },
  formula_added_to_cart: {
    reason: 'Custom capsule formula added to the single cart.',
    legacyEquivalent: 'none (legacy addItemToCart was unwired)',
    owner: 'client',
    purpose: 'Builder-to-cart conversion with price + composition context.',
  },
  tea_builder_started: {
    reason: 'Funnel entry for the G10 tea builder.',
    legacyEquivalent: 'none (legacy tea section was stubs)',
    owner: 'client',
    purpose: 'Count tea-builder sessions for conversion analysis.',
  },
  tea_builder_step_viewed: {
    reason: 'Step-level funnel for the tea ritual.',
    legacyEquivalent: 'none',
    owner: 'client',
    purpose: 'Find drop-off steps in the tea builder.',
  },
  tea_herb_selected: {
    reason: 'Observe which botanicals customers choose for teas.',
    legacyEquivalent: 'none',
    owner: 'client',
    purpose: 'Herb popularity + blend composition insights (ingredient IDs only).',
  },
  tea_herb_removed: {
    reason: 'Symmetric removal signal for tea herb selection.',
    legacyEquivalent: 'none',
    owner: 'client',
    purpose: 'Distinguish exploration from final blends.',
  },
  tea_safety_flag_shown: {
    reason: 'Measure safety-flag exposure in the tea builder.',
    legacyEquivalent: 'none',
    owner: 'client',
    purpose: 'Correlate flag severity with completion; prove flags render.',
  },
  tea_blend_completed: {
    reason: 'Tea ritual completed (reveal reached with a valid blend).',
    legacyEquivalent: 'none',
    owner: 'client',
    purpose: 'Tea builder completion rate.',
  },
  tea_added_to_cart: {
    reason: 'Custom tea blend added to the single cart.',
    legacyEquivalent: 'none',
    owner: 'client',
    purpose: 'Tea builder-to-cart conversion with price + composition context.',
  },
};

const PROJECT_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? '';

/** Inert until configured — mirrors lib/analytics/posthog.ts. Never throws. */
function isConfigured(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!PROJECT_TOKEN &&
    PROJECT_TOKEN !== 'POSTHOG_KEY_PLACEHOLDER' &&
    !PROJECT_TOKEN.startsWith('REPLACE_')
  );
}

/**
 * Pure and testable: stamps the migration source property on EVERY event,
 * so no caller can forget it.
 */
export function buildBuilderEventPayload<E extends BuilderEventName>(
  props: BuilderEventProperties[E],
): BuilderEventProperties[E] & { implementation_source: 'nextjs' } {
  return { ...props, [SOURCE_PROPERTY]: ANALYTICS_SOURCE };
}

/**
 * Typed tracking for builder events. Drops silently when unconfigured
 * (no key yet) — analytics must never break the customer experience.
 * Call ONLY from event handlers, never from render paths.
 */
export function trackBuilderEvent<E extends BuilderEventName>(
  event: E,
  props: BuilderEventProperties[E],
): void {
  if (!isConfigured()) return;
  const payload = buildBuilderEventPayload(props);
  initPostHog()
    .then(() => import('posthog-js'))
    .then(({ default: posthog }) => {
      posthog.capture(event, payload as Record<string, unknown>);
    })
    .catch(() => {
      /* analytics failures are never customer-facing */
    });
}

/** Idempotent variant for once-per-session events. */
const firedKeys = new Set<string>();
export function trackBuilderEventOnce<E extends BuilderEventName>(
  key: string,
  event: E,
  props: BuilderEventProperties[E],
): void {
  if (firedKeys.has(key)) return;
  firedKeys.add(key);
  trackBuilderEvent(event, props);
}
