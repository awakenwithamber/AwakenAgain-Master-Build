/**
 * The 13 Signature Scent recipes — PROPOSED (pending owner approval 2026-10-05).
 * Source: SCENT_RECIPES_REVISED.md (owner-inventory-true, evidence-ranked).
 * Recipe IDs are stable and used in order payloads — never rename an ID.
 */
import type { ScentRecipe } from '../../types';

function recipe(
  id: string,
  name: string,
  oils: string[],
  profile: string,
  sensory: string,
  palette: string[],
  botanical: string,
  mood: string,
  bestBase: string,
  safety: string,
  evidence: ScentRecipe['evidence'],
  evidenceNote: string,
): ScentRecipe {
  return { id, name, oils, profile, sensory, palette, botanical, mood, bestBase, safety, evidence, evidenceNote };
}

export const SIGNATURE_SCENTS: readonly ScentRecipe[] = [
  recipe(
    'SCENT_RECIPE_01', 'Moonlit Lavender',
    ['Lavender (lead)', 'vanilla-mimic (warmth)'],
    'Floral-herbaceous calm with soft sweet warmth', 'A lavender field at dusk',
    ['Lavender', 'Purple'], 'Lavender buds', 'Unwind, bedtime ritual',
    'Signature Double Layer or Goat Milk + Shea Butter', 'No major flags.',
    'STRONG', 'The #1 handmade-soap scent family everywhere; lavender-vanilla the most-cited bestselling blend.',
  ),
  recipe(
    'SCENT_RECIPE_02', 'Forest Whisper',
    ['doTERRA Breathe (eucalyptus, peppermint, tea tree, lemon, laurel)'],
    'Camphoraceous green, cool and clearing', 'Deep woods after rain',
    ['Emerald', 'Sage'], 'Mint leaf', 'Morning clarity, cold-season comfort',
    'Botanical Glycerin + Castor Oil', '1,8-cineole — not for young children\u2019s soaps.',
    'STRONG', 'Spa segment keeps growing; winter and men\u2019s-gift peak.',
  ),
  recipe(
    'SCENT_RECIPE_03', 'Citrus Sunshine',
    ['Lemon (lead)', 'Peppermint (lift)'],
    'Bright citrus with a cool spark', 'Peeling a lemon in morning sun',
    ['Yellow', 'Orange'], 'Calendula', 'Energy, joy',
    'Botanical Glycerin + Castor Oil', 'Expressed lemon — label "rinse well".',
    'STRONG', 'Citrus = cleanliness in buyers\u2019 minds; spring/summer and market bestseller.',
  ),
  recipe(
    'SCENT_RECIPE_04', 'Alpine Frost',
    ['doTERRA Deep Blue (wintergreen, camphor, peppermint)'],
    'Cooling mint-wintergreen rush', 'Cold mountain air',
    ['Teal', 'Blue'], 'Mint leaf', 'Invigoration, post-workout',
    'Botanical Glycerin + Castor Oil', 'Cooling oils — moderate dose; not for young children.',
    'MODERATE', 'Bracing-mint slot; fresh/clean is a proven family with men\u2019s crossover.',
  ),
  recipe(
    'SCENT_RECIPE_05', 'Sweet Serenity',
    ['Jasmine (measured)', 'vanilla-mimic (warmth)'],
    'Exotic soft floral with creamy warmth', 'Warm blossoms at golden hour',
    ['Rose / Pink', 'Amber / Gold'], 'Rose petals or hibiscus', 'Romantic unwind, self-pampering',
    'Goat Milk + Shea Butter', 'Jasmine is potent — measured dose.',
    'MODERATE', 'Vanilla-floral blends are universal sellers; jasmine distinguishes it from lavender-vanilla.',
  ),
  recipe(
    'SCENT_RECIPE_06', 'Rose Goddess',
    ['Rose', 'Geranium'],
    'Lush rose with a green lift', 'An apothecary rose garden',
    ['Rose / Pink', 'Red'], 'Rose petals', 'Self-love ritual, divine feminine',
    'Signature Double Layer', 'No major flags — watch rose-oil cost per bar; dose for economics.',
    'MODERATE', 'Rose-geranium has nostalgic gift appeal; rose is the visual signature of the line.',
  ),
  recipe(
    'SCENT_RECIPE_07', 'Sacred Stillness',
    ['Frankincense', 'Lavender'],
    'Resinous warmth wrapped in floral calm', 'Temple quiet, deep exhale',
    ['Amber / Gold', 'Lavender'], 'Lavender buds', 'Grounding, meditation',
    'Signature Double Layer', 'No major flags.',
    'MODERATE', 'Resinous niche with holiday/gifting spikes; classic sacred-calm pairing.',
  ),
  recipe(
    'SCENT_RECIPE_08', 'Spice of the Earth',
    ['doTERRA On Guard (wild orange, clove, cinnamon, eucalyptus, rosemary)'],
    'Warm citrus-spice, hearth and autumn kitchen', 'Orange peel studded with cloves',
    ['Amber / Gold', 'Orange'], 'Calendula', 'Cozy season rituals',
    'Signature Double Layer', 'Clove/cinnamon sensitizers — blend keeps them proportioned; sensitive-skin patch-test note; seasonal positioning.',
    'MODERATE', 'Real seasonal family. Backbone of the October Pumpkin Spice soap.',
  ),
  recipe(
    'SCENT_RECIPE_09', 'Herbal Harmony',
    ['Tea Tree', 'Lavender'],
    'Green clarifying softened by floral calm', 'A kitchen garden after rain',
    ['Sage', 'Emerald'], 'Rosemary (garnish)', 'Clarify, reset',
    'Botanical Glycerin + Castor Oil', 'No major flags at soap dose.',
    'MODERATE', 'Steady herbal-niche demand; the friendly face of tea tree.',
  ),
  recipe(
    'SCENT_RECIPE_10', 'Mystic Musk',
    ['Frankincense (musky-balsamic facet)', 'Patchouli (measured earthy depth)'],
    'Warm skin-musk, resinous and grounding', 'Incense smoke settling into warm earth',
    ['Amber / Gold'], 'Oatmeal', 'Earthy mystery, evening ritual',
    'Signature Double Layer', 'Patchouli polarizing — blend-only, never lead.',
    'MODERATE', 'Owner-confirmed: frankincense carries genuine musky facets. Patchouli loyalists are repeat buyers.',
  ),
  recipe(
    'SCENT_RECIPE_11', 'Cedar Hollow',
    ['Cedarwood', 'Frankincense'],
    'Dry warm wood wrapped in sacred resin', 'A cabin in the pines at dusk',
    ['Amber / Gold'], 'Oatmeal or rosemary', 'Rugged calm; the gift-for-him slot',
    'Signature Double Layer', 'No major flags.',
    'MODERATE', 'Makers report the men\u2019s/woodsy segment as underserved with real demand.',
  ),
  recipe(
    'SCENT_RECIPE_12', 'Enchanted Garden',
    ['Jasmine (lead)', 'Geranium (green lift)'],
    'White floral with leafy brightness', 'A walled garden in full bloom',
    ['Creamy White', 'Rose / Pink'], 'Cornflower', 'Luxurious, bridal, gift-giving',
    'Goat Milk + Shea Butter', 'Jasmine potent — measured dose.',
    'ANECDOTAL', 'Branding-led prestige tier, not a volume driver. Keep for the luxury/gift niche.',
  ),
  recipe(
    'SCENT_RECIPE_13', 'Island Bloom',
    ['Coconut', 'Lemon'],
    'Creamy tropical lifted by bright citrus', 'Coconut milk with a squeeze of lemon over ice',
    ['Creamy White', 'Yellow'], 'Calendula', 'Vacation, summer ease',
    'Botanical Glycerin + Castor Oil or Goat Milk + Shea Butter', 'Expressed lemon — "rinse well".',
    'MODERATE', 'Coconut/tropical is a proven summer seller; uses the confirmed coconut stock.',
  ),
];

export function getScentRecipe(id: string): ScentRecipe | undefined {
  return SIGNATURE_SCENTS.find((r) => r.id === id);
}
