/**
 * Pure state helpers for the custom formula builders (G2 capsules,
 * G10 tea) — Amber's Alchemy Apothecary.
 *
 * No JSX, no side effects — everything here is unit-testable.
 * Business truth (herb data, prices, safety rules) stays in lib/; this
 * module only orchestrates UI state around it. Mirrors the architecture
 * of components/builder/state.ts (soap builder).
 */
import { getHerb, herbsForUse } from '../catalog/herbs';
import type { Herb, HerbCategory } from '../../types';
import type { FormulaKind } from '../pricing/pricing';
import { getFormulaSize } from '../pricing/pricing';

/** Legacy parity: the static builder capped formulas at 12 botanicals. */
export const MAX_FORMULA_HERBS = 12;

export type FormulaStepKey = 'size' | 'herbs' | 'safety' | 'reveal';

export const FORMULA_STEPS: readonly FormulaStepKey[] = [
  'size',
  'herbs',
  'safety',
  'reveal',
];

export const FORMULA_STEP_LABELS: Record<FormulaStepKey, string> = {
  size: 'Size',
  herbs: 'Botanicals',
  safety: 'Safety & Intention',
  reveal: 'Reveal',
};

export const FORMULA_STEP_HEADLINES: Record<FormulaKind, Record<FormulaStepKey, string>> = {
  capsule: {
    size: 'Choose Your Size',
    herbs: 'Choose Your Botanicals',
    safety: 'Safety & Intention',
    reveal: 'Your Formula Is Complete ✨',
  },
  tea: {
    size: 'Choose Your Format',
    herbs: 'Choose Your Botanicals',
    safety: 'Safety & Intention',
    reveal: 'Your Blend Is Complete ✨',
  },
};

export const FORMULA_STEP_SUBS: Record<FormulaKind, Record<FormulaStepKey, string>> = {
  capsule: {
    size: 'Two weeks to start, or a full month of your custom blend.',
    herbs: 'Up to 12 botanicals from the apothecary shelves.',
    safety: 'Read every flag — your safety comes first.',
    reveal: 'The moment of truth.',
  },
  tea: {
    size: 'Loose leaf for ritual, tea bags for ease.',
    herbs: 'Up to 12 botanicals from the apothecary shelves.',
    safety: 'Read every flag — your safety comes first.',
    reveal: 'The moment of truth.',
  },
};

export const FORMULA_STEP_HINTS: Record<Exclude<FormulaStepKey, 'reveal'>, string> = {
  size: 'Choose a size to continue.',
  herbs: 'Select at least one botanical to continue.',
  safety: 'Confirm you have read the safety notice to continue.',
};

export interface FormulaSelections {
  sizeId: string | null;
  herbIds: string[];
  creationName: string;
  intention: string;
  notes: string;
  safetyAck: boolean;
}

export function defaultFormulaSelections(): FormulaSelections {
  return {
    sizeId: null,
    herbIds: [],
    creationName: '',
    intention: '',
    notes: '',
    safetyAck: false,
  };
}

/* ---------------- herb selection ---------------- */

/**
 * Toggle a herb in the formula: hard max of MAX_FORMULA_HERBS; no
 * duplicates; unknown ids and herbs not usable in this form are rejected.
 */
export function toggleFormulaHerb(
  ids: string[],
  id: string,
  kind: FormulaKind,
): string[] {
  const herb = getHerb(id);
  if (!herb) return ids;
  if (!herb.uses.includes(kind)) return ids;
  if (ids.includes(id)) return ids.filter((h) => h !== id);
  if (ids.length >= MAX_FORMULA_HERBS) return ids; // 13th tap is ignored
  return [...ids, id];
}

/** Herbs available to a builder kind, in catalog order. */
export function availableHerbs(kind: FormulaKind): Herb[] {
  return herbsForUse(kind);
}

