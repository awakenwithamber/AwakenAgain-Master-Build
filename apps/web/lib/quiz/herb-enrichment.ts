/**
 * Herb enrichment for the Herbal Allies quiz results email (owner spec
 * 2026-11-07, ported onto remote main 2026-11-07).
 *
 * Turns a stored QuizResultSnapshot's allies — classic matrix allies
 * and restored advisor (Guided Wellness Quiz) allies alike — into
 * email-ready sections:
 * - a link to the herb's Herb Library page (lib/content/herbs
 *   HERB_INDEX is the canonical slug set — an ally with no index entry
 *   renders unlinked rather than pointing at a 404);
 * - the traditional-use line (the ally's own evidence-context note —
 *   existing site copy, structure/function framed);
 * - a "why it matched you" line: for classic results, built from the
 *   concern + form the visitor actually picked; for advisor results,
 *   the synthesis's own whyLine, which the advisor pipeline built from
 *   the visitor's matched signals;
 * - safety notes and interactions — ONLY text that already exists on
 *   this site, transcribed verbatim with its source recorded below.
 *   Resolution order (2026-11-08, Results First — the on-screen cards
 *   and the email now share this one resolver, so they can never
 *   disagree): (1) the owner's 2026-11-07 transcription table below;
 *   (2) the Herb Library's HERB_CAUTIONS overlay
 *   (lib/catalog/herb-cautions.ts — itself near-verbatim lifts from
 *   product records, which is how Fennel, Calendula, and Cayenne gain
 *   their on-file notes); (3) the standard no-notes-on-file line.
 *   NOTHING is invented: a herb with no safety text in either source
 *   renders the fallback line and is a data gap for the owner. (The
 *   two on-file sources differ for Arnica — the transcription table's
 *   "External use only." wins here; unifying them is an owner call.)
 * - a preparation-guidance line — ONLY where the site's existing data
 *   documents one. A 2026-11-08 sweep found NO per-herb preparation
 *   guidance anywhere in the herb library or catalog data, so the
 *   preparation table below is empty, every herb resolves to null,
 *   and renderers omit the line. That is a site-wide data gap, listed
 *   in the diff pack — never filled by invention.
 * - the ally's Body / Mind / Soul dimension (from lib/quiz/advisor.ts),
 *   so the email groups allies under the same headings as the
 *   on-screen results and the PDF.
 * - matching shop products, matched from existing catalog data
 *   (featured_ingredients / complete_ingredients on product records in
 *   lib/catalog/products). No match → no shop block for that herb.
 *
 * COMPLIANCE: no herb is ever described as treating, curing, or
 * preventing anything. Safety content is never paywalled — this module
 * feeds a transactional email anyone can request.
 */
import { HERB_INDEX } from '../content/herbs';
import { PRODUCTS } from '../catalog/products';
import { isSupersededProduct } from '../catalog/status';
import { HERB_CAUTIONS } from '../catalog/herb-cautions';
import { getHerb } from '../catalog/herbs';
import type { Product } from '../../types';
import type { HerbalAlly, QuizResultSnapshot } from './quiz';
import {
  advisorAllyDimension,
  advisorAllyDimensionByName,
  type AdvisorDimension,
  type AdvisorResultSnapshot,
} from './advisor';

/* ------------------------------------------------------------------ */
/* Herb Library links                                                   */
/* ------------------------------------------------------------------ */

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const INDEX_BY_NAME = new Map(
  HERB_INDEX.map((h) => [normalizeName(h.name), h.slug] as const),
);

/** Canonical Herb Library slug for an ally name, or null when the herb
 *  has no library entry (renders unlinked — never a guessed URL). */
export function herbLibrarySlug(allyName: string): string | null {
  return INDEX_BY_NAME.get(normalizeName(allyName)) ?? null;
}

/* ------------------------------------------------------------------ */
/* Safety notes — transcribed verbatim from existing site content       */
/* ------------------------------------------------------------------ */

/**
 * Per-herb safety notes (owner spec 2026-11-07 transcription table).
 * Every entry is a verbatim sentence (or the herb-specific clause)
 * from copy that already exists on this site; `source` names where it
 * was transcribed from. Herbs NOT listed here have no herb-specific
 * safety text on file anywhere in the catalog, quiz, or content
 * modules (verified by sweep 2026-11-07) — they get
 * NO_SAFETY_NOTES_ON_FILE and are data gaps for the owner.
 */
