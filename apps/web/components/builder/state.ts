/**
 * Pure state helpers for the soap-builder ritual.
 *
 * No JSX, no side effects — everything here is unit-testable.
 * Business truth (prices, catalog IDs, validation) stays in lib/; this
 * module only orchestrates UI state around it.
 */
import {
  blendProfileTags,
  getBase,
  getBotanical,
  getColor,
  getOil,
  MAX_BLEND_OILS,
} from '../../lib/catalog/oils';
import { getScentRecipe } from '../../lib/catalog/scents';
import { getShape } from '../../lib/catalog/shapes';
import { BUNDLE_SLOT_SHAPES } from '../../lib/pricing/pricing';
import type {
  BundleSlot,
  Customization,
  ScentRecipe,
  ScentSelection,
  SoapBaseId,
} from '../../types';

export type ScentPath = 'signature' | 'blend';
export type BuilderMode = 'single' | 'bundle';
export type RitualStepKey = 'base' | 'shape' | 'scent' | 'botanical' | 'color' | 'reveal';

/** Single-soap ritual: the full six steps. */
export const SINGLE_MODE_STEPS: readonly RitualStepKey[] = [
  'base',
  'shape',
  'scent',
  'botanical',
  'color',
  'reveal',
];

/**
 * Collection mode: the shape step is skipped — every slot has a FIXED shape
 * (one of each of the 5 styles), so asking for a shape would be dishonest.
 * (Corrected deviation from the static draft, where the shape choice was
 * silently ignored in bundle mode.)
 */
export const BUNDLE_MODE_STEPS: readonly RitualStepKey[] = [
  'base',
  'scent',
  'botanical',
  'color',
  'reveal',
];

export const STEP_LABELS: Record<RitualStepKey, string> = {
  base: 'Base',
  shape: 'Shape',
  scent: 'Scent',
  botanical: 'Botanical',
  color: 'Color',
  reveal: 'Reveal',
};

export const STEP_HEADLINES: Record<RitualStepKey, string> = {
  base: 'Choose Your Base',
  shape: 'Choose Your Shape',
  scent: 'Choose Your Scent',
  botanical: 'Add Your Botanical',
  color: 'Choose Your Color',
  reveal: 'Your Alchemy Is Complete ✨',
};

export const STEP_SUBS: Record<RitualStepKey, string> = {
  base: 'Every alchemy begins with a base.',
  shape: 'Choose the vessel for your creation.',
  scent: 'Breathe in… what calls to you?',
  botanical: 'One botanical, chosen with intention.',
  color: 'Paint your potion.',
  reveal: 'The moment of truth.',
};

export const STEP_HINTS: Record<Exclude<RitualStepKey, 'reveal'>, string> = {
  base: 'Choose a base to continue your ritual.',
  shape: 'Choose a shape to continue.',
  scent: 'Choose a scent — or blend up to 3 oils.',
  botanical: 'Choose one botanical.',
  color: 'Choose a color.',
};

export const BASE_HINTS: Record<SoapBaseId, string> = {
  'double-layer': 'The classic — two visibly separate layers, never blended.',
  'goat-milk-shea': 'Best for sensitive-skin rituals.',
  'glycerin-castor': 'Best for showcasing color and herbs.',
};

export interface BuilderSelections {
  base: SoapBaseId | null;
  shape: string | null;
  scentPath: ScentPath;
  signatureId: string | null;
  blendOils: string[];
  botanical: string | null;
  /** ColorOption id, or an owner-approved custom color encoded as `custom#RRGGBB`. */
  color: string | null;
}

export function defaultSelections(): BuilderSelections {
  return {
    base: null,
    shape: null,
    scentPath: 'signature',
    signatureId: null,
    blendOils: [],
    botanical: null,
    color: null,
  };
}

/* ---------------- custom colors ---------------- */

export const CUSTOM_COLOR_PREFIX = 'custom#';

export function isCustomColorId(id: string): boolean {
  return /^custom#[0-9a-fA-F]{6}$/.test(id);
}

