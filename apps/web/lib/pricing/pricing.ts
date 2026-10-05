/**
 * Deterministic pricing — shared by client AND server (pure functions, no
 * Node-only APIs). CLIENT = PREVIEW, SERVER = AUTHORITY: the client may
 * display these values, but order totals are always recomputed server-side.
 * All money in integer cents. Nothing hard-codes "$12.08".
 */
import { SOAP_SHAPES } from '../catalog/shapes';

export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Owner-confirmed canonical prices (cents), 2026-10-05. */
export const CANONICAL_PRICES = {
  capsuleTwoWeekCents: 1977,
  capsuleThirtyDayCents: 4777,
  omega3Cents: 5477,
  grimoireMonthlyCents: 777,
} as const;

/* ---------------- The Alchemy Soap Collection bundle ---------------- */

export const BUNDLE_ID = 'soap-style-collection-5';
export const BUNDLE_NAME = 'The Alchemy Soap Collection';
/** Owner-confirmed 2026-10-05 (was $55). */
export const BUNDLE_PRICE_CENTS = 3577;
export const BUNDLE_SLOT_SHAPES: readonly string[] = [
  'small-rose',
  'medium-rose',
  'plain-rectangle',
  'wave-rectangle',
  'floral-round',
];

/** Sum of the 5 current per-shape prices. Derived, never hard-coded. */
export function bundleComponentSumCents(): number {
  return BUNDLE_SLOT_SHAPES.reduce((sum, id) => {
    const shape = SOAP_SHAPES.find((s) => s.id === id);
    if (!shape) throw new Error(`Unknown bundle slot shape: ${id}`);
    return sum + shape.priceCents;
  }, 0);
}

/** Genuine savings, computed live from the canonical shape table. */
export function bundleSavingsCents(): number {
  return bundleComponentSumCents() - BUNDLE_PRICE_CENTS;
}

export function bundleSavingsPct(): number {
  const sum = bundleComponentSumCents();
  return Math.round((bundleSavingsCents() / sum) * 1000) / 10;
}
