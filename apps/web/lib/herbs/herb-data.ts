/**
 * Herb data for the Herb Explorer + botanical index-card modal (workstream E).
 *
 * Sources (no claims invented):
 * - Names, Latin names, and category membership from lib/content/herbs.ts
 *   (HERB_INDEX — quiz engine + journal articles, owner-published content).
 * - Symptom→category keyword map transcribed VERBATIM from the live Netlify
 *   source (awakenagain.com/grimoire.js, SYMPTOM_MAP).
 * - Energetic-properties paragraphs transcribed VERBATIM from the live
 *   Netlify source (awakenagain.com/grimoire.js, ENERGETIC_PROPS).
 * - Illustrations from lib/herbs/illustrations.ts (CDN hotlink map).
 *
 * Evidence-context rule: every association below is a TRADITIONAL/ENERGETIC
 * association carried over from the source of truth. Nothing here asserts a
 * clinical effect. UI copy must frame results as "traditionally associated
 * with", never as treatment claims.
 */

import { HERB_INDEX, type HerbIndexEntry } from '../content/herbs';
import { illustrationFor } from './illustrations';

export type HerbCategoryKey =
  | 'sleep'
  | 'energy'
  | 'immune'
  | 'beauty'
  | 'digestive'
  | 'pain'
  | 'hormonal'
  | 'spiritual'
  | 'mushroom'
  | 'adaptogen';

/** Category labels — verbatim from the live source (grimoire.js getCategoryLabel). */
export const CATEGORY_LABELS: Record<HerbCategoryKey, string> = {
  sleep: 'Sleep & Calm',
  energy: 'Energy & Vitality',
  immune: 'Immune Support',
  beauty: 'Beauty & Skin',
  digestive: 'Digestive Support',
  pain: 'Pain & Inflammation',
  hormonal: 'Hormonal Balance',
  spiritual: 'Spiritual & Ritual',
  mushroom: 'Medicinal Mushroom',
  adaptogen: 'Adaptogen',
};

/** Maps the HERB_INDEX human labels onto the canonical category keys. */
const INDEX_LABEL_TO_KEY: Record<string, HerbCategoryKey> = {
  'Sleep & Calm': 'sleep',
  'Energy & Resilience': 'energy',
  'Immune Support': 'immune',
  'Beauty & Skin': 'beauty',
  'Digestive Support': 'digestive',
  'Pain & Inflammation': 'pain',
  'Hormonal Balance': 'hormonal',
  'Spiritual & Ritual': 'spiritual',
  'Medicinal Mushrooms': 'mushroom',
  Adaptogens: 'adaptogen',
};

/**
 * Symptom keyword → category key mapping, transcribed verbatim from the
 * live Netlify source (awakenagain.com/grimoire.js SYMPTOM_MAP).
 */
export const SYMPTOM_KEYWORDS: Readonly<Record<string, readonly HerbCategoryKey[]>> = {
  sleep: ['sleep'],
  insomnia: ['sleep'],
  rest: ['sleep'],
  dream: ['sleep', 'spiritual'],
  relax: ['sleep', 'adaptogen'],
  calm: ['sleep', 'adaptogen'],
  stress: ['sleep', 'adaptogen'],
  anxiety: ['sleep', 'adaptogen'],
  nervous: ['sleep', 'adaptogen'],
  tension: ['sleep', 'pain'],
  energy: ['energy', 'adaptogen'],
  fatigue: ['energy', 'adaptogen'],
  tired: ['energy', 'adaptogen'],
  focus: ['energy', 'adaptogen'],
  clarity: ['energy', 'adaptogen', 'spiritual'],
  brain: ['energy', 'adaptogen'],
  memory: ['energy', 'adaptogen'],
  concentration: ['energy', 'adaptogen'],
  immunity: ['immune'],
  immune: ['immune'],
  infection: ['immune'],
  cold: ['immune'],
  flu: ['immune'],
  virus: ['immune'],
  bacteria: ['immune'],
  inflammation: ['immune', 'pain'],
  pain: ['pain'],
  ache: ['pain'],
  joint: ['pain'],
  muscle: ['pain'],
  arthritis: ['pain'],
  chronic: ['pain', 'adaptogen'],
  skin: ['beauty'],
  beauty: ['beauty'],
  aging: ['beauty'],
  wrinkle: ['beauty'],
  hair: ['beauty'],
  acne: ['beauty'],
  glow: ['beauty'],
  collagen: ['beauty'],
  digestion: ['digestive'],
  digestive: ['digestive'],
  gut: ['digestive'],
  bloat: ['digestive'],
  nausea: ['digestive'],
  stomach: ['digestive'],
  ibs: ['digestive'],
  hormones: ['hormonal'],
  hormonal: ['hormonal'],
  pms: ['hormonal'],
  menstrual: ['hormonal'],
  menopause: ['hormonal'],
  fertility: ['hormonal'],
  thyroid: ['hormonal'],
  spiritual: ['spiritual'],
  meditation: ['spiritual'],
  ritual: ['spiritual'],
  intuition: ['spiritual'],
  psychic: ['spiritual'],
  grounding: ['spiritual'],
  protection: ['spiritual'],
  mushroom: ['mushroom'],
  adaptogen: ['adaptogen'],
  adaptogenic: ['adaptogen'],
  resilience: ['adaptogen'],
  adrenal: ['adaptogen'],
  cortisol: ['adaptogen'],
};

