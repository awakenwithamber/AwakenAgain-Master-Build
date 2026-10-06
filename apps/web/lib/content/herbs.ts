/**
 * Canonical herb index (G7).
 *
 * The full 300+ herb archive data is not yet verified for migration, so
 * per-herb detail pages render honest "in preparation" states. This module
 * defines the canonical slug set + categories so links stay stable as
 * entries get written — no slugs are invented from unverified data.
 *
 * Sources: legacy herb categories (sleep, energy, immune, beauty,
 * digestive, pain, hormonal, spiritual, mushroom, adaptogen) + herbs named
 * in the quiz engine and journal articles (owner-published content).
 */
export interface HerbIndexEntry {
  slug: string;
  name: string;
  latin: string;
  categories: string[];
}

export const HERB_CATEGORIES = [
  'Sleep & Calm',
  'Energy & Resilience',
  'Immune Support',
  'Beauty & Skin',
  'Digestive Support',
  'Pain & Inflammation',
  'Hormonal Balance',
  'Spiritual & Ritual',
  'Medicinal Mushrooms',
  'Adaptogens',
] as const;

export const HERB_INDEX: readonly HerbIndexEntry[] = [
  { slug: 'mugwort', name: 'Mugwort', latin: 'Artemisia vulgaris', categories: ['Sleep & Calm', 'Spiritual & Ritual'] },
  { slug: 'valerian-root', name: 'Valerian Root', latin: 'Valeriana officinalis', categories: ['Sleep & Calm'] },
  { slug: 'passionflower', name: 'Passionflower', latin: 'Passiflora incarnata', categories: ['Sleep & Calm'] },
  { slug: 'chamomile', name: 'Chamomile', latin: 'Matricaria chamomilla', categories: ['Sleep & Calm', 'Digestive Support'] },
  { slug: 'lemon-balm', name: 'Lemon Balm', latin: 'Melissa officinalis', categories: ['Sleep & Calm'] },
  { slug: 'ashwagandha', name: 'Ashwagandha', latin: 'Withania somnifera', categories: ['Energy & Resilience', 'Adaptogens'] },
  { slug: 'rhodiola', name: 'Rhodiola', latin: 'Rhodiola rosea', categories: ['Energy & Resilience', 'Adaptogens'] },
  { slug: 'holy-basil', name: 'Holy Basil', latin: 'Ocimum tenuiflorum', categories: ['Energy & Resilience', 'Adaptogens'] },
  { slug: 'eleuthero', name: 'Eleuthero', latin: 'Eleutherococcus senticosus', categories: ['Energy & Resilience', 'Adaptogens'] },
  { slug: 'elderberry', name: 'Elderberry', latin: 'Sambucus nigra', categories: ['Immune Support'] },
  { slug: 'astragalus', name: 'Astragalus', latin: 'Astragalus membranaceus', categories: ['Immune Support'] },
  { slug: 'echinacea', name: 'Echinacea', latin: 'Echinacea purpurea', categories: ['Immune Support'] },
  { slug: 'reishi', name: 'Reishi', latin: 'Ganoderma lucidum', categories: ['Immune Support', 'Medicinal Mushrooms', 'Adaptogens'] },
  { slug: 'turmeric', name: 'Turmeric', latin: 'Curcuma longa', categories: ['Pain & Inflammation'] },
  { slug: 'arnica', name: 'Arnica', latin: 'Arnica montana', categories: ['Pain & Inflammation'] },
  { slug: 'willow-bark', name: 'Willow Bark', latin: 'Salix alba', categories: ['Pain & Inflammation'] },
  { slug: 'cayenne', name: 'Cayenne', latin: 'Capsicum annuum', categories: ['Pain & Inflammation'] },
  { slug: 'rose', name: 'Rose', latin: 'Rosa damascena', categories: ['Beauty & Skin', 'Spiritual & Ritual'] },
  { slug: 'calendula', name: 'Calendula', latin: 'Calendula officinalis', categories: ['Beauty & Skin'] },
  { slug: 'hibiscus', name: 'Hibiscus', latin: 'Hibiscus sabdariffa', categories: ['Beauty & Skin'] },
  { slug: 'peppermint', name: 'Peppermint', latin: 'Mentha × piperita', categories: ['Digestive Support'] },
  { slug: 'ginger', name: 'Ginger', latin: 'Zingiber officinale', categories: ['Digestive Support'] },
  { slug: 'fennel', name: 'Fennel', latin: 'Foeniculum vulgare', categories: ['Digestive Support'] },
  { slug: 'chasteberry', name: 'Chasteberry', latin: 'Vitex agnus-castus', categories: ['Hormonal Balance'] },
  { slug: 'red-raspberry-leaf', name: 'Red Raspberry Leaf', latin: 'Rubus idaeus', categories: ['Hormonal Balance'] },
  { slug: 'shatavari', name: 'Shatavari', latin: 'Asparagus racemosus', categories: ['Hormonal Balance'] },
  { slug: 'frankincense', name: 'Frankincense', latin: 'Boswellia sacra', categories: ['Spiritual & Ritual'] },
  { slug: 'blue-lotus', name: 'Blue Lotus', latin: 'Nymphaea caerulea', categories: ['Spiritual & Ritual'] },
  { slug: 'comfrey', name: 'Comfrey', latin: 'Symphytum officinale', categories: ['Pain & Inflammation'] },
];

export function getHerb(slug: string): HerbIndexEntry | undefined {
  return HERB_INDEX.find((h) => h.slug === slug);
}
