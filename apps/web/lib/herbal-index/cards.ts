/**
 * Herbal Index — card view-model (owner directive 2026-10-21).
 *
 * The herbal index is its OWN public store surface, fully separate from
 * the Living Grimoire: nothing here imports entitlements, subscriptions,
 * payments, orders, or any gating module. Every card is derived ONLY from
 * an existing catalog record (lib/catalog/herbs) plus illustration maps
 * that already exist in the repo. No benefit, note, or claim is written,
 * rewritten, padded, or invented by this module:
 *
 * - `properties` = the record's `traditionalBenefits`, VERBATIM, capped
 *   at 5 (the owner's "5 main benefits" present as the card's
 *   "Properties:" folkloric list, framed as traditional use).
 * - `note` = the record's `traditionalNote`, VERBATIM (the card's 2–3
 *   sentences; nothing is fabricated to reach a sentence count).
 * - Records with fewer than 5 recorded benefits are flagged
 *   `benefitsIncomplete` and displayed honestly with what exists.
 *
 * Illustrations: a card carries the artwork reference the repo already
 * maps for its slug (Grimoire map first, then the botanical map). The
 * repo documents (lib/herbs/illustrations.ts, checked 2026-10-08) that
 * every manuscdn.com / cloudfront.net hotlink returns 403, so those
 * references are carried as manifest data — NOT rendered as <img>,
 * because a broken hotlink is not a real image. Cards render an image
 * only for a local / verified-live reference; otherwise they render the
 * defined monogram slot (see ILLUSTRATION_SLOT).
 */
import { HERBS } from '../catalog/herbs';
import type { Herb } from '../../types';
import { HERB_INDEX } from '../content/herbs';
import {
  HERB_ILLUSTRATIONS,
  categoryLabel,
} from '../../components/grimoire/grimoireContent';
import { BOTANICAL_ILLUSTRATIONS } from '../herbs/illustrations';

/** Owner target: the index is built to hold 333 herb cards. */
export const TARGET_CARD_COUNT = 333;

/** The owner's card shows the herb's 5 main benefits as its properties. */
export const CARD_PROPERTY_TARGET = 5;

/* ------------------------------------------------------------------ */
/* Slug aliases: HERB_INDEX (29 canonical library slugs) → HERBS ids.  */
/* The four non-identical pairs are the canonical aliases already      */
/* documented in lib/herbs/illustrations.ts.                           */
/* ------------------------------------------------------------------ */
export const HERB_INDEX_SLUG_ALIASES: Readonly<Record<string, string>> = {
  'valerian-root': 'valerian',
  'willow-bark': 'white-willow',
  chasteberry: 'vitex',
  'red-raspberry-leaf': 'red-raspberry',
};

/* ------------------------------------------------------------------ */
/* Ingredient-kind classification (inventory honesty).                 */
/*                                                                     */
/* The 306 catalog records are NOT all botanical herbs — the audit     */
/* noted mushrooms/resins/oils/vitamins/minerals among them. Kind is   */
/* derived by the explicit, ordered rules in classifyHerbalKind so     */
/* the inventory counts in the workstream report are reproducible      */
/* from code, not hand-tallied. "Honest herb records" for the 333      */
/* target = botanical + mushroom + resin + oil (plant/fungi-derived   */
/* materia medica). Vitamins/minerals, isolated compounds,             */
/* animal-derived entries, and microbial blends are library records    */
/* but are NOT counted toward the 333 herb cards.                      */
/* ------------------------------------------------------------------ */
export type HerbalKind =
  | 'botanical'
  | 'mushroom'
  | 'resin'
  | 'oil'
  | 'vitamin-mineral'
  | 'isolated-compound'
  | 'animal-derived'
  | 'microbial-blend';

const VITAMIN_MINERAL_ID =
  /^(vitamin-|b12-|zinc-|magnesium-|iron-|coq10|alpha-lipoic)/;
const ANIMAL_DERIVED_IDS: ReadonlySet<string> = new Set([
  'propolis',
  'propolis-2',
  'beeswax',
  'manuka',
]);
const RESIN_IDS: ReadonlySet<string> = new Set([
  'frankincense',
  'boswellia',
  'benzoin',
  'copal',
  'dragon-blood',
]);
const ISOLATED_COMPOUND_IDS: ReadonlySet<string> = new Set([
  'berberine',
  'resveratrol',
  'quercetin',
  'apigenin',
  'astaxanthin',
]);

