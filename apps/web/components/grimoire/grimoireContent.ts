/**
 * WORKSTREAM D — Living Grimoire content model.
 *
 * Page sequence + real entry content for the handmade-book Grimoire.
 * Entry text (names, Latin names, traditional notes, traditional benefits)
 * comes VERBATIM from lib/catalog/herbs (the ported botanical catalog) —
 * nothing here invents herbal claims. Benefits are explicitly framed as
 * TRADITIONAL USE / early evidence, never collapsed to "proven".
 *
 * Illustrations: hotlinked CDN URLs from
 * docs/launch-readiness/botanical-illustrations-mapping.js (owner assets).
 */
import { getHerb, HERBS } from '../../lib/catalog/herbs';
import type { Herb } from '../../types';

export const GRIMOIRE_TITLE = 'The Living Grimoire - Book of Light';

export const PARACELSUS_QUOTE =
  'The art of healing comes from nature, not from the physician.';

export const EVIDENCE_FOOTNOTE =
  'Framed as traditional use and early findings — not medical advice, and never a substitute for your own care team.';

/** Priority order per the owner directive (12 herbs, volume one). */
export const GRIMOIRE_HERB_ORDER = [
  'lavender',
  'chamomile',
  'ashwagandha',
  'valerian',
  'passionflower',
  'lemon-balm',
  'echinacea',
  'elderberry',
  'turmeric',
  'ginger',
  'peppermint',
  'rose',
] as const;

export type GrimoireHerbSlug = (typeof GRIMOIRE_HERB_ORDER)[number];

/** Botanical illustration CDN URLs (owner assets — hotlinked directly). */
export const HERB_ILLUSTRATIONS: Record<string, string> = {
  'lavender':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-lavender_c61be9fc.jpg',
  'chamomile':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-chamomile_24f1bf7f.jpg',
  'ashwagandha':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-ashwagandha_4c6d0285.jpg',
  'valerian':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-valerian_1bfa4a56.jpg',
  'passionflower':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-passionflower_72074d7d.jpg',
  'lemon-balm':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-lemon-balm_e2d00434.jpg',
  'echinacea':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-echinacea_472030c0.jpg',
  'elderberry':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-elderberry_1da3f271.jpg',
  'turmeric':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-turmeric_a524e6e8.jpg',
  'ginger':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-ginger_0caa06cd.jpg',
  'peppermint':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-peppermint_bead4a95.jpg',
  'rose':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-rose-hip_c140d24a.jpg',
};

/** Human labels for the catalog's lowercase category keys. */
const CATEGORY_LABELS: Record<string, string> = {
  sleep: 'Sleep & Rest',
  energy: 'Energy',
  adaptogen: 'Adaptogen',
  immune: 'Immune Support',
  digestive: 'Digestion',
  pain: 'Comfort & Joints',
  beauty: 'Beauty & Skin',
  spiritual: 'Spirit & Ritual',
  hormonal: 'Hormonal Balance',
  stress: 'Calm & Stress',
  focus: 'Focus',
  cognitive: 'Cognitive',
  mood: 'Mood',
  emotional: 'Emotional Wellbeing',
  mushroom: 'Medicinal Mushroom',
};