export const HERB_SAFETY_NOTES: Readonly<
  Record<string, { notes: readonly string[]; source: string }>
> = {
  arnica: {
    notes: ['External use only.'],
    source:
      'lib/quiz/quiz.ts ally note ("external use only"); Soothe & Restore Botanical Balm featured-ingredient record (topical use).',
  },
  'willow bark': {
    notes: ['Check with your healthcare provider if you take blood thinners.'],
    source: 'lib/quiz/quiz.ts ally note (verbatim clause).',
  },
  chamomile: {
    notes: [
      'Contains chamomile (Asteraceae family); those with ragweed-family sensitivities should consult a professional first.',
    ],
    source:
      'lib/catalog/products/rec-radiance-support-capsules.ts warnings (verbatim sentence).',
  },
  echinacea: {
    notes: [
      'Avoid if sensitive to the Asteraceae (daisy) family, which includes echinacea.',
      'If you have an autoimmune condition or take immunosuppressant or other medications, consult a qualified healthcare professional before use.',
    ],
    source:
      'lib/catalog/products/rec-immune-at-ease-capsules.ts warnings (verbatim sentences).',
  },
  peppermint: {
    notes: [
      'Avoid if sensitive to peppermint or if advised to avoid stimulating digestive herbs.',
    ],
    source:
      'lib/catalog/products/rec-vital-flow-capsules.ts warnings (verbatim sentence).',
  },
  mugwort: {
    notes: [
      'Contains mugwort and other Asteraceae-family herbs; avoid if sensitive to the daisy/ragweed family.',
    ],
    source:
      'lib/catalog/products/rec-dreamease-capsules.ts warnings (verbatim sentence).',
  },
  comfrey: {
    notes: [
      'External use only — comfrey contains pyrrolizidine alkaloids and is not for internal use.',
    ],
    source:
      'lib/catalog/products/rec-soothe-restore-botanical-balm.ts featured-ingredient properties (verbatim).',
  },
  "st. john's wort": {
    notes: [
      "St. John's Wort interacts with many medications, including antidepressants, birth control, blood thinners, and immunosuppressants.",
      'Do not combine with antidepressants or other serotonergic substances without provider guidance.',
      'May increase sensitivity to sunlight.',
      "St. John's wort is not established as safe for pregnancy in source materials — consult a qualified professional before use during pregnancy or while breastfeeding.",
    ],
    source:
      'lib/catalog/products/rec-happy-pill-capsules.ts warnings (verbatim sentences; the "IMPORTANT:" prefix was dropped) + rec-soothe-restore-botanical-balm.ts warnings (pregnancy clause naming St. John\'s wort).',
  },
};

/** Rendered when a herb has no safety text on file. Never fabricated. */
export const NO_SAFETY_NOTES_ON_FILE =
  'No specific safety notes on file for this herb — please consult a qualified practitioner before use, especially if you are pregnant, nursing, taking medication, or have a medical condition.';

export interface HerbSafety {
  /** Verbatim on-file notes; empty when none exist. */
  notes: readonly string[];
  /** True when herb-specific safety text exists on the site. */
  onFile: boolean;
}

const SAFETY_BY_NAME = new Map(
  Object.entries(HERB_SAFETY_NOTES).map(
    ([name, entry]) => [normalizeName(name), entry] as const,
  ),
);

/**
 * Second tier: the Herb Library's HERB_CAUTIONS overlay. Every value
 * there is a near-verbatim lift from a product record naming the herb
 * (sources in lib/catalog/herb-cautions.ts). Consulted only when the
 * owner's transcription table above has no entry for the herb.
 *
 * Keyed under BOTH name forms the site uses for the same herb: the
 * catalog display name ("Fennel Seed", "Cayenne Pepper" — the advisor
 * pipeline's ally names) and the plainer id-derived form ("Fennel",
 * "Cayenne" — the classic matrix's ally names). If two herbs ever
 * claimed the same key with different texts, the key is dropped —
 * for safety content, no note beats a possibly-wrong note.
 */
const CAUTIONS_BY_NAME = new Map<string, string>();
{
  const claimed = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const [herbId, caution] of Object.entries(HERB_CAUTIONS)) {
    const herb = getHerb(herbId);
    if (!herb) continue;
    const keys = new Set([
      normalizeName(herb.name),
      normalizeName(herbId.replace(/-/g, ' ')),
    ]);
    for (const key of keys) {
      const prior = claimed.get(key);
      if (prior !== undefined && prior !== caution) ambiguous.add(key);
      else claimed.set(key, caution);
    }
  }
  for (const [key, caution] of claimed) {
    if (!ambiguous.has(key)) CAUTIONS_BY_NAME.set(key, caution);
  }
}