export function classifyHerbalKind(herb: Herb): HerbalKind {
  if (herb.categories.includes('mushroom')) return 'mushroom';
  if (VITAMIN_MINERAL_ID.test(herb.id)) return 'vitamin-mineral';
  if (herb.id === 'probiotics') return 'microbial-blend';
  if (ANIMAL_DERIVED_IDS.has(herb.id)) return 'animal-derived';
  if (RESIN_IDS.has(herb.id) || /resin/i.test(herb.name)) return 'resin';
  if (/\boil\b/i.test(herb.name) || herb.id.endsWith('-oil')) return 'oil';
  if (ISOLATED_COMPOUND_IDS.has(herb.id)) return 'isolated-compound';
  return 'botanical';
}

export const NON_HERB_KINDS: ReadonlySet<HerbalKind> = new Set([
  'vitamin-mineral',
  'isolated-compound',
  'animal-derived',
  'microbial-blend',
]);

export function isHerbKind(kind: HerbalKind): boolean {
  return !NON_HERB_KINDS.has(kind);
}

/* ------------------------------------------------------------------ */
/* Illustration slot contract.                                         */
/*                                                                     */
/* Card media is a fixed 4:3 slot. Future local artwork lands at       */
/* public/images/herbs/<slug>.jpg at 800×600 (the convention the       */
/* existing local fallback already uses: public/images/herbs/). A      */
/* card renders <img> only when its reference is local (starts with    */
/* "/" or is a relative local path) — remote references on the two     */
/* documented-dead CDN hosts are never rendered.                       */
/* ------------------------------------------------------------------ */
export const ILLUSTRATION_SLOT = {
  aspectRatio: '4 / 3',
  width: 800,
  height: 600,
  localPathConvention: 'public/images/herbs/<slug>.jpg',
  fallback: 'monogram',
} as const;

/** Hosts the repo documents as dead for botanical hotlinks (2026-10-08). */
const DEAD_CDN_HOSTS = ['manuscdn.com', 'cloudfront.net'] as const;

export function isRenderableIllustration(url: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('/') || !url.includes('://')) return true;
  return !DEAD_CDN_HOSTS.some((host) => url.includes(host));
}

/* ------------------------------------------------------------------ */
/* Card view-model                                                     */
/* ------------------------------------------------------------------ */
export interface HerbalCard {
  /** Canonical route slug = the catalog record id. */
  slug: string;
  name: string;
  latin: string;
  emoji: string;
  categories: readonly string[];
  categoryLabels: readonly string[];
  kind: HerbalKind;
  /** True when the record counts toward the 333 herb cards. */
  isHerb: boolean;
  /**
   * The card's "Properties:" list — up to 5 entries taken VERBATIM from
   * the record's traditionalBenefits. Never rewritten, never padded.
   */
  properties: readonly string[];
  /** How many benefits the record actually carries today. */
  benefitsListed: number;
  /** True when the record carries fewer than the target 5 benefits. */
  benefitsIncomplete: boolean;
  /** The record's traditionalNote, VERBATIM. */
  note: string;
  /** Mapped artwork reference for this slug, if the repo maps one. */
  illustrationUrl: string | null;
  /** True when illustrationUrl may be rendered as a real <img> today. */
  illustrationRenderable: boolean;
  /** First letter of the herb's name — the monogram-slot content. */
  monogram: string;
  /**
   * Caution slot — Stage 4 integration point. Renders ONLY when a
   * record carries caution data (the optional Herb.caution field,
   * populated from sourced in-repo text only — see
   * lib/catalog/herb-cautions.ts); records without one stay null and
   * the card/detail UI renders nothing for it. No medical content is
   * invented here.
   */
  caution: string | null;
  detailHref: string;
  /** The HERB_INDEX slug that names this record, if any (alias-aware). */
  indexSlug: string | null;
}

function indexSlugFor(herbId: string): string | null {
  for (const entry of HERB_INDEX) {
    if (entry.slug === herbId) return entry.slug;
    if (HERB_INDEX_SLUG_ALIASES[entry.slug] === herbId) return entry.slug;
  }
  return null;
}

