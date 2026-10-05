/**
 * Blendable oils, soap bases, colors, and botanicals.
 * Source: owner-confirmed inventory 2026-10-05 + SOAP_BUILDER_DESIGN.md §14.
 * Compatibility rules live in DATA (not UI conditionals): see
 * ColorOption.requiresTranslucentBase and the validation in lib/cart.
 */
import type { BotanicalOption, ColorOption, Oil, SoapBase } from '../../types';

export const MAX_BLEND_OILS = 3;

export const BLENDABLE_OILS: readonly Oil[] = [
  { id: 'lavender', name: 'Lavender', profileTags: ['Floral', 'Herbal', 'Calming'] },
  { id: 'lemon', name: 'Lemon', profileTags: ['Citrus', 'Bright', 'Fresh'] },
  { id: 'peppermint', name: 'Peppermint', profileTags: ['Minty', 'Cool', 'Fresh'] },
  { id: 'tea-tree', name: 'Tea Tree', profileTags: ['Herbal', 'Green', 'Clarifying'] },
  { id: 'frankincense', name: 'Frankincense', profileTags: ['Resinous', 'Warm', 'Musky'] },
  { id: 'geranium', name: 'Geranium', profileTags: ['Floral', 'Green', 'Rosy'] },
  { id: 'rose', name: 'Rose', profileTags: ['Floral', 'Romantic', 'Lush'] },
  { id: 'patchouli', name: 'Patchouli', profileTags: ['Earthy', 'Warm', 'Grounding'] },
  { id: 'cedarwood', name: 'Cedarwood', profileTags: ['Woody', 'Warm', 'Dry'] },
  { id: 'jasmine', name: 'Jasmine', profileTags: ['Floral', 'Exotic', 'Sweet'] },
  { id: 'vanilla-mimic', name: 'Vanilla (mimic)', profileTags: ['Warm', 'Sweet', 'Soft'] },
  { id: 'coconut', name: 'Coconut', profileTags: ['Creamy', 'Tropical', 'Soft'] },
];

export function getOil(id: string): Oil | undefined {
  return BLENDABLE_OILS.find((o) => o.id === id);
}

/** Deduplicated profile tags for a set of oil IDs (max 4 shown in UI). */
export function blendProfileTags(oilIds: string[]): string[] {
  const tags: string[] = [];
  for (const id of oilIds) {
    const oil = getOil(id);
    if (!oil) continue;
    for (const tag of oil.profileTags) {
      if (!tags.includes(tag)) tags.push(tag);
    }
  }
  return tags.slice(0, 4);
}

export const SOAP_BASES: readonly SoapBase[] = [
  {
    id: 'double-layer',
    name: 'Signature Double Layer',
    description:
      'Clear vegetable glycerin + castor oil top over a distinct goat milk + shea butter bottom. Layers never blended.',
    translucent: false,
  },
  {
    id: 'goat-milk-shea',
    name: 'Goat Milk + Shea Butter',
    description: 'Creamy single-layer soap.',
    translucent: false,
  },
  {
    id: 'glycerin-castor',
    name: 'Botanical Glycerin + Castor Oil',
    description: 'Translucent single-layer soap.',
    translucent: true,
  },
];

export function getBase(id: string): SoapBase | undefined {
  return SOAP_BASES.find((b) => b.id === id);
}

export const SOAP_COLORS: readonly ColorOption[] = [
  { id: 'red', name: 'Red', hex: '#b3202c' },
  { id: 'rose-pink', name: 'Rose / Pink', hex: '#e79fb3' },
  { id: 'peach', name: 'Peach', hex: '#f5b98a' },
  { id: 'orange', name: 'Orange', hex: '#e07b2a' },
  { id: 'amber-gold', name: 'Amber / Gold', hex: '#c9932b' },
  { id: 'yellow', name: 'Yellow', hex: '#e8c93c' },
  { id: 'sage', name: 'Sage', hex: '#9caf88' },
  { id: 'emerald', name: 'Emerald', hex: '#2e7d5b' },
  { id: 'teal', name: 'Teal', hex: '#2a8a8a' },
  { id: 'blue', name: 'Blue', hex: '#3a6ea5' },
  { id: 'lavender', name: 'Lavender', hex: '#a78bda' },
  { id: 'purple', name: 'Purple', hex: '#6d4aa0' },
  { id: 'charcoal', name: 'Black / Charcoal', hex: '#2b2b2e' },
  {
    id: 'natural-clear',
    name: 'Natural / Clear',
    hex: '#f5f2ea',
    requiresTranslucentBase: true,
  },
  { id: 'creamy-white', name: 'Creamy White', hex: '#f7f3e8' },
];

export function getColor(id: string): ColorOption | undefined {
  return SOAP_COLORS.find((c) => c.id === id);
}

export const BOTANICALS: readonly BotanicalOption[] = [
  { id: 'rose-petals', name: 'Rose Petals', role: 'Romantic visual; classic floral garnish.' },
  { id: 'lavender', name: 'Lavender', role: 'Calming aroma; purple buds in the clear layer.' },
  { id: 'calendula', name: 'Calendula', role: 'Golden petals; sunny, skin-friendly garnish.' },
  { id: 'chamomile', name: 'Chamomile', role: 'Delicate daisy heads; gentle, soothing look.' },
  { id: 'hibiscus', name: 'Hibiscus', role: 'Ruby-red petals; bold color accent.' },
  { id: 'rosemary', name: 'Rosemary', role: 'Green needles; fresh herbal character.' },
  { id: 'mint', name: 'Mint', role: 'Bright green leaf; crisp, clean cue.' },
  { id: 'oatmeal', name: 'Oatmeal', role: 'Creamy texture; comforting, classic exfoliant look.' },
  { id: 'cornflower', name: 'Cornflower', role: 'Blue petals; striking color contrast.' },
];

export function getBotanical(id: string): BotanicalOption | undefined {
  return BOTANICALS.find((b) => b.id === id);
}
