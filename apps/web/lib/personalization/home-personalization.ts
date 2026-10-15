/**
 * Homepage personalization rules (owner spec 2026-10-14). Pure functions
 * over the interest profile — the React wrapper (components/home/
 * PersonalizedSections.tsx) only applies what these return, AFTER mount,
 * so server-rendered/default order is byte-identical for every visitor
 * who hasn't consented or has no clear top interest.
 *
 * REORDER RULE (simple + explainable): among the reorderable content
 * sections, the section matching the visitor's clear top interest moves
 * first; every other section keeps its default relative order.
 *   soaps    → Best Sellers first (the shop section)
 *   herbs    → Learn first (herbal medicine education)
 *   articles → Learn first (articles & guides live there)
 *   quiz     → Goal Cards first ("What can we help you with?" — the
 *              guided path, sibling to the quiz)
 *   readings → no homepage section is a readings section: no reorder
 *              (the "Picked for you" row still personalizes).
 *   grimoire → NEVER reorders anything down: the Grimoire promotion is
 *              outside the reorderable set and keeps its promoted place;
 *              a grimoire top interest only adds an emphasis treatment.
 *
 * PICKS RULE ("Picked for you", up to 3): catalog products in the
 * interest's catalog category, in canonical catalog order, superseded
 * products excluded — deterministic, no scoring black box. Quiz picks
 * are the three goal formulas the Herbal Allies Quiz recommends from.
 */
import type { Product } from '../../types';
import { isSupersededProduct } from '../catalog/status';
import type { InterestCategory } from './interests';

/** Homepage content sections that may be reordered (hero/video/promo are not in this set). */
export const HOME_SECTION_KEYS = [
  'goal-cards',
  'best-sellers',
  'how-made',
  'trust-stats',
  'reviews',
  'learn',
] as const;

export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

/** Default (server-rendered) order — identical for non-personalized visitors. */
export const DEFAULT_HOME_ORDER: readonly HomeSectionKey[] = HOME_SECTION_KEYS;

const INTEREST_TO_SECTION: Record<InterestCategory, HomeSectionKey | null> = {
  soaps: 'best-sellers',
  herbs: 'learn',
  articles: 'learn',
  quiz: 'goal-cards',
  readings: null,
  grimoire: null,
};

/**
 * Compute the section order for a top interest (or null → default).
 * The target section moves to the front of the reorderable set; all
 * other sections keep their default relative order (stable move).
 */
export function orderHomeSections(
  top: InterestCategory | null,
): readonly HomeSectionKey[] {
  if (!top) return DEFAULT_HOME_ORDER;
  const target = INTEREST_TO_SECTION[top];
  if (!target) return DEFAULT_HOME_ORDER;
  return [target, ...DEFAULT_HOME_ORDER.filter((key) => key !== target)];
}

/** The Grimoire promotion is emphasized (never demoted) for grimoire lovers. */
export function emphasizeGrimoire(top: InterestCategory | null): boolean {
  return top === 'grimoire';
}

const INTEREST_TO_CATALOG_CATEGORY: Partial<Record<InterestCategory, string>> = {
  soaps: 'Soaps',
  herbs: 'Capsules',
  readings: 'Services',
  grimoire: 'Grimoire & Digital',
};

/** Curated quiz-interest picks: the goal formulas the quiz recommends from. */
export const QUIZ_PICK_HANDLES: readonly string[] = [
  'dreamease-capsules',
  'chill-pill-capsules',
  'sacred-balance-capsules',
];

/**
 * Up to `limit` product handles picked for an interest, in deterministic
 * order. Products come from the canonical PRODUCTS array (catalog order);
 * superseded products are never picked. Articles have no product picks —
 * the row links journal articles instead (handled by the component).
 */
export function pickHandlesForInterest(
  top: InterestCategory | null,
  products: readonly Product[],
  limit = 3,
): string[] {
  if (!top || limit <= 0) return [];
  const byHandle = new Map(products.map((p) => [p.handle, p]));
  const usable = (p: Product | undefined): p is Product =>
    !!p && !isSupersededProduct(p);

  if (top === 'quiz') {
    return QUIZ_PICK_HANDLES.map((h) => byHandle.get(h))
      .filter(usable)
      .map((p) => p.handle)
      .slice(0, limit);
  }
  const category = INTEREST_TO_CATALOG_CATEGORY[top];
  if (!category) return [];
  return products
    .filter((p) => p.category === category && usable(p))
    .slice(0, limit)
    .map((p) => p.handle);
}
