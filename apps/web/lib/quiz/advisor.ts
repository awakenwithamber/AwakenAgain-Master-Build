/**
 * Herbal Allies Quiz — the restored "Guided Wellness Quiz / Synthesis".
 *
 * RESTORED 2026-10-22 (owner directive): Amber asked for the ORIGINAL
 * quiz back. This module is a faithful port of the legacy static site's
 * guided advisor (ambers-alchemy-apothecary: herbal-advisor.js +
 * remedy-flow.js): a six-phase conversation — Foundation (multi-select
 * goals) → Shape (intensity / frequency / duration) → Whole Human
 * (sleep, stress, digestion, emotional state + triggers) → Nuance (time
 * of day, sensitivity, preferred form) → lead capture → the Synthesis
 * (patterns → root support → personal allies → one remedy). The current
 * Stage 4 safety screening is kept as its own phase before results and
 * still gates product suggestions (see lib/quiz/quiz.ts).
 *
 * Adaptations from the legacy source, all deliberate:
 * - The legacy "Tincture" form is the "Botanical Oil Infusion" here —
 *   the compliance law of lib/quiz/quiz.ts ("Tincture never appears")
 *   governs this app.
 * - Ally details (name, latin, traditional use) resolve through the
 *   CURRENT herb catalog (lib/catalog/herbs, 309 records) instead of
 *   the legacy BOTANICALS table; four legacy ids are aliased to their
 *   catalog ids below. Every ally the patterns can surface resolves.
 *   Two ids in the legacy per-goal recommendation pool (magnolia,
 *   kava) have no current catalog record — the pool is kept verbatim
 *   as legacy data and is not rendered directly.
 * - Legacy product ids are mapped to current catalog handles.
 * - The legacy download was an HTML file; this app generates a real
 *   PDF (lib/quiz/results-pdf.ts).
 *
 * COMPLIANCE LAW (shared with lib/quiz/quiz.ts): no diagnose / treat /
 * cure / prevent claims; traditional-use framing throughout. The
 * "why these allies" narrative added 2026-10-22 is Amber's own
 * spiritual framing, written as her perspective ("in Amber's work…"),
 * never as medical causation.
 *
 * RESULTS FIRST (owner decision 2026-11-08, supersedes the 2026-11-07
 * email-first spec): the Synthesis renders the moment the quiz
 * completes — no email wall anywhere in the flow. This revision adds:
 * - four NEW patterns (flagged NEW below) for the goals that used to
 *   fall back to a generic pattern — beauty, hormonal balance, focus &
 *   clarity, general wellness — written additively in the legacy
 *   voice, under the same compliance law;
 * - Body / Mind / Soul dimensions on every pattern and ally, so the
 *   results, the results email, and the PDF can organize allies under
 *   those headings;
 * - ally gathering with a floor of 5 and a cap of 8: a second pattern
 *   expands the list only when the visitor actually chose one of the
 *   goals it answers (never filler);
 * - the engine now honors each pattern's own `minMatches` gate (the
 *   legacy data always carried it; the 2026-10-22 port did not apply
 *   it), which is what routes a lone cognitive goal to the cognitive
 *   pattern instead of Stress Depletion.
 * The five legacy patterns' copy is untouched — verbatim, as restored.
 */
import { getHerb } from '../catalog/herbs';
import { getProductByHandle } from '../catalog/products';
import {
  isIngestibleProduct,
  safetyTextMentionsMedication,
} from '../safety/product-safety';
import type { QuizScreening, QuizWithheldProduct } from './quiz';

/* ------------------------------------------------------------------ */
/* Phase 1 — Foundation: what is asking for support (multi-select)     */
/* ------------------------------------------------------------------ */

export interface AdvisorGoal {
  id: string;
  label: string;
  icon: string;
  desc: string;
}

/** Ported verbatim from ADVISOR_DATA.goals (legacy herbal-advisor.js). */
export const ADVISOR_GOALS: readonly AdvisorGoal[] = [
  { id: 'sleep', label: 'Sleep', icon: '🌙', desc: 'Rest that feels restorative, not borrowed.' },
  { id: 'energy', label: 'Energy', icon: '⚡', desc: 'Steady vitality without the crash.' },
  { id: 'stress', label: 'Stress & Calm', icon: '🌿', desc: 'A softer nervous system. Space to breathe.' },
  { id: 'immune', label: 'Immune Support', icon: '🛡️', desc: 'Resilience through every season.' },
  { id: 'hormones', label: 'Hormonal Balance', icon: '🌸', desc: 'Support for cycles, mood, and shifts.' },
  { id: 'digestion', label: 'Digestion', icon: '🫁', desc: 'A gut that feels at ease again.' },
  { id: 'pain', label: 'Tension & Pain', icon: '🔥', desc: 'Relief for what the body is holding.' },
  { id: 'beauty', label: 'Skin & Radiance', icon: '✨', desc: 'Inner and outer glow, nourished deeply.' },
  { id: 'cognitive', label: 'Focus & Clarity', icon: '🧠', desc: 'A mind that can settle and engage.' },
  { id: 'wellness', label: 'General Wellness', icon: '🌱', desc: 'Daily balance and quiet resilience.' },
];

export const ADVISOR_MAX_SYMPTOMS = 5;

/* ------------------------------------------------------------------ */
/* Phase 2 — Shape                                                     */
/* ------------------------------------------------------------------ */

export interface AdvisorOption {
  id: string;
  label: string;
  desc?: string;
}

export const ADVISOR_INTENSITY: readonly AdvisorOption[] = [
  { id: 'gentle', label: 'A whisper', desc: 'Noticeable but mild — more of a nudge than a shout.' },
  { id: 'moderate', label: 'Clearly present', desc: "Consistent enough that you're paying attention." },
  { id: 'significant', label: 'Loud and persistent', desc: "It's shaping how your days feel." },
];

export const ADVISOR_FREQUENCY: readonly AdvisorOption[] = [
  { id: 'occasional', label: 'Now and then', desc: 'Comes and goes with no clear rhythm.' },
  { id: 'frequent', label: 'Most weeks', desc: 'Showing up more often than not.' },
  { id: 'daily', label: 'Every day', desc: 'Part of the daily landscape right now.' },
];

export const ADVISOR_DURATION: readonly AdvisorOption[] = [
  { id: 'recent', label: 'A few days', desc: 'Fairly new.' },
  { id: 'weeks', label: 'A few weeks', desc: 'Lingering a while now.' },
  { id: 'months', label: 'A few months', desc: 'Settled in.' },
  { id: 'long-term', label: 'Longer than that', desc: 'A long-standing companion.' },
];

/* ------------------------------------------------------------------ */
/* Phase 3 — Whole Human                                               */
/* ------------------------------------------------------------------ */

export const ADVISOR_SLEEP: readonly AdvisorOption[] = [
  { id: 'restful', label: 'Restful most nights' },
  { id: 'light', label: 'Light — I wake easily' },
  { id: 'broken', label: "Broken — I'm up in the night" },
  { id: 'exhausted', label: 'I wake already tired' },
];

export const ADVISOR_STRESS: readonly AdvisorOption[] = [
  { id: 'calm', label: 'Mostly calm' },
  { id: 'manageable', label: 'Busy but managing' },
  { id: 'stretched', label: 'Stretched thin' },
  { id: 'depleted', label: 'Running on fumes' },
];

export const ADVISOR_DIGESTION: readonly AdvisorOption[] = [
  { id: 'smooth', label: 'Smooth and regular' },
  { id: 'sensitive', label: "Sensitive — certain foods don't sit well" },
  { id: 'bloated', label: 'Bloated after meals' },
  { id: 'sluggish', label: 'Slow or sluggish' },
];