export function encodeCustomColor(hex: string): string {
  const clean = hex.replace('#', '').toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(clean)) {
    throw new Error(`Invalid custom color hex: ${hex}`);
  }
  return `${CUSTOM_COLOR_PREFIX}${clean}`;
}

/** Preview hex for a color selection (named swatch or custom). */
export function colorHex(id: string): string | null {
  if (isCustomColorId(id)) return `#${id.slice(CUSTOM_COLOR_PREFIX.length)}`;
  return getColor(id)?.hex ?? null;
}

/** Human label for a color selection. */
export function colorLabel(id: string): string {
  if (isCustomColorId(id)) {
    return `Custom color #${id.slice(CUSTOM_COLOR_PREFIX.length).toUpperCase()}`;
  }
  return getColor(id)?.name ?? 'Unknown color';
}

/**
 * Natural/Clear enforcement, from DATA:
 * ColorOption.requiresTranslucentBase × SoapBase.translucent.
 * Custom food-dye colors are valid on any base.
 */
export function colorAllowedForBase(
  baseId: SoapBaseId | null,
  colorId: string,
): boolean {
  if (isCustomColorId(colorId)) return true;
  const color = getColor(colorId);
  if (!color) return false;
  if (!color.requiresTranslucentBase) return true;
  if (!baseId) return false;
  return getBase(baseId)?.translucent === true;
}

/* ---------------- scent ---------------- */

/** Toggle an oil in a blend: hard max of MAX_BLEND_OILS; no duplicates; unknown ids rejected. */
export function toggleBlendOil(oils: string[], id: string): string[] {
  if (!getOil(id)) return oils;
  if (oils.includes(id)) return oils.filter((o) => o !== id);
  if (oils.length >= MAX_BLEND_OILS) return oils; // 4th tap is ignored
  return [...oils, id];
}

/** Dynamic "Your Alchemy Blend" readout: oil names + deduplicated profile tags (max 4). */
export function blendReadout(oils: string[]): { names: string[]; tags: string[] } {
  const names = oils.map((id) => getOil(id)?.name ?? id);
  return { names, tags: blendProfileTags(oils) };
}

/**
 * Scent selection for the order record — EXACT oil IDs or a recipe ID.
 * Blends are persisted as data, never as a prose description.
 */
export function scentSelectionOf(
  sel: Pick<BuilderSelections, 'scentPath' | 'signatureId' | 'blendOils'>,
): ScentSelection | null {
  if (sel.scentPath === 'signature') {
    if (!sel.signatureId || !getScentRecipe(sel.signatureId)) return null;
    return { type: 'signature', recipe_id: sel.signatureId };
  }
  if (sel.blendOils.length < 1 || sel.blendOils.length > MAX_BLEND_OILS) return null;
  if (sel.blendOils.some((id) => !getOil(id))) return null;
  return { type: 'custom_blend', oils: [...sel.blendOils] };
}

/** Human label for a scent selection (summary + maker notes). */
export function scentLabel(scent: ScentSelection): string {
  if (scent.type === 'signature') {
    const r = getScentRecipe(scent.recipe_id);
    return r ? `${r.name} (${r.oils.join(', ')})` : scent.recipe_id;
  }
  const names = scent.oils.map((id) => getOil(id)?.name ?? id);
  return `Your Alchemy Blend: ${names.join(' + ')}`;
}

/**
 * Suggested botanical pairing for a signature recipe.
 * Maps the recipe's human pairing note onto catalog botanical ids.
 */
export function suggestedBotanicalForRecipe(recipeId: string): string | null {
  const recipe: ScentRecipe | undefined = getScentRecipe(recipeId);
  if (!recipe) return null;
  const note = recipe.botanical.toLowerCase();
  const candidates: Array<[string, string]> = [
    ['rose', 'rose-petals'],
    ['lavender', 'lavender'],
    ['calendula', 'calendula'],
    ['rosemary', 'rosemary'],
    ['mint', 'mint'],
    ['oatmeal', 'oatmeal'],
    ['cornflower', 'cornflower'],
    ['hibiscus', 'hibiscus'],
    ['chamomile', 'chamomile'],
  ];
  for (const [word, id] of candidates) {
    if (note.includes(word) && getBotanical(id)) return id;
  }
  return null;
}

