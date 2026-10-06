/**
 * Typed safety evaluation for the custom formula builders (G2 capsules,
 * G10 tea) — Amber's Alchemy Apothecary.
 *
 * Pure module: no JSX, no side effects, fully unit-testable.
 *
 * DESIGN (conservative, data-driven):
 * - Every flag originates from TYPED DATA (the tables below) or from
 *   data-derived category rules. Nothing is hard-coded per herb in
 *   procedural code.
 * - Unknown herb PAIRS are flagged NEEDS REVIEW — never silently allowed.
 *   Only pairs present in PAIR_SAFETY (owner-curated) carry a specific
 *   note; every other pair lands in one aggregated "not yet reviewed"
 *   review flag.
 * - Per-herb contraindication notes exist ONLY where a source in this
 *   repo states them (see PER_HERB_SAFETY provenance). The table is
 *   intentionally sparse: inventing pharmacology would be worse than
 *   flagging for review. Status: DRAFT — owner (herbalist) review required
 *   before publication; the UI labels curated vs. review flags honestly.
 *
 * Compliance: safety information is never a cure/treatment claim. Notes
 * use traditional-use framing and always defer to a qualified healthcare
 * professional.
 */
import { getHerb } from '../catalog/herbs';
import type { HerbCategory } from '../../types';

export type SafetySeverity = 'info' | 'review' | 'caution';
export type SafetySource = 'data' | 'rule';
export type SafetyFlagKind = 'universal' | 'herb' | 'category' | 'pair';

export interface SafetyFlag {
  kind: SafetyFlagKind;
  /** Herb IDs this flag concerns (empty for universal flags). */
  herbIds: string[];
  severity: SafetySeverity;
  title: string;
  detail: string;
  /** 'data' = from a curated table below; 'rule' = derived from herb data. */
  source: SafetySource;
}

export interface SafetyEvaluation {
  flags: SafetyFlag[];
  herbCount: number;
  /** Pairs with a curated note in PAIR_SAFETY. */
  knownPairCount: number;
  /** Pairs with no curated note — all flagged NEEDS REVIEW. */
  unknownPairCount: number;
  /** True when every selected herb id resolved in the catalog. */
  allHerbsKnown: boolean;
}

/* ------------------------------------------------------------------ */
/* Universal flags — every custom formula, sourced from the product     */
/* records' own warnings (custom-herbal-capsules / custom-tea-blends).  */
/* ------------------------------------------------------------------ */

const UNIVERSAL_FLAGS: readonly SafetyFlag[] = [
  {
    kind: 'universal',
    herbIds: [],
    severity: 'review',
    title: 'Made-to-order blend — review before you buy',
    detail:
      'Every custom formula is blended to order from your exact selections. ' +
      'Review the full ingredient list for allergies and personal ' +
      'sensitivities before adding to cart.',
    source: 'data',
  },
  {
    kind: 'universal',
    herbIds: [],
    severity: 'review',
    title: 'Talk to your healthcare professional first',
    detail:
      'If you are pregnant, nursing, taking medication, or have a medical ' +
      'condition, consult a qualified healthcare professional before use. ' +
      'Keep out of reach of children.',
    source: 'data',
  },
];

/* ------------------------------------------------------------------ */
/* Per-herb safety notes — ONLY where a repo source states them.        */
/* Provenance is recorded per entry; the table is deliberately sparse.  */
/* ------------------------------------------------------------------ */

interface HerbSafetyNote {
  severity: SafetySeverity;
  title: string;
  detail: string;
  provenance: string;
}