export function categoryLabel(key: string): string {
  return (
    CATEGORY_LABELS[key] ??
    key
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

export interface GrimoireHerbPageData {
  kind: 'herb';
  herb: Herb;
  illustration: string;
  allies: string[];
  pageNumber: number;
}

export type GrimoirePage =
  | { kind: 'title'; pageNumber: number }
  | { kind: 'about'; pageNumber: number }
  | { kind: 'index'; pageNumber: number }
  | GrimoireHerbPageData
  | { kind: 'colophon'; pageNumber: number };

/** Allies: fellow volume-one herbs sharing a category (never self). */
function alliesFor(slug: string, categories: readonly string[]): string[] {
  return GRIMOIRE_HERB_ORDER.filter(
    (other) =>
      other !== slug &&
      getHerb(other)?.categories.some((c) => categories.includes(c)),
  ).slice(0, 3);
}

/**
 * Build the full page sequence. Throws on unknown herb slug or missing
 * illustration — fail closed rather than rendering a hollow entry.
 */
export function buildGrimoirePages(): GrimoirePage[] {
  const pages: GrimoirePage[] = [];
  let n = 0;
  const next = () => ++n;

  pages.push({ kind: 'title', pageNumber: next() });
  pages.push({ kind: 'about', pageNumber: next() });
  pages.push({ kind: 'index', pageNumber: next() });

  for (const slug of GRIMOIRE_HERB_ORDER) {
    const herb = getHerb(slug);
    if (!herb) throw new Error(`Grimoire content: unknown herb slug "${slug}"`);
    const illustration = HERB_ILLUSTRATIONS[slug];
    if (!illustration)
      throw new Error(
        `Grimoire content: missing illustration for herb "${slug}"`,
      );
    pages.push({
      kind: 'herb',
      herb,
      illustration,
      allies: alliesFor(slug, herb.categories),
      pageNumber: next(),
    });
  }

  pages.push({ kind: 'colophon', pageNumber: next() });
  return pages;
}

/** 1-based page number of a volume-one herb's entry. */
export function herbPageNumber(slug: string): number {
  const i = GRIMOIRE_HERB_ORDER.indexOf(slug as GrimoireHerbSlug);
  if (i < 0) throw new Error(`Grimoire content: "${slug}" is not in volume one`);
  return 4 + i; // title(1) + about(2) + index(3)
}

export function pageTitle(page: GrimoirePage): string {
  switch (page.kind) {
    case 'title':
      return GRIMOIRE_TITLE;
    case 'about':
      return 'How to read this grimoire';
    case 'index':
      return 'Consult the Index';
    case 'herb':
      return page.herb.name;
    case 'colophon':
      return 'Colophon';
  }
}

export function herbDisplayName(slug: string): string {
  return getHerb(slug)?.name ?? slug;
}

export interface IndexConcern {
  concern: string;
  keywords: string[];
  herbs: GrimoireHerbSlug[];
}

/** In-book index: concern → herb pages. (The full explorer is workstream E.) */
export const GRIMOIRE_INDEX: IndexConcern[] = [
  {
    concern: 'Sleep & Rest',
    keywords: ['sleep', 'insomnia', 'rest', 'bedtime', 'restless', 'tired'],
    herbs: ['valerian', 'passionflower', 'chamomile', 'lavender', 'lemon-balm'],
  },
  {
    concern: 'Calm & Anxiety',
    keywords: ['anxiety', 'anxious', 'calm', 'nerves', 'nervous', 'worry'],
    herbs: ['lavender', 'passionflower', 'chamomile', 'lemon-balm', 'ashwagandha'],
  },
  {
    concern: 'Stress & Resilience',
    keywords: ['stress', 'cortisol', 'burnout', 'overwhelm', 'adaptogen'],
    herbs: ['ashwagandha', 'lemon-balm', 'chamomile'],
  },
  {
    concern: 'Immune Defense',
    keywords: ['immune', 'immunity', 'cold', 'flu', 'virus', 'illness', 'sick'],
    herbs: ['echinacea', 'elderberry'],
  },
  {
    concern: 'Digestion',
    keywords: ['digestion', 'digestive', 'stomach', 'nausea', 'bloat', 'gut'],
    herbs: ['peppermint', 'ginger', 'chamomile'],
  },
  {
    concern: 'Pain & Inflammation',
    keywords: ['pain', 'inflammation', 'joint', 'arthritis', 'headache', 'ache'],
    herbs: ['turmeric', 'ginger', 'peppermint'],
  },
  {
    concern: 'Skin & Beauty',
    keywords: ['skin', 'beauty', 'rosacea', 'glow', 'redness', 'complexion'],
    herbs: ['rose', 'turmeric', 'chamomile'],
  },
  {
    concern: 'Heart & Spirit',
    keywords: ['grief', 'heart', 'ritual', 'spirit', 'mood', 'emotional'],
    herbs: ['rose', 'lavender', 'lemon-balm'],
  },
  {
    concern: 'Energy & Focus',
    keywords: ['energy', 'focus', 'fatigue', 'alertness', 'tired', 'vitality'],
    herbs: ['ginger', 'peppermint', 'ashwagandha'],
  },
];

/** All herb slugs referenced by every herb-data consumer (for tests). */
export function allGrimoireHerbSlugs(): readonly string[] {
  return HERBS.map((h) => h.id);
}
