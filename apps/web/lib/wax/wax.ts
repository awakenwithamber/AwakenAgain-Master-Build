/**
 * Wax finish — shared vocabulary for the soy/beeswax choice
 * (owner ruling 2026-10-30; storewide directive 2026-11-13).
 *
 * GROUNDING (see ~/workspace/wax-customization-2026-11-13/SUITABILITY-MATRIX.md):
 * - Wax exists in exactly THREE catalog formulas — the balms
 *   (Radiance Renewal, Soothe & Restore, Custom Botanical Balm) — and
 *   in the Custom Balm Builder. Every other verified formula contains
 *   no wax, so no other product may show a wax selector.
 * - The choice is price-neutral (owner ruling): both finishes carry
 *   the identical price everywhere. The default is always Soy Wax —
 *   nothing here substitutes a finish silently.
 * - The ONLY soy source in any of the three balm formulas is the soy
 *   wax itself (no soy lecithin / soybean oil / other soy derivative
 *   exists anywhere in the catalog). Cross-contact is NOT documented
 *   in any source and the records' allergen text is derived from the
 *   ingredient list only, so this module never calls a product
 *   "soy-free" or allergy-safe as a blanket claim — the customer-facing
 *   wording is the owner's own option label and sensitivity note.
 * - Beeswax is a bee product (not vegan); it is disclosed as such.
 *
 * Premade balm variants historically encoded the finish in the variant
 * NAME only (and beeswax twins carry `sku: null`). Records now also
 * carry the structured `wax_finish` field; `variantWaxFinish` reads
 * the field first and falls back to the name so older/derived data
 * still resolves deterministically.
 */
import type { OrderLine } from '../checkout/order';
import type { Product, ProductVariant } from '../../types';

export type WaxFinish = 'soy-wax' | 'beeswax';

export interface WaxOption {
  id: WaxFinish;
  /** Owner's display label (directive 2026-11-13). */
  label: string;
  /** Short name used inside running text (e.g. order line titles). */
  shortName: string;
}

export const WAX_OPTIONS: readonly WaxOption[] = [
  {
    id: 'soy-wax',
    label: 'Soy Wax — Standard Formula',
    shortName: 'Soy Wax (standard)',
  },
  {
    id: 'beeswax',
    label: 'Beeswax — Soy-Free Wax Alternative',
    shortName: 'Beeswax (soy-free alternative)',
  },
];

/** The owner's sensitivity note, verbatim (directive 2026-11-13). Displayed with every wax selector. */
export const WAX_SENSITIVITY_NOTE =
  'Sensitive or allergic to soy? Select our beeswax alternative where available. Each formula is handcrafted with your selected wax.';

export function waxOption(id: string): WaxOption | undefined {
  return WAX_OPTIONS.find((o) => o.id === id);
}

/** Display label for a record variant name, upgraded to the owner's option wording. Identity (the stored name) is never changed. */
export function waxVariantDisplayName(name: string): string {
  return name
    .replace('Soy Wax (standard)', 'Soy Wax — Standard Formula')
    .replace(
      'Beeswax (soy-free alternative)',
      'Beeswax — Soy-Free Wax Alternative',
    );
}

/**
 * The wax finish a catalog variant represents, or null when the
 * variant carries no wax choice. Structured field first, then the
 * historical name encoding.
 */
export function variantWaxFinish(
  variant: ProductVariant | undefined | null,
): WaxFinish | null {
  if (!variant) return null;
  const field = (variant as { wax_finish?: unknown }).wax_finish;
  if (field === 'soy-wax' || field === 'beeswax') return field;
  const name = typeof variant.name === 'string' ? variant.name : '';
  if (/beeswax/i.test(name)) return 'beeswax';
  if (/soy wax/i.test(name)) return 'soy-wax';
  return null;
}

/** True when the product offers a wax finish choice (any variant carries one). */
export function productHasWaxChoice(product: Product): boolean {
  return (product.variants ?? []).some(
    (v) => variantWaxFinish(v) !== null,
  );
}

/**
 * The ingredient declaration for a SELECTED finish, derived from the
 * record's standard-formula list. The premade balm records state the
 * standard list with soy wax and note in the same text that "in that
 * version beeswax replaces the soy wax" — this performs exactly that
 * documented replacement for the beeswax finish, and replaces the
 * both-finishes parenthetical with the selected-finish statement.
 *
 * Safety rails: text that presents the choice itself (the Custom
 * Botanical Balm framework text — "your choice of soy wax (standard)
 * or beeswax") is returned unchanged, as is any text with no soy wax.
 * No ingredient is ever added or removed beyond the wax token the
 * record itself names.
 */
export function ingredientsForWaxFinish(
  completeIngredients: string,
  finish: WaxFinish,
): string {
  if (finish === 'soy-wax') return completeIngredients;
  if (/your choice of soy wax/i.test(completeIngredients)) {
    return completeIngredients;
  }
  if (!/soy wax/i.test(completeIngredients)) return completeIngredients;
  const swapped = completeIngredients.replace(/soy wax/gi, 'beeswax');
  return swapped.replace(
    /\s*\(Standard finish is beeswax per owner ruling[^)]*\)/,
    ' (Beeswax finish — selected in place of the standard soy wax finish.)',
  );
}

/**
 * Customer/production display title for an order line: the recorded
 * title plus the selected formulation, so the wax finish the customer
 * chose survives onto the confirmation email, the order-status view,
 * and the admin production list. Builder (formula) lines resolve the
 * finish from the persisted `formula.base_id`; premade lines from the
 * recorded variant name / variant id encoding.
 */
export function orderLineDisplayTitle(line: OrderLine): string {
  const formula = line.formula as
    | { base_id?: unknown; size_id?: unknown }
    | undefined;
  if (formula && typeof formula.base_id === 'string') {
    const opt = waxOption(formula.base_id);
    if (opt) {
      // Recorded formula titles already end in "(your formula)" and
      // carry the size — insert the finish ahead of that suffix.
      return line.title.includes('(your formula)')
        ? line.title.replace(
            ' (your formula)',
            ` — ${opt.shortName} (your formula)`,
          )
        : `${line.title} — ${opt.shortName} (your formula)`;
    }
  }
  if (line.variant_name) {
    return `${line.title} — ${waxVariantDisplayName(line.variant_name)}`;
  }
  if (line.variant_id) {
    const finish = variantWaxFinish({ name: line.variant_id });
    if (finish) {
      const opt = waxOption(finish);
      if (opt) return `${line.title} — ${opt.shortName}`;
    }
  }
  return line.title;
}