/* ---------------- step gating ---------------- */

export function stepComplete(step: RitualStepKey, sel: BuilderSelections): boolean {
  switch (step) {
    case 'base':
      return sel.base !== null && !!getBase(sel.base);
    case 'shape':
      return sel.shape !== null && !!getShape(sel.shape);
    case 'scent':
      return scentSelectionOf(sel) !== null;
    case 'botanical':
      return sel.botanical !== null && !!getBotanical(sel.botanical);
    case 'color':
      return (
        sel.color !== null &&
        sel.base !== null &&
        colorAllowedForBase(sel.base, sel.color)
      );
    case 'reveal':
      return false; // reveal is a destination, never a gate
  }
}

/** Every step before `target` in this mode's order must be complete. */
export function canReachStep(
  target: RitualStepKey,
  sel: BuilderSelections,
  mode: BuilderMode,
): boolean {
  const order = mode === 'bundle' ? BUNDLE_MODE_STEPS : SINGLE_MODE_STEPS;
  const idx = order.indexOf(target);
  if (idx === -1) return false;
  return order.slice(0, idx).every((s) => stepComplete(s, sel));
}

/* ---------------- bundle slots ---------------- */

export interface SlotTheme {
  base: SoapBaseId;
  scent: ScentSelection;
  botanical: string;
  color: string;
}

export interface SlotState extends SlotTheme {
  slot_index: number;
}

/** Theme from a completed ritual (bundle mode skips shape — slots fix their own). */
export function themeFromSelections(sel: BuilderSelections): SlotTheme | null {
  const scent = scentSelectionOf(sel);
  if (!sel.base || !scent || !sel.botanical || !sel.color) return null;
  return { base: sel.base, scent, botanical: sel.botanical, color: sel.color };
}

/** Deep copy — each slot owns its state; one slot can never overwrite another. */
export function slotsFromTheme(theme: SlotTheme): SlotState[] {
  return BUNDLE_SLOT_SHAPES.map((_, i) => ({
    slot_index: i,
    base: theme.base,
    scent:
      theme.scent.type === 'signature'
        ? { type: 'signature', recipe_id: theme.scent.recipe_id }
        : { type: 'custom_blend', oils: [...theme.scent.oils] },
    botanical: theme.botanical,
    color: theme.color,
  }));
}

/** Immutable per-slot update — every other slot is returned untouched. */
export function updateSlot(
  slots: SlotState[],
  index: number,
  patch: Partial<SlotTheme>,
): SlotState[] {
  return slots.map((s, i) => (i === index ? { ...s, ...patch } : s));
}

/** "Apply this theme to all 5" — fresh independent copies, never shared references. */
export function applyThemeToAll(slots: SlotState[], theme: SlotTheme): SlotState[] {
  void slots;
  return slotsFromTheme(theme);
}

/** Slot state → canonical BundleSlot (shape is fixed per slot index). */
export function slotToBundleSlot(slot: SlotState): BundleSlot {
  const shape = BUNDLE_SLOT_SHAPES[slot.slot_index];
  if (!shape) throw new Error(`Slot index out of range: ${slot.slot_index}`);
  return {
    slot_index: slot.slot_index,
    base: slot.base,
    shape,
    scent: slot.scent,
    botanical: slot.botanical,
    color: slot.color,
  };
}

/** Human-readable summary so the maker knows exactly what to pour. Display only. */
export function makerNotes(c: Customization): string {
  const shape = getShape(c.shape);
  const base = getBase(c.base);
  const botanical = c.botanical ? getBotanical(c.botanical) : undefined;
  return [
    `Base: ${base?.name ?? c.base}.`,
    `Shape: ${shape ? `${shape.name}, ${shape.weightOz} oz` : c.shape}.`,
    `Scent: ${scentLabel(c.scent)}.`,
    `Botanical: ${botanical?.name ?? 'none'}.`,
    `Color: ${colorLabel(c.color)} (food-derived dye).`,
  ].join(' ');
}