export function cardForHerb(herb: Herb): HerbalCard {
  const properties = herb.traditionalBenefits.slice(0, CARD_PROPERTY_TARGET);
  const illustrationUrl =
    HERB_ILLUSTRATIONS[herb.id] ?? BOTANICAL_ILLUSTRATIONS[herb.id] ?? null;
  // Stage 4: the record's optional `caution` field flows through here
  // untouched; absent/empty data stays null and renders nothing.
  const rawCaution: unknown = herb.caution;
  const kind = classifyHerbalKind(herb);
  return {
    slug: herb.id,
    name: herb.name,
    latin: herb.latin,
    emoji: herb.emoji,
    categories: herb.categories,
    categoryLabels: herb.categories.map((c) => categoryLabel(c)),
    kind,
    isHerb: isHerbKind(kind),
    properties,
    benefitsListed: herb.traditionalBenefits.length,
    benefitsIncomplete: herb.traditionalBenefits.length < CARD_PROPERTY_TARGET,
    note: herb.traditionalNote,
    illustrationUrl,
    illustrationRenderable: isRenderableIllustration(illustrationUrl),
    monogram: herb.name.charAt(0).toUpperCase(),
    caution:
      typeof rawCaution === 'string' && rawCaution.trim() !== ''
        ? rawCaution
        : null,
    detailHref: `/herbal-library/${herb.id}`,
    indexSlug: indexSlugFor(herb.id),
  };
}

/** Every catalog record as a card, in catalog order. */
export const HERBAL_CARDS: readonly HerbalCard[] = HERBS.map(cardForHerb);

/** Look up a card by record id OR by a HERB_INDEX alias slug. */
export function getHerbalCard(slug: string): HerbalCard | undefined {
  const direct = HERBAL_CARDS.find((c) => c.slug === slug);
  if (direct) return direct;
  const target = HERB_INDEX_SLUG_ALIASES[slug];
  return target ? HERBAL_CARDS.find((c) => c.slug === target) : undefined;
}

/**
 * Route params for /herbal-library/[herb]: every catalog record PLUS
 * every canonical HERB_INDEX slug (the alias slugs included), so the
 * original 29 routes keep working and every record gains a route.
 * Adding approved records to the catalog extends this with no code
 * change — the set is derived, never hand-listed.
 */
export function herbalRouteParams(): { herb: string }[] {
  const slugs: string[] = HERBS.map((h) => h.id);
  for (const entry of HERB_INDEX) {
    if (!slugs.includes(entry.slug)) slugs.push(entry.slug);
  }
  return slugs.map((herb) => ({ herb }));
}

/* ------------------------------------------------------------------ */
/* Manifest — the counts the report and the index page state honestly. */
/* ------------------------------------------------------------------ */
export interface HerbalIndexManifest {
  targetCards: number;
  totalRecords: number;
  herbRecords: number;
  nonHerbRecords: number;
  byKind: Record<HerbalKind, number>;
  fullBenefits: number;
  partialBenefits: number;
  noBenefits: number;
  withIllustrationEntry: number;
  withGrimoireIllustration: number;
  renderableIllustrations: number;
  needingArtwork: number;
  /** Approved botanical additions needed to reach 333 herb cards. */
  shortfallToTarget: number;
}

export function herbalIndexManifest(
  cards: readonly HerbalCard[] = HERBAL_CARDS,
): HerbalIndexManifest {
  const byKind: Record<HerbalKind, number> = {
    botanical: 0,
    mushroom: 0,
    resin: 0,
    oil: 0,
    'vitamin-mineral': 0,
    'isolated-compound': 0,
    'animal-derived': 0,
    'microbial-blend': 0,
  };
  let fullBenefits = 0;
  let partialBenefits = 0;
  let noBenefits = 0;
  let withIllustrationEntry = 0;
  let withGrimoireIllustration = 0;
  let renderableIllustrations = 0;
  for (const card of cards) {
    byKind[card.kind] += 1;
    if (card.benefitsListed >= CARD_PROPERTY_TARGET) fullBenefits += 1;
    else if (card.benefitsListed > 0) partialBenefits += 1;
    else noBenefits += 1;
    if (card.illustrationUrl) withIllustrationEntry += 1;
    if (HERB_ILLUSTRATIONS[card.slug]) withGrimoireIllustration += 1;
    if (card.illustrationRenderable) renderableIllustrations += 1;
  }
  const herbRecords = cards.filter((c) => c.isHerb).length;
  return {
    targetCards: TARGET_CARD_COUNT,
    totalRecords: cards.length,
    herbRecords,
    nonHerbRecords: cards.length - herbRecords,
    byKind,
    fullBenefits,
    partialBenefits,
    noBenefits,
    withIllustrationEntry,
    withGrimoireIllustration,
    renderableIllustrations,
    needingArtwork: cards.length - renderableIllustrations,
    shortfallToTarget: Math.max(0, TARGET_CARD_COUNT - herbRecords),
  };
}
