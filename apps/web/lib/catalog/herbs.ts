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

export const HERBS: readonly Herb[] = [
  ...HERBS_PART_1,
  ...HERBS_PART_2,
  ...HERBS_PART_3,
  ...HERBS_PART_4,
];


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