const PER_HERB_SAFETY: Readonly<Record<string, readonly HerbSafetyNote[]>> = {
  'st-johns-wort': [
    {
      severity: 'caution',
      title: "St. John's Wort interacts with many medications",
      detail:
        'Interacts with many medications, including antidepressants, birth ' +
        'control, blood thinners, and immunosuppressants. Do not combine ' +
        'with antidepressants or other serotonergic substances without ' +
        'provider guidance. May increase sensitivity to sunlight.',
      provenance:
        'SOURCED — rec-happy-pill-capsules.ts warnings (catalog-enrichment v3)',
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Category cautions — data-derived rules. Thresholds and copy live in  */
/* DATA (this table), not in procedural branches.                       */
/* ------------------------------------------------------------------ */

interface CategoryCautionRule {
  category: HerbCategory;
  /** Flag when at least this many selected herbs carry the category. */
  threshold: number;
  severity: SafetySeverity;
  title: string;
  detail: string;
}

const CATEGORY_CAUTION_RULES: readonly CategoryCautionRule[] = [
  {
    category: 'sleep',
    threshold: 2,
    severity: 'caution',
    title: 'Multiple calming botanicals',
    detail:
      'Your formula combines several botanicals traditionally used for ' +
      'calm and rest. Combined calming blends can feel strongly sedating — ' +
      'consider starting with a smaller amount and never drive or operate ' +
      'machinery after use.',
  },
  {
    category: 'energy',
    threshold: 3,
    severity: 'caution',
    title: 'Multiple stimulating botanicals',
    detail:
      'Your formula combines several stimulating botanicals. If you are ' +
      'sensitive to stimulating herbs, or take blood pressure or stimulant ' +
      'medications, talk to your healthcare professional first — and avoid ' +
      'late-day use if the blend feels energizing.',
  },
];

/* ------------------------------------------------------------------ */
/* Known pair notes — owner-curated. EMPTY BY DESIGN at launch: no      */
/* pair data exists in any source, and inventing it would be dishonest. */
/* Unknown pairs are flagged NEEDS REVIEW (conservative).               */
/* ------------------------------------------------------------------ */

interface PairNote {
  severity: SafetySeverity;
  title: string;
  detail: string;
  provenance: string;
}

/** Key: two herb ids sorted alphabetically, joined with '~'. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('~');
}

const PAIR_SAFETY: Readonly<Record<string, PairNote>> = {
  // Owner-curated pair notes go here. Until the owner (herbalist) reviews
  // and curates entries, every pair is flagged NEEDS REVIEW by the
  // conservative rule in evaluateFormula.
};

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

function herbName(id: string): string {
  return getHerb(id)?.name ?? id;
}

export function evaluateFormula(herbIds: string[]): SafetyEvaluation {
  const unique = [...new Set(herbIds)];
  const known = unique.filter((id) => getHerb(id) !== undefined);
  const flags: SafetyFlag[] = [...UNIVERSAL_FLAGS];

  // Per-herb curated notes (data only — never invented).
  for (const id of known) {
    const notes = PER_HERB_SAFETY[id];
    if (!notes) continue;
    for (const note of notes) {
      flags.push({
        kind: 'herb',
        herbIds: [id],
        severity: note.severity,
        title: note.title,
        detail: `${note.detail} (Source: ${note.provenance}.)`,
        source: 'data',
      });
    }
  }

  // Category cautions, derived from herb data via the rules table.
  for (const rule of CATEGORY_CAUTION_RULES) {
    const matching = known.filter((id) =>
      getHerb(id)?.categories.includes(rule.category),
    );
    if (matching.length >= rule.threshold) {
      flags.push({
        kind: 'category',
        herbIds: matching,
        severity: rule.severity,
        title: rule.title,
        detail: `${rule.detail} (${matching.map(herbName).join(', ')}.)`,
        source: 'rule',
      });
    }
  }

  // Pair evaluation: known pairs get their curated note; every unknown
  // pair is flagged NEEDS REVIEW — never silently allowed.
  let knownPairCount = 0;
  const unknownPairs: Array<[string, string]> = [];
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      const a = known[i] as string;
      const b = known[j] as string;
      const note = PAIR_SAFETY[pairKey(a, b)];
      if (note) {
        knownPairCount++;
        flags.push({
          kind: 'pair',
          herbIds: [a, b],
          severity: note.severity,
          title: note.title,
          detail: `${note.detail} (Source: ${note.provenance}.)`,
          source: 'data',
        });
      } else {
        unknownPairs.push([a, b]);
      }
    }
  }
  if (unknownPairs.length > 0) {
    const listing = unknownPairs
      .map(([a, b]) => `${herbName(a)} + ${herbName(b)}`)
      .join('; ');
    flags.push({
      kind: 'pair',
      herbIds: [...new Set(unknownPairs.flat())],
      severity: 'review',
      title: `Combinations not yet reviewed (${unknownPairs.length}) — NEEDS REVIEW`,
      detail:
        'These botanical pairings have not been reviewed together by our ' +
        'herbalist: ' +
        listing +
        '. Amber reviews every custom formula before blending — if a ' +
        'pairing raises a concern she will contact you before your order ' +
        'is made.',
      source: 'rule',
    });
  }

  return {
    flags,
    herbCount: known.length,
    knownPairCount,
    unknownPairCount: unknownPairs.length,
    allHerbsKnown: known.length === unique.length,
  };
}

/** Convenience: the highest severity present (for UI emphasis). */
export function maxSeverity(flags: SafetyFlag[]): SafetySeverity {
  const rank: Record<SafetySeverity, number> = { info: 0, review: 1, caution: 2 };
  let max: SafetySeverity = 'info';
  for (const f of flags) {
    if (rank[f.severity] > rank[max]) max = f.severity;
  }
  return max;
}