/** Search + category filter over the herb list (pure, testable). */
export function filterFormulaHerbs(
  herbs: Herb[],
  query: string,
  category: HerbCategory | '',
): Herb[] {
  const q = query.trim().toLowerCase();
  return herbs.filter((h) => {
    if (category && !h.categories.includes(category)) return false;
    if (!q) return true;
    const searchable = [
      h.name,
      h.latin,
      h.traditionalNote,
      h.categories.join(' '),
      h.traditionalBenefits.join(' '),
    ]
      .join(' ')
      .toLowerCase();
    return searchable.includes(q);
  });
}

/** Distinct categories present in a herb list, for the filter control. */
export function herbCategories(herbs: Herb[]): HerbCategory[] {
  const seen: HerbCategory[] = [];
  for (const h of herbs) {
    for (const c of h.categories) {
      if (!seen.includes(c)) seen.push(c);
    }
  }
  return seen;
}

/* ---------------- step gating ---------------- */

export function formulaStepComplete(
  step: FormulaStepKey,
  sel: FormulaSelections,
  kind: FormulaKind,
): boolean {
  switch (step) {
    case 'size':
      return sel.sizeId !== null && !!getFormulaSize(kind, sel.sizeId);
    case 'herbs':
      return (
        sel.herbIds.length >= 1 &&
        sel.herbIds.length <= MAX_FORMULA_HERBS &&
        sel.herbIds.every((id) => {
          const h = getHerb(id);
          return !!h && h.uses.includes(kind);
        })
      );
    case 'safety':
      return sel.safetyAck === true;
    case 'reveal':
      return false; // reveal is a destination, never a gate
  }
}

/** Every step before `target` must be complete. */
export function canReachFormulaStep(
  target: FormulaStepKey,
  sel: FormulaSelections,
  kind: FormulaKind,
): boolean {
  const idx = FORMULA_STEPS.indexOf(target);
  if (idx === -1) return false;
  return FORMULA_STEPS.slice(0, idx).every((s) =>
    formulaStepComplete(s, sel, kind),
  );
}

/* ---------------- order record ---------------- */

/**
 * Formula customization for the order record — EXACT herb IDs, never prose.
 * Mirrors the soap builder's §14 rule.
 */
export function formulaCustomizationOf(
  sel: FormulaSelections,
  kind: FormulaKind,
): import('../../types').FormulaCustomization | null {
  if (!formulaStepComplete('size', sel, kind)) return null;
  if (!formulaStepComplete('herbs', sel, kind)) return null;
  return {
    herb_ids: [...sel.herbIds],
    size_id: sel.sizeId as string,
    ...(sel.creationName.trim()
      ? { creation_name: sel.creationName.trim().slice(0, 80) }
      : {}),
    ...(sel.intention.trim()
      ? { intention: sel.intention.trim().slice(0, 120) }
      : {}),
    ...(sel.notes.trim() ? { notes: sel.notes.trim().slice(0, 500) } : {}),
  };
}

/** Human-readable summary so the maker knows exactly what to blend. Display only. */
export function formulaMakerNotes(
  kind: FormulaKind,
  sizeId: string,
  herbIds: string[],
  creationName: string,
  intention: string,
  notes: string,
): string {
  const size = getFormulaSize(kind, sizeId);
  const names = herbIds.map((id) => getHerb(id)?.name ?? id);
  const parts = [
    `Form: ${kind === 'capsule' ? 'Custom Herbal Capsules' : 'Custom Tea Blend'}.`,
    `Size: ${size ? `${size.name} (${size.unit})` : sizeId}.`,
    `Botanicals (${names.length}): ${names.join(', ')}.`,
  ];
  if (creationName.trim()) parts.push(`Name: ${creationName.trim()}.`);
  if (intention.trim()) parts.push(`Intention: ${intention.trim()}.`);
  if (notes.trim()) parts.push(`Maker notes: ${notes.trim()}.`);
  parts.push('Safety: customer acknowledged the herbal safety notice.');
  return parts.join(' ');
}