export function safetyNotesFor(allyName: string): HerbSafety {
  const entry = SAFETY_BY_NAME.get(normalizeName(allyName));
  if (entry) return { notes: entry.notes, onFile: true };
  const caution = CAUTIONS_BY_NAME.get(normalizeName(allyName));
  if (caution) return { notes: [caution], onFile: true };
  return { notes: [], onFile: false };
}

/* ------------------------------------------------------------------ */
/* Preparation guidance — sourced only; currently a site-wide gap       */
/* ------------------------------------------------------------------ */

/**
 * Per-herb preparation guidance, under the same rule as the safety
 * table: an entry may exist ONLY as verbatim text from existing site
 * content, with its source recorded. A full sweep of the herb library
 * records, the catalog herb records, and the content index on
 * 2026-11-08 found NO per-herb preparation guidance anywhere (herb
 * records carry traditional use, benefits, and cautions — never how
 * to prepare the herb), so this table is intentionally empty and
 * preparationFor returns null for every herb today. Renderers omit
 * the preparation line when null; when the owner authors preparation
 * text for a herb, it is added here and flows to the results cards,
 * the email, and the PDF with no further code changes.
 */
export const HERB_PREPARATION_NOTES: Readonly<
  Record<string, { note: string; source: string }>
> = {};

const PREPARATION_BY_NAME = new Map(
  Object.entries(HERB_PREPARATION_NOTES).map(
    ([name, entry]) => [normalizeName(name), entry] as const,
  ),
);

/** Documented preparation guidance for a herb, or null when the site
 *  documents none (the current state for every herb — see above). */
export function preparationFor(allyName: string): string | null {
  return PREPARATION_BY_NAME.get(normalizeName(allyName))?.note ?? null;
}

/** The safety lines exactly as rendered: on-file notes, or the
 *  standard no-notes-on-file line. Never empty — the block is never
 *  omitted. */
export function safetyLinesFor(allyName: string): string[] {
  const safety = safetyNotesFor(allyName);
  return safety.onFile ? [...safety.notes] : [NO_SAFETY_NOTES_ON_FILE];
}

/* ------------------------------------------------------------------ */
/* Why it matched — built from the visitor's actual answers             */
/* ------------------------------------------------------------------ */

/**
 * Goal phrasing per concern, keyed by the quiz's own concern ids. The
 * sentence names the focus the visitor picked and the form they chose —
 * it never claims the herb treats the concern.
 */
const CONCERN_MATCH: Readonly<
  Record<string, { goal: string; theme: string }>
> = {
  sleep: { goal: 'restful sleep is a priority', theme: 'evening rest and winding down' },
  energy: { goal: 'steady energy and vitality are a priority', theme: 'energy and resilience' },
  immune: { goal: 'seasonal immune support is a priority', theme: 'seasonal wellness routines' },
  pain: { goal: 'everyday comfort after activity is a priority', theme: 'everyday comfort after activity' },
  beauty: { goal: 'skin and beauty care are a priority', theme: 'skin and beauty rituals' },
  hormonal: { goal: 'hormonal balance is a priority', theme: 'cyclical balance' },
  digestive: { goal: 'comfortable digestion is a priority', theme: 'digestive comfort' },
  spiritual: { goal: 'spiritual clarity and ritual are a priority', theme: 'clarity and contemplation' },
};

export function whyMatchedClassic(
  ally: HerbalAlly,
  snapshot: QuizResultSnapshot,
): string {
  const match = CONCERN_MATCH[snapshot.concernId] ?? {
    goal: `${snapshot.concernLabel.toLowerCase()} is a priority`,
    theme: snapshot.concernLabel.toLowerCase(),
  };
  return (
    `You shared that ${match.goal}, and that you prefer ${snapshot.formLabel} — ` +
    `${ally.name} is one of the allies herbalists traditionally pair with ${match.theme}.`
  );
}

/* ------------------------------------------------------------------ */
/* Matching shop products — from existing catalog data only             */
/* ------------------------------------------------------------------ */

export interface HerbProductMatch {
  handle: string;
  title: string;
}