export const ADVISOR_EMOTIONAL: readonly AdvisorOption[] = [
  { id: 'steady', label: 'Steady, mostly myself' },
  { id: 'tender', label: 'Tender — feeling things deeply' },
  { id: 'overwhelmed', label: 'Overwhelmed or anxious' },
  { id: 'flat', label: 'Flat — motivation is low' },
];

export interface AdvisorTrigger {
  id: string;
  label: string;
  icon: string;
}

/** Ported verbatim from ADVISOR_DATA.triggers. */
export const ADVISOR_TRIGGERS: readonly AdvisorTrigger[] = [
  { id: 'work-pressure', label: 'Work or caregiving pressure', icon: '⚖️' },
  { id: 'screens-late', label: 'Late-night screens', icon: '📱' },
  { id: 'poor-sleep', label: 'Not sleeping enough', icon: '🌙' },
  { id: 'big-transition', label: 'A recent life transition', icon: '🍃' },
  { id: 'overstim', label: 'Overstimulation or noise', icon: '🌊' },
  { id: 'diet-shifts', label: 'Irregular meals or caffeine', icon: '☕' },
  { id: 'low-movement', label: 'Less movement than usual', icon: '🧘' },
  { id: 'relationship', label: 'Relationship strain', icon: '💔' },
  { id: 'seasonal', label: 'Seasonal or weather shifts', icon: '🍂' },
  { id: 'none', label: 'Nothing specific I can name', icon: '✨' },
];

/* ------------------------------------------------------------------ */
/* Phase 4 — Nuance                                                    */
/* ------------------------------------------------------------------ */

export const ADVISOR_TIME_OF_DAY: readonly (AdvisorOption & { icon: string })[] = [
  { id: 'morning', label: 'Morning', icon: '☀️', desc: 'Most present early in the day.' },
  { id: 'evening', label: 'Evening', icon: '🌙', desc: 'Shows up as the day winds down.' },
  { id: 'all-day', label: 'All day', icon: '🔄', desc: 'A steady background companion.' },
  { id: 'situational', label: 'Situational', icon: '💡', desc: 'Tied to certain moments or triggers.' },
];

export const ADVISOR_SENSITIVITY: readonly AdvisorOption[] = [
  { id: 'gentle', label: 'Gentle', desc: 'I tend to be sensitive — softer is better.' },
  { id: 'balanced', label: 'Balanced', desc: 'Comfortable with a typical blend.' },
  { id: 'robust', label: 'Robust', desc: 'I do well with strong, direct support.' },
];

/**
 * Preferred forms. The legacy list carried a liquid-extract option;
 * per this app's compliance law it is the Botanical Oil Infusion.
 */
export const ADVISOR_FORMATS: readonly (AdvisorOption & { icon: string })[] = [
  { id: 'tea', label: 'Tea', icon: '🍵', desc: 'Ritual, warmth, gentle absorption.' },
  { id: 'capsule', label: 'Capsules', icon: '💊', desc: 'Simple, consistent, travel-friendly.' },
  { id: 'oil-infusion', label: 'Botanical Oil Infusion', icon: '💧', desc: 'Concentrated botanical infusion, easy to take.' },
  { id: 'balm', label: 'Balm', icon: '🫙', desc: 'Topical, targeted, tangible.' },
  { id: 'serum', label: 'Serum', icon: '✨', desc: 'Skin-focused, concentrated botanicals.' },
  { id: 'no-preference', label: 'Let us choose', icon: '🌿', desc: 'Recommend what best fits the pattern.' },
];

/* ------------------------------------------------------------------ */
/* Recommendation data (legacy ADVISOR_DATA, handles mapped)           */
/* ------------------------------------------------------------------ */

/** Legacy herb recommendations per goal — ported verbatim. */
export const ADVISOR_HERB_RECOMMENDATIONS: Readonly<Record<string, readonly string[]>> = {
  sleep: ['valerian', 'passionflower', 'lemon-balm', 'chamomile', 'ashwagandha', 'lavender', 'mugwort', 'hops', 'skullcap', 'magnolia'],
  energy: ['ashwagandha', 'rhodiola', 'eleuthero', 'maca', 'ginseng', 'moringa', 'cordyceps', 'lion-mane', 'schisandra', 'licorice'],
  stress: ['ashwagandha', 'holy-basil', 'lemon-balm', 'passionflower', 'lavender', 'rhodiola', 'kava', 'skullcap', 'mimosa', 'albizzia'],
  immune: ['elderberry', 'echinacea', 'astragalus', 'reishi', 'turkey-tail', 'andrographis', 'oregano', 'garlic', 'cat-claw', 'propolis'],
  hormones: ['vitex', 'black-cohosh', 'dong-quai', 'maca', 'red-clover', 'shatavari', 'ashwagandha', 'evening-primrose', 'licorice', 'wild-yam'],
  digestion: ['ginger', 'fennel', 'peppermint', 'chamomile', 'licorice', 'marshmallow', 'slippery-elm', 'dandelion', 'artichoke', 'gentian'],
  pain: ['arnica', 'turmeric', 'ginger', 'boswellia', 'white-willow', 'devil-claw', 'cayenne', 'wintergreen', 'comfrey', 'meadowsweet'],
  beauty: ['rose-hip', 'sea-buckthorn', 'frankincense', 'neroli', 'helichrysum', 'horsetail', 'amla', 'nettle', 'burdock', 'calendula'],
  cognitive: ['lion-mane', 'bacopa', 'ginkgo', 'rhodiola', 'ashwagandha', 'rosemary', 'gotu-kola', 'holy-basil', 'schisandra', 'eleuthero'],
  wellness: ['ashwagandha', 'reishi', 'astragalus', 'moringa', 'nettle', 'turmeric', 'ginger', 'elderberry', 'holy-basil', 'schisandra'],
};

/**
 * Legacy product recommendations with ids mapped to CURRENT catalog
 * handles (dreamease-capsules and the tea blend carry over; the legacy
 * "vital-vitality" / "immune-at-ease" are today's …-capsules SKUs;
 * "pain-balm" is today's Soothe & Restore balm; "beauty-balm" is
 * Radiance Renewal; "hair-serum" is Root & Scalp Revival).
 */
export const ADVISOR_PRODUCT_RECOMMENDATIONS: Readonly<Record<string, readonly string[]>> = {
  sleep: ['dreamease-capsules', 'alchemy-tea-blend'],
  energy: ['vital-vitality-capsules'],
  stress: ['dreamease-capsules', 'vital-vitality-capsules'],
  immune: ['immune-at-ease-capsules'],
  hormones: ['vital-vitality-capsules', 'sacred-balance-capsules'],
  digestion: ['vital-vitality-capsules'],
  pain: ['soothe-restore-botanical-balm'],
  beauty: ['radiance-renewal-balm', 'root-scalp-revival-serum', 'radiance-support-capsules'],
  cognitive: ['focus-clarity-ritual', 'vital-vitality-capsules'],
  wellness: ['immune-at-ease-capsules', 'vital-vitality-capsules'],
};

/* ------------------------------------------------------------------ */
/* Body / Mind / Soul dimensions (NEW 2026-11-08, Results First)       */
/*                                                                     */
/* Every pattern carries a primary dimension; an ally may carry its    */
/* own when its gift clearly belongs to another dimension than its     */
/* pattern's. The on-screen results, the results email, and the PDF    */
/* group allies under these three headings, in this fixed order. The   */
/* section sub-lines are NEW copy, written to sit alongside the        */
/* Body/Mind/Soul framing the site already uses in the custom-formula  */
/* form guide (lib/custom-formula/forms-guide.ts).                     */
/* ------------------------------------------------------------------ */

