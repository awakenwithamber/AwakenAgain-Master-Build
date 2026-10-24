/**
 * Herb catalog barrel (GENERATED — do not hand-edit).
 * Data lives in lib/catalog/herbs-data/part-*.ts (sharded for transport;
 * entry order preserved). Public API unchanged: HERBS, getHerb,
 * herbsForUse, herbPriceCents.
 */
import type { Herb } from '../../types';
import { HERBS_PART_1 } from './herbs-data/part-1';
import { HERBS_PART_2 } from './herbs-data/part-2';
import { HERBS_PART_3 } from './herbs-data/part-3';
import { HERBS_PART_4 } from './herbs-data/part-4';
import { HERB_CAUTIONS } from './herb-cautions';
import { HERB_BENEFITS_SUPPLEMENT } from './herb-benefits-supplement';
import { HERB_REFERENCES } from './herb-references';

/**
 * The public herb list. The generated shards are never hand-edited;
 * sourced overlays are applied here, in this barrel:
 *
 * - Stage 4 (R-21): the optional `caution` field, from herb-cautions.ts.
 * - Herbal Index Phase 1 (Batch 01, owner-approved 2026-10-23):
 *   benefits 4–5 appended from herb-benefits-supplement.ts and the
 *   `references` field populated from herb-references.ts — each new
 *   benefit paired to a source in the record's own references.
 *
 * Records with no overlay entry are returned untouched and render
 * exactly what their shard carries.
 */
export const HERBS: readonly Herb[] = [
  ...HERBS_PART_1,
  ...HERBS_PART_2,
  ...HERBS_PART_3,
  ...HERBS_PART_4,
].map((herb) => {
  const caution = HERB_CAUTIONS[herb.id];
  const supplement = HERB_BENEFITS_SUPPLEMENT[herb.id];
  const references = HERB_REFERENCES[herb.id];
  if (!caution && !supplement && !references) return herb;
  return {
    ...herb,
    ...(caution ? { caution } : {}),
    ...(supplement
      ? { traditionalBenefits: [...herb.traditionalBenefits, ...supplement] }
      : {}),
    ...(references ? { references: [...references] } : {}),
  };
});


export function getHerb(id: string): Herb | undefined {
  return HERBS.find((h) => h.id === id);
}

/** Herbs usable in a formula form ('capsule' | 'tea'). Data-driven. */
export function herbsForUse(use: 'capsule' | 'tea'): Herb[] {
  return HERBS.filter((h) => h.uses.includes(use));
}

/** Per-herb add-on price, integer cents. Unknown id → throws (fail closed). */
export function herbPriceCents(id: string): number {
  const herb = getHerb(id);
  if (!herb) throw new Error(`Unknown herb id: ${id}`);
  return herb.priceCents;
}