function productBotanicalNames(product: Product): string[] {
  const names: string[] = [];
  const raw = (product as Record<string, unknown>)['featured_ingredients'];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') names.push(item);
      else if (item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string') {
        names.push((item as { name: string }).name);
      }
    }
  }
  const ingredients = (product as Record<string, unknown>)['complete_ingredients'];
  if (typeof ingredients === 'string') {
    // One entry per ingredient — split BEFORE normalizing, because the
    // normalizer strips the commas that separate them.
    for (const segment of ingredients.split(/[,;]/)) {
      const trimmed = segment.trim();
      if (trimmed) names.push(trimmed);
    }
  }
  return names;
}

/**
 * Products whose own records list this herb as a featured ingredient or
 * in their complete ingredients. No match → empty list (the email omits
 * the block for that herb). Superseded products are never recommended.
 */
export function productsForHerb(allyName: string, limit = 3): HerbProductMatch[] {
  const needle = normalizeName(allyName);
  const matches: HerbProductMatch[] = [];
  for (const product of PRODUCTS) {
    if (isSupersededProduct(product)) continue;
    const haystacks = productBotanicalNames(product).map(normalizeName);
    const hit = haystacks.some((h) => h === needle);
    if (hit) matches.push({ handle: product.handle, title: product.title });
    if (matches.length >= limit) break;
  }
  return matches;
}

/* ------------------------------------------------------------------ */
/* Email section assembly                                               */
/* ------------------------------------------------------------------ */

export interface EnrichedAllySection {
  name: string;
  latin: string;
  /** Absolute Herb Library URL, or null when the herb has no entry. */
  libraryUrl: string | null;
  /** Evidence-context traditional-use line (existing site copy). */
  traditionalUse: string;
  /** Why this ally matched the answers the visitor actually gave. */
  whyMatched: string;
  safety: HerbSafety;
  products: HerbProductMatch[];
  /** Body / Mind / Soul dimension (Results First grouping). */
  dimension: AdvisorDimension;
  /** Documented preparation guidance, or null (omitted everywhere). */
  preparation: string | null;
}

type AdvisorAllySnapshot = AdvisorResultSnapshot['allies'][number];

export function enrichClassicAlly(
  ally: HerbalAlly,
  snapshot: QuizResultSnapshot,
  baseUrl: string,
): EnrichedAllySection {
  const slug = herbLibrarySlug(ally.name);
  return {
    name: ally.name,
    latin: ally.latin,
    libraryUrl: slug ? `${baseUrl}/herbal-library/${slug}` : null,
    traditionalUse: ally.note,
    whyMatched: whyMatchedClassic(ally, snapshot),
    safety: safetyNotesFor(ally.name),
    products: productsForHerb(ally.name),
    dimension: advisorAllyDimensionByName(ally.name) ?? 'body',
    preparation: preparationFor(ally.name),
  };
}

export function enrichAdvisorAlly(
  ally: AdvisorAllySnapshot,
  baseUrl: string,
): EnrichedAllySection {
  const slug = herbLibrarySlug(ally.name);
  return {
    name: ally.name,
    latin: ally.latin,
    libraryUrl: slug ? `${baseUrl}/herbal-library/${slug}` : null,
    // The advisor pipeline's own traditional-use note; primaryBenefit
    // is the fallback when the catalog record carries no note.
    traditionalUse: ally.traditionalNote || ally.primaryBenefit,
    // The synthesis's whyLine is built from the visitor's matched
    // signals — it IS the answer-derived why-matched line.
    whyMatched: ally.whyLine,
    safety: safetyNotesFor(ally.name),
    products: productsForHerb(ally.name),
    // The snapshot's own tag wins; snapshots stored before dimensions
    // existed resolve through the pattern data by catalog id.
    dimension:
      ally.dimension ?? advisorAllyDimension(ally.id) ?? 'body',
    preparation: preparationFor(ally.name),
  };
}

export function enrichClassicResult(
  snapshot: QuizResultSnapshot,
  baseUrl: string,
): EnrichedAllySection[] {
  return snapshot.allies.map((ally) => enrichClassicAlly(ally, snapshot, baseUrl));
}

export function enrichAdvisorResult(
  snapshot: AdvisorResultSnapshot,
  baseUrl: string,
): EnrichedAllySection[] {
  return snapshot.allies.map((ally) => enrichAdvisorAlly(ally, baseUrl));
}