/**
 * Energetic-properties paragraphs, transcribed verbatim from the live
 * Netlify source (awakenagain.com/grimoire.js ENERGETIC_PROPS). These are
 * traditional/energetic framings from the apothecary's own archive —
 * not clinical claims.
 */
export const ENERGETIC_PROPERTIES: Record<HerbCategoryKey, string> = {
  sleep:
    'Energetically associated with peace, emotional restoration, and the gentle surrender into rest. These herbs carry a yin, receptive quality — they invite the nervous system to soften and the mind to release.',
  energy:
    "Energetically warming and expansive. These herbs carry solar, yang qualities — they kindle inner fire, sharpen the mind, and support the body's capacity to meet the demands of life with grace.",
  immune:
    "Energetically protective and fortifying. These herbs build a strong inner boundary, supporting the body's capacity to discern and defend without becoming rigid or reactive.",
  beauty:
    "Energetically nourishing and restorative. These herbs carry the frequency of self-love and renewal — they support the body's natural radiance from the inside out.",
  digestive:
    "Energetically grounding and integrating. These herbs support the body's ability to receive, process, and release — both physically and emotionally.",
  pain:
    'Energetically cooling and releasing. These herbs help the body move stuck energy, reduce heat and inflammation, and restore flow where there has been blockage.',
  hormonal:
    'Energetically balancing and cyclical. These herbs honor the rhythms of the body — they support the dance between expansion and contraction, activity and rest.',
  spiritual:
    'Energetically expansive and liminal. These herbs thin the veil between the seen and unseen, supporting meditation, dreamwork, and the cultivation of inner wisdom.',
  mushroom:
    'Energetically deep and ancient. Medicinal mushrooms carry the intelligence of the mycelial network — they support adaptability, communication between body systems, and profound immune intelligence.',
  adaptogen:
    'Energetically balancing and resilient. Adaptogens are the great normalizers — they neither stimulate nor sedate, but bring the body into its own natural equilibrium.',
};

const FALLBACK_ENERGETIC =
  'Energetically wise and ancient, this botanical carries the accumulated intelligence of generations of healers who recognized its unique gifts.';

export interface HerbRecord {
  slug: string;
  name: string;
  latin: string;
  illustration: string | undefined;
  categories: readonly HerbCategoryKey[];
  energetic: string;
}

function toRecord(entry: HerbIndexEntry): HerbRecord {
  const categories = entry.categories
    .map((c) => INDEX_LABEL_TO_KEY[c])
    .filter((c): c is HerbCategoryKey => Boolean(c));
  const energetic =
    categories.map((c) => ENERGETIC_PROPERTIES[c]).find(Boolean) ?? FALLBACK_ENERGETIC;
  return {
    slug: entry.slug,
    name: entry.name,
    latin: entry.latin,
    illustration: illustrationFor(entry.slug),
    categories,
    energetic,
  };
}

/** All 29 canonical herbal-library herbs as rich records. */
export const HERBS: readonly HerbRecord[] = HERB_INDEX.map(toRecord);

export function getHerbRecord(slug: string): HerbRecord | undefined {
  return HERBS.find((h) => h.slug === slug);
}

/**
 * Match a free-text symptom/concern to herbs. Keyword matches use the
 * verbatim SYMPTOM_KEYWORDS table; the fallback matches herb names, Latin
 * names, and category labels. Results are in HERB_INDEX canonical order.
 */
export function searchHerbs(rawQuery: string): HerbRecord[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  const categoryHits = new Set<HerbCategoryKey>();
  for (const [keyword, cats] of Object.entries(SYMPTOM_KEYWORDS)) {
    if (q.includes(keyword)) {
      for (const c of cats) categoryHits.add(c);
    }
  }

  const matched = new Set<HerbRecord>();
  if (categoryHits.size > 0) {
    for (const herb of HERBS) {
      if (herb.categories.some((c) => categoryHits.has(c))) matched.add(herb);
    }
  }

  // Fallback: match herb name, Latin name, or category label text.
  for (const herb of HERBS) {
    const labelText = herb.categories.map((c) => CATEGORY_LABELS[c].toLowerCase()).join(' ');
    if (
      herb.name.toLowerCase().includes(q) ||
      herb.latin.toLowerCase().includes(q) ||
      labelText.includes(q)
    ) {
      matched.add(herb);
    }
  }

  return HERBS.filter((h) => matched.has(h));
}

/** Quick-category buttons for the Herb Explorer (label → lookup keyword). */
export const EXPLORER_QUICK_CATEGORIES: ReadonlyArray<{
  emoji: string;
  label: string;
  keyword: string;
}> = [
  { emoji: '😴', label: 'Sleep', keyword: 'sleep' },
  { emoji: '🌊', label: 'Stress', keyword: 'stress' },
  { emoji: '🛡️', label: 'Immunity', keyword: 'immunity' },
  { emoji: '🌿', label: 'Pain', keyword: 'pain' },
  { emoji: '🧠', label: 'Focus', keyword: 'focus' },
  { emoji: '⚡', label: 'Energy', keyword: 'energy' },
  { emoji: '🌸', label: 'Anxiety', keyword: 'anxiety' },
  { emoji: '🌱', label: 'Digestion', keyword: 'digestion' },
  { emoji: '✨', label: 'Skin', keyword: 'skin' },
  { emoji: '🌙', label: 'Hormones', keyword: 'hormones' },
];

export const SYMPTOM_KEYWORD_COUNT = Object.keys(SYMPTOM_KEYWORDS).length;
