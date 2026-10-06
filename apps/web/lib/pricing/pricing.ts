/**
 * Deterministic pricing — shared by client AND server (pure functions, no
 * Node-only APIs). CLIENT = PREVIEW, SERVER = AUTHORITY: the client may
 * display these values, but order totals are always recomputed server-side.
 * All money in integer cents. Nothing hard-codes "$12.08".
 */
import { SOAP_SHAPES } from '../catalog/shapes';
import { herbPriceCents } from '../catalog/herbs';

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

/* ---------------- Custom formula builders (G2 capsules, G10 tea) ---------------- */

/**
 * Custom-formula pricing — PROPOSED (pending owner confirmation).
 *
 * Model (ported from the legacy #custom-formula flow, ccLivePrice):
 *   unit price = size base price + Σ per-herb add-on prices.
 * All values integer cents; the SERVER recomputes authoritatively at
 * checkout (CLIENT=PREVIEW). Base prices are the legacy variant prices
 * from the generated product records (LEGACY-SOURCED, owner confirmation
 * recommended); per-herb add-ons are the legacy per-botanical prices
 * ($0.17/$0.23/$0.29/$0.39 → integer cents).
 *
 * KNOWN TENSIONS (NEEDS VERIFICATION, owner decision):
 * - custom-herbal-capsules base $33.33 conflicts with the provisional
 *   "$11.99/oz for custom non-soap remedies" rule (recorded in the product
 *   record provenance); the per-product newest value wins per owner
 *   instruction, price still PROPOSED.
 * - 2-week capsule counts unverified (28 vs 30 capsules in sources).
 */

export type FormulaKind = 'capsule' | 'tea';

export interface FormulaSizeOption {
  id: string;
  name: string;
  unit: string;
  /** Integer cents. Server-authoritative. */
  baseCents: number;
}

/** Product handles for the two custom-formula products (in the catalog). */
export const CUSTOM_CAPSULE_HANDLE = 'custom-herbal-capsules';
export const CUSTOM_TEA_HANDLE = 'custom-tea-blends';

export function formulaKindForHandle(handle: string): FormulaKind | null {
  if (handle === CUSTOM_CAPSULE_HANDLE) return 'capsule';
  if (handle === CUSTOM_TEA_HANDLE) return 'tea';
  return null;
}

export const CUSTOM_CAPSULE_SIZES: readonly FormulaSizeOption[] = [
  { id: 'capsule-28', name: 'Two Week — 28 capsules', unit: '28 capsules', baseCents: 3333 },
  { id: 'capsule-60', name: 'Full Month — 60 capsules', unit: '60 capsules', baseCents: 6000 },
];

export const CUSTOM_TEA_SIZES: readonly FormulaSizeOption[] = [
  { id: 'tea-loose-1oz', name: 'Loose Leaf — 1 oz', unit: '1 oz loose leaf', baseCents: 1333 },
  { id: 'tea-bags-20', name: 'Tea Bags — 20 pack', unit: '20 tea bags', baseCents: 1199 },
];

export function getFormulaSize(
  kind: FormulaKind,
  sizeId: string,
): FormulaSizeOption | undefined {
  const table = kind === 'capsule' ? CUSTOM_CAPSULE_SIZES : CUSTOM_TEA_SIZES;
  return table.find((s) => s.id === sizeId);
}

/**
 * Client-preview unit price for a custom formula: size base + per-herb
 * add-ons, integer cents. The server MUST recompute this identically at
 * checkout (see priceFormulaCustomization in lib/cart/validation.ts) —
 * any mismatch rejects the order.
 */
export function customFormulaPriceCents(
  kind: FormulaKind,
  sizeId: string,
  herbIds: string[],
): number {
  const size = getFormulaSize(kind, sizeId);
  if (!size) throw new Error(`Unknown formula size: ${sizeId}`);
  let total = size.baseCents;
  for (const id of herbIds) {
    total += herbPriceCents(id);
  }
  return total;
}