export type AdvisorDimension = 'body' | 'mind' | 'soul';

export interface AdvisorDimensionSection {
  id: AdvisorDimension;
  heading: string;
  sub: string;
}

export const ADVISOR_DIMENSION_SECTIONS: readonly AdvisorDimensionSection[] = [
  {
    id: 'body',
    heading: 'Body',
    sub: 'Allies that tend the physical — skin, digestion, tension, and rest you can feel.',
  },
  {
    id: 'mind',
    heading: 'Mind',
    sub: 'Allies for clarity, focus, and a nervous system that can settle.',
  },
  {
    id: 'soul',
    heading: 'Soul',
    sub: 'Allies that nourish the inner life — mood, resilience, and the ritual of care itself.',
  },
];

export function advisorDimensionSection(
  id: AdvisorDimension,
): AdvisorDimensionSection {
  return ADVISOR_DIMENSION_SECTIONS.find((s) => s.id === id) ??
    ADVISOR_DIMENSION_SECTIONS[0];
}

/** Group dimension-tagged items under Body / Mind / Soul, in order,
 *  omitting empty sections. Item order is preserved within a group. */
export function groupByDimension<T extends { dimension: AdvisorDimension }>(
  items: readonly T[],
): { section: AdvisorDimensionSection; items: T[] }[] {
  const groups: { section: AdvisorDimensionSection; items: T[] }[] = [];
  for (const section of ADVISOR_DIMENSION_SECTIONS) {
    const inSection = items.filter((i) => i.dimension === section.id);
    if (inSection.length > 0) groups.push({ section, items: inSection });
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/* Patterns (legacy remedy-flow.js PATTERNS — copy verbatim; the four  */
/* patterns marked NEW 2026-11-08 are additive, written in the same    */
/* voice under the same compliance law)                                */
/* ------------------------------------------------------------------ */

export interface AdvisorPatternAlly {
  id: string;
  benefit: string;
  whySource: string[];
  /** Body/Mind/Soul override; absent → the pattern's dimension. */
  dimension?: AdvisorDimension;
}

export interface AdvisorPattern {
  id: string;
  name: string;
  summary: string;
  rootSupport: string;
  preferredForm: string;
  /** Primary Body/Mind/Soul dimension of this pattern. */
  dimension: AdvisorDimension;
  allies: AdvisorPatternAlly[];
  triggers: { symptoms: string[]; minMatches: number; boosters: string[] };
}

export const ADVISOR_PATTERNS: Readonly<Record<string, AdvisorPattern>> = {
  'nervous-overwhelm': {
    id: 'nervous-overwhelm',
    name: 'Nervous System Overwhelm',
    summary: 'Your system is running hot. The signals we hear — difficulty settling, a busy mind, tension that lingers — point to a nervous system asking for deeper softening and sustained support.',
    rootSupport: 'Nervines to soften the edges, gentle adaptogens to restore tone, and evening rituals that invite the body back into parasympathetic rest.',
    preferredForm: 'loose-tea',
    dimension: 'mind',
    allies: [
      { id: 'passionflower', benefit: 'Softens a looping, worried mind', whySource: ['stress', 'sleep', 'racing-mind'] },
      { id: 'lemon-balm', benefit: 'Lifts mood while calming the nerves', whySource: ['stress', 'mood', 'emotional'] },
      { id: 'lavender', benefit: 'Invites the body into rest and ease', whySource: ['sleep', 'tension'], dimension: 'soul' },
      { id: 'ashwagandha', benefit: 'Gently rebuilds stress reserves over time', whySource: ['stress', 'burnout', 'duration-long'], dimension: 'body' },
      { id: 'skullcap', benefit: 'Eases nervous tension held in the body', whySource: ['tension', 'anxiety'], dimension: 'body' },
    ],
    triggers: { symptoms: ['sleep', 'stress'], minMatches: 1, boosters: ['racing-mind', 'light-sleep', 'tension'] },
  },
  'stress-depletion': {
    id: 'stress-depletion',
    name: 'Stress Depletion',
    summary: 'The pattern here is not simply tiredness — it is depletion from carrying too much for too long. Your reserves are asking to be refilled rather than pushed.',
    rootSupport: 'Restorative adaptogens to rebuild stamina, mineral-rich botanicals to replenish, and rhythms that honor recovery as much as output.',
    preferredForm: 'capsule',
    dimension: 'body',
    allies: [
      { id: 'ashwagandha', benefit: 'Rebuilds stamina after prolonged stress', whySource: ['stress', 'burnout', 'energy', 'duration-long'] },
      { id: 'rhodiola', benefit: 'Supports mental endurance and mood', whySource: ['energy', 'cognitive', 'mental-fog'], dimension: 'mind' },
      { id: 'eleuthero', benefit: 'Steadies the body through demanding seasons', whySource: ['energy', 'duration-long'] },
      { id: 'holy-basil', benefit: 'Nourishes resilience under pressure', whySource: ['stress', 'mood'], dimension: 'soul' },
      { id: 'nettle', benefit: 'Replenishes depleted minerals gently', whySource: ['energy', 'burnout'] },
    ],
    triggers: { symptoms: ['energy', 'stress', 'cognitive'], minMatches: 2, boosters: ['burnout', 'afternoon-crash', 'duration-long'] },
  },
  'digestive-sluggishness': {
    id: 'digestive-sluggishness',
    name: 'Digestive Sluggishness',
    summary: 'Your digestive rhythm sounds tired — heavy after meals, slow to move, sensitive to stress. The body is asking for warming, bittering support to reawaken its natural flow.',
    rootSupport: 'Digestive bitters and carminatives to restart motility, warming herbs to support the digestive fire, and mealtime rituals that honor the pace of digestion.',
    preferredForm: 'loose-tea',
    dimension: 'body',
    allies: [
      { id: 'ginger', benefit: 'Wakes up a sluggish digestive fire', whySource: ['digestion', 'bloating', 'after-eating'] },
      { id: 'fennel', benefit: 'Eases bloating and bringing flow back', whySource: ['digestion', 'bloating'] },
      { id: 'peppermint', benefit: 'Soothes tension in the gut', whySource: ['digestion', 'stress'] },
      { id: 'chamomile', benefit: 'Calms the gut-mind connection', whySource: ['digestion', 'stress', 'emotional'], dimension: 'mind' },
      { id: 'dandelion', benefit: "Supports the liver's rhythm of renewal", whySource: ['digestion', 'stagnation'] },
    ],
    triggers: { symptoms: ['digestion'], minMatches: 1, boosters: ['bloating', 'after-eating', 'slow-digestion'] },
  },
  'immune-strain': {
    id: 'immune-strain',
    name: 'Immune Strain',
    summary: 'The body is stretching its defenses — seasonal shifts, recovery, or cumulative stress is asking more of your immune system than it can comfortably give right now.',
    rootSupport: 'Deep immune tonics to rebuild reserves, daily resilience herbs to hold the line, and restorative practices that let recovery happen.',
    preferredForm: 'capsule',
    dimension: 'body',
    allies: [
      { id: 'elderberry', benefit: 'Classic ally for seasonal resilience', whySource: ['immune', 'seasonal'] },
      { id: 'astragalus', benefit: 'Builds deep, long-term immune reserves', whySource: ['immune', 'duration-long'] },
      { id: 'reishi', benefit: 'Supports immune intelligence and restoration', whySource: ['immune', 'stress'], dimension: 'soul' },
      { id: 'echinacea', benefit: 'Activates first-line defenses when needed', whySource: ['immune', 'acute'] },
      { id: 'holy-basil', benefit: 'Nourishes resilience across body and mind', whySource: ['immune', 'stress'], dimension: 'soul' },
    ],
    triggers: { symptoms: ['immune'], minMatches: 1, boosters: ['seasonal', 'post-illness', 'low-reserves'] },
  },
  'stagnation': {
    id: 'stagnation',
    name: 'Stagnation',
    summary: 'Signals of tightness, held tension, and slowed flow suggest stagnation — energy, circulation, or lymph asking to move. The body wants to return to motion.',
    rootSupport: 'Circulatory and moving herbs, warming topicals for tension, and practices that invite gentle movement back into the system.',
    preferredForm: 'balm',
    dimension: 'body',
    allies: [
      { id: 'turmeric', benefit: 'Supports the body through inflammation cycles', whySource: ['pain', 'chronic'] },
      { id: 'ginger', benefit: 'Moves warmth into stagnant places', whySource: ['pain', 'stagnation', 'digestion'] },
      { id: 'arnica', benefit: 'Traditional ally for held tension and soreness', whySource: ['pain', 'muscle'] },
      { id: 'rosemary', benefit: 'Awakens circulation and clears the head', whySource: ['pain', 'cognitive', 'beauty'], dimension: 'mind' },
      { id: 'cayenne', benefit: 'Draws warmth to cold, stiff places', whySource: ['pain', 'cold'] },
    ],
    triggers: { symptoms: ['pain'], minMatches: 1, boosters: ['chronic', 'tension', 'cold'] },
  },
  /* NEW 2026-11-08 — the four patterns below are ADDITIVE (Results
   * First): the legacy engine had no pattern for the beauty, hormones,
   * cognitive, or wellness goals, so those runs fell back to a generic
   * pattern. Copy is written in the legacy patterns' voice and
   * structure, allies are drawn from the goals' own legacy herb pools
   * (ADVISOR_HERB_RECOMMENDATIONS), and the compliance law holds:
   * traditional-use framing only, nothing presented as treating,
   * curing, or preventing anything. */
  'quiet-radiance': {
    id: 'quiet-radiance',
    name: 'Quiet Radiance',
    summary: 'Your skin is asking to be nourished from the inside out. In the herbal tradition, radiance is rarely painted on — it grows from minerals, steady nourishment, and gentle daily care, tended by plants that have looked after skin for centuries.',
    rootSupport: 'Mineral-rich tonics to feed skin, hair, and nails, traditional skin allies for a calm and cared-for complexion, and small beauty rituals that make care a pleasure rather than a chore.',
    preferredForm: 'serum',
    dimension: 'soul',
    allies: [
      { id: 'calendula', benefit: 'A gentle traditional ally for calm, cared-for skin', whySource: ['beauty'], dimension: 'body' },
      { id: 'rose-hip', benefit: 'Prized by herbalists for nourished, bright-looking skin', whySource: ['beauty'] },
      { id: 'burdock', benefit: 'Traditionally used to support clear skin from within', whySource: ['beauty'], dimension: 'body' },
      { id: 'nettle', benefit: 'Mineral-rich leaves that feed skin, hair, and nails', whySource: ['beauty', 'energy'], dimension: 'body' },
      { id: 'horsetail', benefit: 'Traditionally gathered for strong hair, skin, and nails', whySource: ['beauty'], dimension: 'body' },
    ],
    triggers: { symptoms: ['beauty'], minMatches: 1, boosters: [] },
  },
  'hormonal-flux': {
    id: 'hormonal-flux',
    name: 'Hormonal Flux',
    summary: 'The body moves in cycles, and some seasons of the cycle ask for more support than others. The signals we hear — shifting mood, changing energy, a rhythm that feels unsettled — point to your hormones asking for gentle, steady companionship rather than force.',
    rootSupport: 'Traditional cycle allies to nourish balance across the month, adaptogens to steady mood and energy, and rhythms that honor the body\'s own timing.',
    preferredForm: 'capsule',
    dimension: 'body',
    allies: [
      { id: 'vitex', benefit: 'Traditionally used to support a balanced monthly cycle', whySource: ['hormones'] },
      { id: 'shatavari', benefit: 'A beloved Ayurvedic ally for feminine nourishment and ease', whySource: ['hormones'], dimension: 'soul' },
      { id: 'maca', benefit: 'An Andean root traditionally used for energy, mood, and harmony through hormonal shifts', whySource: ['hormones', 'energy'] },
      { id: 'red-clover', benefit: 'A gentle blossom traditionally used through life\'s shifting seasons', whySource: ['hormones'] },
      { id: 'black-cohosh', benefit: 'A traditional ally for comfort through the midlife transition', whySource: ['hormones'] },
    ],
    triggers: { symptoms: ['hormones'], minMatches: 1, boosters: ['emotional', 'duration-long'] },
  },
  'mental-fog': {
    id: 'mental-fog',
    name: 'Mental Fog',
    summary: 'The mind feels wrapped in gauze — thoughts arrive slowly, focus slips away mid-sentence, and clarity sits just out of reach. It is one of the oldest requests brought to the apothecary, and the tradition answers with herbs long kept by students, scholars, and poets.',
    rootSupport: 'Traditional clarity allies to nourish focus and memory, gentle adaptogens to steady mental energy, and small rituals of attention that help the mind settle and engage.',
    preferredForm: 'capsule',
    dimension: 'mind',
    allies: [
      { id: 'lion-mane', benefit: 'A distinctive mushroom herbalists reach for when clarity is wanted', whySource: ['cognitive', 'mental-fog'] },
      { id: 'bacopa', benefit: 'An Ayurvedic classic traditionally used by students and scholars', whySource: ['cognitive'] },
      { id: 'ginkgo', benefit: 'An ancient leaf traditionally used to support a clear, engaged mind', whySource: ['cognitive'] },
      { id: 'rosemary', benefit: 'The remembrance herb — traditionally used when focus feels scattered', whySource: ['cognitive', 'beauty'] },
      { id: 'gotu-kola', benefit: 'Traditionally used for a calm, centered, and clear mind', whySource: ['cognitive'] },
    ],
    triggers: { symptoms: ['cognitive'], minMatches: 1, boosters: ['mental-fog', 'racing-mind'] },
  },
  'foundational-balance': {
    id: 'foundational-balance',
    name: 'Foundational Balance',
    summary: 'Nothing here is calling out in alarm — and that is its own kind of wisdom. The body is simply asking for steady, foundational nourishment: the daily tonics and quiet rhythms that keep balance from becoming a project and resilience a habit.',
    rootSupport: 'Deep daily tonics to nourish the whole system, mineral-rich greens to replenish what ordinary days spend, and simple rhythms that make wellness the background of an ordinary day.',
    preferredForm: 'loose-tea',
    dimension: 'soul',
    allies: [
      { id: 'reishi', benefit: 'The mushroom of quiet resilience — a daily tonic in the Eastern tradition', whySource: ['wellness', 'immune'] },
      { id: 'astragalus', benefit: 'Builds deep, steady reserves for everyday resilience', whySource: ['wellness', 'immune'], dimension: 'body' },
      { id: 'moringa', benefit: 'A green, mineral-rich leaf that nourishes the everyday body', whySource: ['wellness', 'energy'], dimension: 'body' },
      { id: 'nettle', benefit: 'Replenishes minerals gently, one cup at a time', whySource: ['wellness', 'energy'], dimension: 'body' },
      { id: 'schisandra', benefit: 'A five-flavor berry traditionally used for balanced, all-day steadiness', whySource: ['wellness', 'cognitive'], dimension: 'mind' },
    ],
    triggers: { symptoms: ['wellness'], minMatches: 1, boosters: ['duration-long'] },
  },
};

/** Signal phrases (legacy SIGNAL_PHRASES — verbatim). */
export const ADVISOR_SIGNAL_PHRASES: Readonly<Record<string, string>> = {
  'sleep': 'sleep that feels unrefreshing',
  'stress': 'the stress you described',
  'energy': 'your need for more steady energy',
  'digestion': 'the digestive rhythm you shared',
  'immune': "the immune support you're seeking",
  'pain': 'the tension your body is holding',
  'cognitive': "the mental clarity you're after",
  'beauty': 'your focus on skin and radiance',
  'hormones': "the hormonal balance you're looking for",
  // NEW 2026-11-08: the legacy phrase map never carried the wellness
  // goal (its runs fell back to the raw token). Additive, same voice.
  'wellness': 'your wish for steady, everyday balance',
  'racing-mind': "a mind that won't settle",
  'light-sleep': 'light, easily-disturbed sleep',
  'tension': 'held physical tension',
  'burnout': 'signs of depletion',
  'afternoon-crash': 'afternoon energy dips',
  'duration-long': 'that this has been ongoing',
  'chronic': 'the long-standing nature of this',
  'mental-fog': 'mental fog',
  'bloating': 'bloating after meals',
  'after-eating': 'symptoms after eating',
  'slow-digestion': 'slowed digestion',
  'seasonal': 'seasonal vulnerability',
  'post-illness': 'recovery from recent illness',
  'low-reserves': 'low immune reserves',
  'muscle': 'muscle tension',
  'cold': 'cold, stiff places in the body',
  'stagnation': 'a sense of stagnation',
  'mood': 'the mood shifts you mentioned',
  'emotional': 'what you shared about emotional weight',
  'sensitive': 'your gentle-support preference',
  'acute': 'acute support needs',
  'specific-needs': 'your specific profile',
};

export function humanSignalPhrase(token: string): string {
  return ADVISOR_SIGNAL_PHRASES[token] ?? token.replace(/-/g, ' ');
}

/** Lifestyle rituals per pattern (legacy LIFESTYLE_RITUALS — verbatim). */
export const ADVISOR_LIFESTYLE_RITUALS: Readonly<Record<string, readonly { title: string; desc: string }[]>> = {
  'nervous-overwhelm': [
    { title: 'The 4-7-8 Breath', desc: 'Inhale for 4, hold for 7, exhale for 8. Three cycles before bed invites the nervous system to soften.' },
    { title: 'A Screen-Free Hour', desc: 'Dim the lights and close the laptop one hour before sleep — the simplest nervine there is.' },
    { title: 'Warm Water + Salt', desc: 'A cup of warm water with a pinch of good salt in the evening supports mineral balance and calm.' },
  ],
  'stress-depletion': [
    { title: 'Morning Sunlight', desc: 'Ten minutes of outdoor light within the first hour of waking steadies your internal rhythms.' },
    { title: 'Protein-Forward Breakfast', desc: 'A breakfast with real protein stabilizes energy better than any stimulant.' },
    { title: 'Name One Thing to Drop', desc: 'Recovery asks us to carry less, not just push through. Each morning, name one thing you can release today.' },
  ],
  'digestive-sluggishness': [
    { title: 'Warm Lemon Water', desc: 'A cup of warm water with lemon on waking gently invites digestion back online.' },
    { title: 'Eat Without Screens', desc: 'The vagus nerve works best when we slow down. One meal a day, no screens — feel the difference.' },
    { title: 'A Short Walk After Meals', desc: 'Ten minutes of gentle movement supports digestive motility more than any herb alone.' },
  ],
  'immune-strain': [
    { title: 'Sleep First', desc: 'Prioritize 7–9 hours before anything else — the immune system does its deepest work there.' },
    { title: 'Hydrate with Minerals', desc: "Plain water isn't always enough. A pinch of salt or mineral drops supports lymphatic flow." },
    { title: 'Gentle Movement', desc: 'Walking, stretching, or yoga supports the lymphatic pump — no heroic workouts needed.' },
  ],
  'stagnation': [
    { title: 'Five Minutes of Movement', desc: 'Any movement, every hour. Stagnation yields first to consistency, not intensity.' },
    { title: 'Contrast Shower', desc: 'End your shower with 30 seconds cool. Circulation responds beautifully to gentle contrast.' },
    { title: 'Deep Hip Stretch', desc: 'A few minutes in a supported squat or pigeon pose invites stagnant energy back into motion.' },
  ],
  /* NEW 2026-11-08 — rituals for the four new patterns, same voice. */
  'quiet-radiance': [
    { title: 'The Morning Mirror Moment', desc: 'One unhurried minute with your own reflection before the day begins — care lands differently when it is given with attention.' },
    { title: 'Minerals Before Makeup', desc: 'Something green and mineral-rich before anything cosmetic. Radiance is an inside job first.' },
    { title: 'Hands-On Care', desc: 'Massage your serum or balm in slowly, with intention. Touch is half the ritual.' },
  ],
  'hormonal-flux': [
    { title: 'Track the Rhythm', desc: 'A few notes each day — energy, mood, sleep — turn a confusing cycle into a pattern you can befriend.' },
    { title: 'Warmth at the Center', desc: 'A warm drink, or a heated wrap resting at the belly in the evening, invites the whole system to soften.' },
    { title: 'Honor the Low Days', desc: 'Cycles have seasons. Let the quieter days be quieter — support begins with listening.' },
  ],
  'mental-fog': [
    { title: 'One Thing at a Time', desc: 'Fog thickens under multitasking. Give the next hour a single, named purpose.' },
    { title: 'Move to Think', desc: 'A ten-minute walk before deep work — the mind clears in motion more reliably than at a desk.' },
    { title: 'The Evening Download', desc: "Write tomorrow's loose ends down before bed, and give the mind permission to set them down too." },
  ],
  'foundational-balance': [
    { title: 'The Daily Cup', desc: 'One nourishing cup at the same time each day — consistency is the whole secret of tonics.' },
    { title: 'A Minute Outdoors', desc: 'Light, air, and a horizon line, every day. The oldest wellness practice there is.' },
    { title: 'Small and Steady', desc: 'Choose the smallest version of the habit and keep it. Balance is built from kept promises.' },
  ],
};

/** Form explanations (legacy FORM_EXPLANATIONS, adapted per the law). */
export const ADVISOR_FORM_EXPLANATIONS: Readonly<Record<string, string>> = {
  'loose-tea': 'Tea Blend — best for calming evening rituals and gentle support',
  'capsule': 'Capsules — best for daily convenience and consistent internal support',
  'oil-infusion': 'Botanical Oil Infusion — concentrated botanical support, easy to take',
  'balm': 'Balm — best for targeted topical support and deep relief',
  'serum': 'Serum — best for skin-focused botanical support and radiance',
};

/* ------------------------------------------------------------------ */
/* Answers                                                             */
/* ------------------------------------------------------------------ */

export interface AdvisorAnswers {
  symptoms: string[];
  intensity: string | null;
  frequency: string | null;
  duration: string | null;
  sleep: string | null;
  stressLevel: string | null;
  digestion: string | null;
  emotional: string | null;
  triggers: string[];
  timeOfDay: string[];
  sensitivity: string | null;
  /** 'tea' | 'capsule' | 'oil-infusion' | 'balm' | 'serum' | 'no-preference' */
  preferredFormat: string | null;
}

export const EMPTY_ADVISOR_ANSWERS: AdvisorAnswers = {
  symptoms: [],
  intensity: null,
  frequency: null,
  duration: null,
  sleep: null,
  stressLevel: null,
  digestion: null,
  emotional: null,
  triggers: [],
  timeOfDay: [],
  sensitivity: null,
  preferredFormat: null,
};

const GOAL_IDS = new Set(ADVISOR_GOALS.map((g) => g.id));
const TRIGGER_IDS = new Set(ADVISOR_TRIGGERS.map((t) => t.id));

function pickId(value: unknown, options: readonly AdvisorOption[]): string | null {
  return typeof value === 'string' && options.some((o) => o.id === value)
    ? value
    : null;
}

function pickIds(value: unknown, valid: Set<string>, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === 'string' && valid.has(v) && !out.includes(v)) out.push(v);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Normalize untrusted input (API bodies) into AdvisorAnswers. Unknown
 * ids are dropped, multi-selects are capped — the shape the engine and
 * the stored snapshot can trust. Returns null only when the input is
 * not an object at all.
 */
export function normalizeAdvisorAnswers(input: unknown): AdvisorAnswers | null {
  if (typeof input !== 'object' || input === null) return null;
  const r = input as Record<string, unknown>;
  return {
    symptoms: pickIds(r.symptoms, GOAL_IDS, ADVISOR_MAX_SYMPTOMS),
    intensity: pickId(r.intensity, ADVISOR_INTENSITY),
    frequency: pickId(r.frequency, ADVISOR_FREQUENCY),
    duration: pickId(r.duration, ADVISOR_DURATION),
    sleep: pickId(r.sleep, ADVISOR_SLEEP),
    stressLevel: pickId(r.stressLevel, ADVISOR_STRESS),
    digestion: pickId(r.digestion, ADVISOR_DIGESTION),
    emotional: pickId(r.emotional, ADVISOR_EMOTIONAL),
    triggers: pickIds(r.triggers, TRIGGER_IDS, ADVISOR_TRIGGERS.length),
    timeOfDay: pickIds(
      r.timeOfDay,
      new Set(ADVISOR_TIME_OF_DAY.map((o) => o.id)),
      ADVISOR_TIME_OF_DAY.length,
    ),
    sensitivity: pickId(r.sensitivity, ADVISOR_SENSITIVITY),
    preferredFormat: pickId(r.preferredFormat, ADVISOR_FORMATS),
  };
}

/* ------------------------------------------------------------------ */
/* Synthesis engine (legacy gatherSignalsFromState / synthesize /      */
/* gatherAllies — ported faithfully)                                   */
/* ------------------------------------------------------------------ */

/** Legacy gatherSignalsFromState — ported verbatim. */
export function gatherAdvisorSignals(a: AdvisorAnswers): string[] {
  const signals: string[] = [];
  for (const sym of a.symptoms) signals.push(sym);
  if (a.duration === 'months' || a.duration === 'long-term') signals.push('duration-long');
  if (a.duration === 'long-term') signals.push('chronic');
  if (a.frequency === 'daily' && a.intensity === 'significant') signals.push('acute');
  if (a.sleep === 'light' || a.sleep === 'broken') signals.push('light-sleep');
  if (a.sleep === 'exhausted') signals.push('burnout');
  if (a.stressLevel === 'stretched' || a.stressLevel === 'depleted') signals.push('tension');
  if (a.stressLevel === 'depleted') signals.push('burnout');
  if (a.digestion === 'bloated') signals.push('bloating');
  if (a.digestion === 'sluggish') signals.push('slow-digestion');
  if (a.emotional === 'overwhelmed') signals.push('racing-mind');
  if (a.emotional === 'flat') signals.push('mental-fog');
  if (a.emotional === 'tender' || a.emotional === 'overwhelmed') signals.push('emotional');
  if (a.timeOfDay.includes('evening')) signals.push('tension');
  if (a.timeOfDay.includes('all-day')) signals.push('chronic');
  if (a.sensitivity === 'gentle') signals.push('sensitive');
  if (a.triggers.includes('work-pressure')) signals.push('tension');
  if (a.triggers.includes('screens-late')) signals.push('racing-mind');
  if (a.triggers.includes('poor-sleep')) signals.push('light-sleep');
  if (a.triggers.includes('overstim')) signals.push('racing-mind');
  if (a.triggers.includes('big-transition')) signals.push('emotional');
  return [...new Set(signals)];
}

export interface ScoredPattern {
  pattern: AdvisorPattern;
  score: number;
}

/**
 * Legacy synthesizePatterns (top 2, score floor of 3) — with one
 * deliberate completion, 2026-11-08: each pattern's own `minMatches`
 * gate is now HONORED. The legacy data always carried it (Stress
 * Depletion declares minMatches 2), but the 2026-10-22 port never
 * applied it, so a single shared goal could surface Stress Depletion
 * on one match. Honoring it is what routes a lone cognitive goal to
 * the (new) cognitive pattern instead of Stress Depletion; the legacy
 * fallback below still guarantees a pattern for any goal set.
 */
export function synthesizePatterns(symptoms: string[], signals: string[]): ScoredPattern[] {
  const signalSet = new Set(signals);
  const scored = Object.values(ADVISOR_PATTERNS)
    .map((pattern) => {
      let score = 0;
      let symptomMatches = 0;
      for (const sym of pattern.triggers.symptoms) {
        if (symptoms.includes(sym)) {
          score += 3;
          symptomMatches += 1;
        }
      }
      for (const b of pattern.triggers.boosters) {
        if (signalSet.has(b)) score += 2;
      }
      return { pattern, score, symptomMatches };
    })
    .filter((s) => s.score >= 3 && s.symptomMatches >= s.pattern.triggers.minMatches)
    .map(({ pattern, score }) => ({ pattern, score }));
  scored.sort((x, y) => y.score - x.score);
  if (scored.length === 0) {
    if (symptoms.includes('stress') || symptoms.includes('sleep')) {
      return [{ pattern: ADVISOR_PATTERNS['nervous-overwhelm'], score: 3 }];
    }
    return [{ pattern: ADVISOR_PATTERNS['stress-depletion'], score: 3 }];
  }
  return scored.slice(0, 2);
}

/** Legacy id aliases → current herb-catalog ids. */
export const ADVISOR_HERB_ID_ALIASES: Readonly<Record<string, string>> = {
  'devil-claw': 'devils-claw',
  'lion-mane': 'lions-mane',
  'bacopa': 'brahmi',
  'rose-hip': 'rosehip',
};

export interface AdvisorAlly {
  /** Current herb-catalog id. */
  id: string;
  name: string;
  latin: string;
  emoji: string;
  /** The pattern's own line for this ally (legacy pattern benefit). */
  benefit: string;
  /** "Chosen because of …" — legacy phrasing from matched signals. */
  whyLine: string;
  /** Current catalog traditional-use note. */
  traditionalNote: string;
  /** First traditional benefit from the current catalog record. */
  primaryBenefit: string;
  patternName: string;
  matchedSignals: string[];
  /** Body/Mind/Soul dimension (the ally's override, else its pattern's). */
  dimension: AdvisorDimension;
}

/** Results First (2026-11-08): a completed quiz always shows at least
 *  five botanicals, and at most eight. */
export const ADVISOR_ALLY_FLOOR = 5;
export const ADVISOR_ALLY_CAP = 8;

/**
 * Legacy gatherAllies (deduped) with catalog detail resolved — with
 * the Results First gathering rule (2026-11-08): the primary pattern
 * always contributes its full ally set (every pattern carries exactly
 * five, so the floor of 5 always holds). A second pattern expands the
 * list toward the cap of 8 ONLY when it is genuinely relevant — the
 * visitor actually chose at least one of the goals that pattern
 * answers. A pattern that scored on booster signals alone never pads
 * the list with filler.
 */
export function gatherAllies(
  patterns: ScoredPattern[],
  symptoms: string[],
  signals: string[],
): AdvisorAlly[] {
  const signalSet = new Set([...signals, ...symptoms]);
  const seen = new Set<string>();
  const allies: AdvisorAlly[] = [];
  patterns.forEach((entry, idx) => {
    if (idx > 0) {
      const genuinelyRelevant = entry.pattern.triggers.symptoms.some((s) =>
        symptoms.includes(s),
      );
      if (!genuinelyRelevant) return;
    }
    for (const a of entry.pattern.allies) {
      if (allies.length >= ADVISOR_ALLY_CAP) return;
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      const matched = a.whySource.filter((src) => signalSet.has(src));
      const phrases = matched.slice(0, 2).map(humanSignalPhrase);
      const whyLine =
        phrases.length > 0
          ? `Chosen because of ${phrases.join(' and ')}.`
          : `Chosen to nourish the ${entry.pattern.name.toLowerCase()} pattern you're navigating.`;
      const herb = getHerb(ADVISOR_HERB_ID_ALIASES[a.id] ?? a.id);
      allies.push({
        id: herb?.id ?? a.id,
        name: herb?.name ?? a.id,
        latin: herb?.latin ?? '',
        emoji: herb?.emoji ?? '🌿',
        benefit: a.benefit,
        whyLine,
        traditionalNote: herb?.traditionalNote ?? '',
        primaryBenefit: herb?.traditionalBenefits[0] ?? a.benefit,
        patternName: entry.pattern.name,
        matchedSignals: matched,
        dimension: a.dimension ?? entry.pattern.dimension,
      });
    }
  });
  return allies;
}

/* ------------------------------------------------------------------ */
/* Dimension lookups (for snapshots stored before dimensions existed)  */
/* ------------------------------------------------------------------ */

const ALLY_DIMENSION_BY_ID = new Map<string, AdvisorDimension>();
const ALLY_DIMENSION_BY_NAME = new Map<string, AdvisorDimension>();
const PATTERN_DIMENSION_BY_NAME = new Map<string, AdvisorDimension>();
for (const pattern of Object.values(ADVISOR_PATTERNS)) {
  PATTERN_DIMENSION_BY_NAME.set(pattern.name, pattern.dimension);
  for (const ally of pattern.allies) {
    const dimension = ally.dimension ?? pattern.dimension;
    const catalogId = ADVISOR_HERB_ID_ALIASES[ally.id] ?? ally.id;
    if (!ALLY_DIMENSION_BY_ID.has(catalogId)) {
      ALLY_DIMENSION_BY_ID.set(catalogId, dimension);
    }
    const herb = getHerb(catalogId);
    if (herb && !ALLY_DIMENSION_BY_NAME.has(herb.name.toLowerCase())) {
      ALLY_DIMENSION_BY_NAME.set(herb.name.toLowerCase(), dimension);
    }
  }
}

/** Dimension for a catalog herb id, or null when no pattern carries it. */
export function advisorAllyDimension(id: string): AdvisorDimension | null {
  return ALLY_DIMENSION_BY_ID.get(ADVISOR_HERB_ID_ALIASES[id] ?? id) ?? null;
}

/** Dimension for an ally display name (the classic engine's shape). */
export function advisorAllyDimensionByName(name: string): AdvisorDimension | null {
  return ALLY_DIMENSION_BY_NAME.get(name.trim().toLowerCase()) ?? null;
}

/** Dimension for a pattern display name (stored snapshots carry names). */
export function advisorPatternDimension(name: string): AdvisorDimension | null {
  return PATTERN_DIMENSION_BY_NAME.get(name) ?? null;
}

/** Legacy getLifestyleRituals (cap 3, deduped by title). */
export function getAdvisorRituals(patterns: ScoredPattern[]): { title: string; desc: string }[] {
  const rituals: { title: string; desc: string }[] = [];
  const seen = new Set<string>();
  for (const entry of patterns) {
    for (const r of ADVISOR_LIFESTYLE_RITUALS[entry.pattern.id] ?? []) {
      if (seen.has(r.title)) continue;
      seen.add(r.title);
      rituals.push({ ...r });
    }
  }
  return rituals.slice(0, 3);
}

/** Legacy mapPreferredFormatToKey, adapted to this app's form keys. */
export function advisorFormKey(answers: AdvisorAnswers, patterns: ScoredPattern[]): string {
  const pref = answers.preferredFormat;
  if (pref && pref !== 'no-preference') {
    const map: Record<string, string> = {
      tea: 'loose-tea',
      capsule: 'capsule',
      'oil-infusion': 'oil-infusion',
      balm: 'balm',
      serum: 'serum',
    };
    return map[pref] ?? 'capsule';
  }
  return patterns[0]?.pattern.preferredForm ?? 'capsule';
}

export function advisorFormLabel(formKey: string): string {
  const explanation = ADVISOR_FORM_EXPLANATIONS[formKey];
  return explanation ? explanation.split('—')[0].trim() : 'Custom Blend';
}

/** Legacy renderWellnessSummary, as data lines. */
export function advisorSummaryLines(
  patterns: ScoredPattern[],
  signals: string[],
): string[] {
  if (patterns.length === 0) {
    return [
      "Based on what you shared, we've gathered a gentle, foundational path for you below.",
      'Your body may simply be asking for more quiet, more nourishment, and a softer rhythm. The allies below are a starting place.',
    ];
  }
  const primary = patterns[0].pattern;
  const phrases = [...new Set(signals.slice(0, 3).map(humanSignalPhrase))];
  const opener =
    phrases.length > 0
      ? `Your answers suggest — ${phrases.join(', ')} — and together they point to a gentle, recognizable pattern: ${primary.name}.`
      : `Your answers point to a recognizable pattern: ${primary.name}.`;
  return [
    opener,
    primary.summary,
    'This combination often appears when the body is asking for recovery, softer pacing, and plants that have steadied others in the same place.',
  ];
}

/* ------------------------------------------------------------------ */
/* Full synthesis                                                      */
/* ------------------------------------------------------------------ */

export interface AdvisorSynthesis {
  answers: AdvisorAnswers;
  signals: string[];
  patterns: ScoredPattern[];
  allies: AdvisorAlly[];
  rituals: { title: string; desc: string }[];
  formKey: string;
  formLabel: string;
  formExplanation: string;
  summaryLines: string[];
  /** Apothecary product handles after the safety screening rules. */
  productHandles: string[];
  /** Product handles the screening rules withheld, with reasons. */
  withheld: QuizWithheldProduct[];
}

export function computeAdvisorSynthesis(
  answers: AdvisorAnswers,
  screening: QuizScreening,
): AdvisorSynthesis {
  const signals = gatherAdvisorSignals(answers);
  const patterns = synthesizePatterns(answers.symptoms, signals);
  const allies = gatherAllies(patterns, answers.symptoms, signals);
  const rituals = getAdvisorRituals(patterns);
  const formKey = advisorFormKey(answers, patterns);

  // Product suggestions: the legacy per-goal recommendations, gathered
  // in answer order, then passed through the SAME data-driven safety
  // screening rules as the focus-area engine (lib/quiz/quiz.ts).
  const candidates: string[] = [];
  for (const symptom of answers.symptoms) {
    for (const handle of ADVISOR_PRODUCT_RECOMMENDATIONS[symptom] ?? []) {
      if (!candidates.includes(handle)) candidates.push(handle);
    }
  }
  const productHandles: string[] = [];
  const withheld: QuizWithheldProduct[] = [];
  for (const handle of candidates.slice(0, 4)) {
    const product = getProductByHandle(handle);
    if (screening.pregnantOrNursing && product && isIngestibleProduct(product)) {
      withheld.push({ handle, reason: 'pregnancy-ingestible' });
      continue;
    }
    if (screening.takingMedication && product && safetyTextMentionsMedication(product)) {
      withheld.push({ handle, reason: 'medication-interaction' });
      continue;
    }
    productHandles.push(handle);
  }

  return {
    answers,
    signals,
    patterns,
    allies,
    rituals,
    formKey,
    formLabel: advisorFormLabel(formKey),
    formExplanation: ADVISOR_FORM_EXPLANATIONS[formKey] ?? '',
    summaryLines: advisorSummaryLines(patterns, signals),
    productHandles,
    withheld,
  };
}

/* ------------------------------------------------------------------ */
/* Legacy focus-area mapping (profile save + lead snapshot compat)     */
/* ------------------------------------------------------------------ */

/**
 * The advisor's goals are richer than the legacy 8-concern matrix the
 * profile/lead stores were built on. These maps translate an advisor
 * run into that matrix so the existing stores (and their tests) keep
 * working unchanged; the FULL advisor result rides on the snapshot's
 * advisor block.
 */
export const ADVISOR_GOAL_TO_CONCERN: Readonly<Record<string, string>> = {
  sleep: 'sleep',
  energy: 'energy',
  stress: 'spiritual',
  immune: 'immune',
  hormones: 'hormonal',
  digestion: 'digestive',
  pain: 'pain',
  beauty: 'beauty',
  cognitive: 'spiritual',
  wellness: 'energy',
};

export const ADVISOR_FORMKEY_TO_FORM: Readonly<Record<string, string>> = {
  'loose-tea': 'tea',
  capsule: 'capsule',
  'oil-infusion': 'oil-infusion',
  balm: 'balm',
  serum: 'oil-infusion',
};

export function advisorLegacyIds(synthesis: AdvisorSynthesis): {
  concernId: string;
  formId: string;
} {
  const first = synthesis.answers.symptoms[0] ?? 'wellness';
  return {
    concernId: ADVISOR_GOAL_TO_CONCERN[first] ?? 'energy',
    formId: ADVISOR_FORMKEY_TO_FORM[synthesis.formKey] ?? 'any',
  };
}

/* ------------------------------------------------------------------ */
/* Snapshot (stored on the lead record + rendered by email / PDF)      */
/* ------------------------------------------------------------------ */

export interface AdvisorResultSnapshot {
  answers: AdvisorAnswers;
  primaryPattern: string;
  patterns: {
    name: string;
    summary: string;
    rootSupport: string;
    /** Optional: snapshots stored before 2026-11-08 carry no dimension;
     *  renderers resolve it from the pattern name when absent. */
    dimension?: AdvisorDimension;
  }[];
  allies: {
    id: string;
    name: string;
    latin: string;
    benefit: string;
    whyLine: string;
    traditionalNote: string;
    primaryBenefit: string;
    /** Optional for the same backward-compatibility reason as above. */
    dimension?: AdvisorDimension;
  }[];
  rituals: { title: string; desc: string }[];
  formKey: string;
  formLabel: string;
  formExplanation: string;
  summaryLines: string[];
  productHandles: string[];
  withheld: QuizWithheldProduct[];
}

export function toAdvisorResultSnapshot(s: AdvisorSynthesis): AdvisorResultSnapshot {
  return {
    answers: {
      ...s.answers,
      symptoms: [...s.answers.symptoms],
      triggers: [...s.answers.triggers],
      timeOfDay: [...s.answers.timeOfDay],
    },
    primaryPattern: s.patterns[0]?.pattern.name ?? '',
    patterns: s.patterns.map((p) => ({
      name: p.pattern.name,
      summary: p.pattern.summary,
      rootSupport: p.pattern.rootSupport,
      dimension: p.pattern.dimension,
    })),
    allies: s.allies.map((a) => ({
      id: a.id,
      name: a.name,
      latin: a.latin,
      benefit: a.benefit,
      whyLine: a.whyLine,
      traditionalNote: a.traditionalNote,
      primaryBenefit: a.primaryBenefit,
      dimension: a.dimension,
    })),
    rituals: s.rituals.map((r) => ({ ...r })),
    formKey: s.formKey,
    formLabel: s.formLabel,
    formExplanation: s.formExplanation,
    summaryLines: [...s.summaryLines],
    productHandles: [...s.productHandles],
    withheld: s.withheld.map((w) => ({ ...w })),
  };
}

/* ------------------------------------------------------------------ */
/* Amber's "why these allies" narrative (owner-directed 2026-10-22)    */
/*                                                                     */
/* Written in Amber's cosmic, validating voice and framed as HER       */
/* perspective and practice — never as medical diagnosis or disease    */
/* causation. Problematic phrasing from the original direction was     */
/* softened per her own instruction ("change problematic wording but   */
/* always keep cosmic, magical and mystical writing").                 */
/* ------------------------------------------------------------------ */

export const ADVISOR_WHY_ALLIES_HEADING = 'Why These Plants Are Calling to You';

export const ADVISOR_WHY_ALLIES_PARAGRAPHS: readonly string[] = [
  'In Amber\'s work, she sees this pattern again and again: what we live through does not simply pass through us. The emotions we could not safely feel in the moment — the experiences we had to push away just to keep going — do not disappear. That unprocessed energy settles in and is carried by the body: in tension that will not unwind, in rest that never quite restores, in the quiet heaviness so many carry without a name for it.',
  'This is why your answers matter, and why these particular allies rose to meet them. In this tradition, the body is wise — it asks for what it needs. When your system reaches toward calming nervines, it may be asking for permission to finally soften. When it reaches for restorative, rebuilding plants, it may be asking to refill what years of carrying too much has drained. Your allies are not random. They are the plants whose gifts answer what your body has been holding.',
  'Working with your allies is a beautiful beginning. And if what you are carrying feels older, or deeper, than a daily ritual can reach, that is the heart of Amber\'s one-on-one work: gently processing and releasing the trauma and stored emotion beneath the pattern — through hypnotherapy, trauma release, and past life regression — so your body no longer has to hold it. You deserve to set it down. ✦',
];

export const ADVISOR_SPECIALTIES_LINE =
  'Amber specializes in processing and releasing trauma, past life regression, and is a certified hypnotherapist.';

/** Gentle reassurance per phase (legacy ADVISOR_REASSURANCE + safety). */
export const ADVISOR_REASSURANCE: Readonly<Record<string, string>> = {
  foundation: "Take a breath. There's no wrong answer here — we're just beginning to listen.",
  shape: "You're doing beautifully. Each answer helps us hear the pattern beneath the symptom.",
  wholeHuman: 'The whole human matters — how you sleep, stress, and feel all shape the right plants for you.',
  nuance: 'Almost there. Your match is taking shape — these final details make it truly yours.',
  safety: 'A few gentle safety questions, so what we suggest honors your body exactly as it is.',
  lead: "Your personalized report is ready. One quiet step, and it's yours to keep.",
  results: 'Here is what your answers gently revealed.',
};

/** The capsule explainer (owner's words, 2026-10-22) for the builder. */
export const CAPSULE_EXPLAINER =
  'Our capsules begin as whole organic botanicals, ground to a fine powder and capsuled by hand — the whole plant, in a simple daily ritual, made for the days when you don\'t have time to brew a tea.';
