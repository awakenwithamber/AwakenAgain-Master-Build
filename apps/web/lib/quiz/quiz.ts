/**
 * Herbal Allies Quiz — question logic + recommendation engine (G6).
 *
 * Concept carried forward from the legacy static "Find Your Remedy" quiz:
 * step 1 picks a primary concern, step 2 picks a preferred remedy form, the
 * engine returns herbal allies plus matching catalog products. Rebuilt as
 * pure, testable logic — no DOM hacks.
 *
 * COMPLIANCE LAW (owner-fixed, non-negotiable):
 * - No diagnose/treat/cure/prevent claims. Ally notes use evidence-context
 *   language: "traditionally used by herbalists for X" (traditional),
 *   "early laboratory research explores X" (lab), "small human studies
 *   have examined X" (human). Never collapse to "proven".
 * - "Tincture" never appears; the concentrated-liquid form is a
 *   "Botanical Oil Infusion".
 *
 * All copy lives here so the client island (components/quiz/Quiz.tsx) and
 * the server API (app/api/quiz-lead/route.ts) share one source of truth.
 */

/** Evidence context for an herbal note — never collapsed to "proven". */
export type EvidenceContext = 'traditional' | 'lab' | 'human';

export interface QuizConcern {
  id: string;
  label: string;
  icon: string;
}

export interface QuizForm {
  id: string;
  label: string;
  icon: string;
}

export interface HerbalAlly {
  /** Common name, e.g. "Valerian root". */
  name: string;
  /** Latin name, e.g. "Valeriana officinalis". */
  latin: string;
  evidence: EvidenceContext;
  /** Honest one-liner — evidence-context phrased, no cure claims. */
  note: string;
}

export interface QuizProductRecommendation {
  handle: string;
  reason: string;
}

export const QUIZ_CONCERNS: readonly QuizConcern[] = [
  { id: 'sleep', label: 'Sleep & Rest', icon: '🌙' },
  { id: 'energy', label: 'Energy & Vitality', icon: '⚡' },
  { id: 'immune', label: 'Immune Support', icon: '🛡️' },
  { id: 'pain', label: 'Pain & Inflammation', icon: '🌿' },
  { id: 'beauty', label: 'Skin & Beauty', icon: '✨' },
  { id: 'hormonal', label: 'Hormonal Balance', icon: '🪷' },
  { id: 'digestive', label: 'Digestion', icon: '🍃' },
  { id: 'spiritual', label: 'Spiritual & Clarity', icon: '🔮' },
];

export const QUIZ_FORMS: readonly QuizForm[] = [
  { id: 'tea', label: 'Herbal Tea', icon: '🍵' },
  { id: 'capsule', label: 'Capsules', icon: '💊' },
  { id: 'balm', label: 'Balm / Salve', icon: '🫙' },
  { id: 'oil-infusion', label: 'Botanical Oil Infusion', icon: '✨' },
  { id: 'any', label: 'Any form', icon: '🌿' },
];

export const QUIZ_STEP_NAMES = ['concern', 'form', 'results'] as const;

interface ConcernEntry {
  concern: QuizConcern;
  allies: HerbalAlly[];
  /** Product handles keyed by form; 'any' is the fallback. */
  products: Record<string, string>;
}

/**
 * Canonical concern → allies + products. Product handles reference the
 * generated catalog (lib/catalog/products) — the island resolves titles
 * from there rather than duplicating names.
 */
const QUIZ_MAP: Record<string, ConcernEntry> = {
  sleep: {
    concern: QUIZ_CONCERNS[0],
    allies: [
      {
        name: 'Valerian root',
        latin: 'Valeriana officinalis',
        evidence: 'traditional',
        note: 'Traditionally used by herbalists as an evening nervine to encourage restful sleep.',
      },
      {
        name: 'Passionflower',
        latin: 'Passiflora incarnata',
        evidence: 'lab',
        note: 'Early laboratory research explores its calming qualities; traditionally used to quiet a busy mind.',
      },
      {
        name: 'Chamomile',
        latin: 'Matricaria chamomilla',
        evidence: 'traditional',
        note: 'Traditionally used by herbalists as a gentle evening herb for winding down.',
      },
    ],
    products: {
      tea: 'alchemy-tea-blend',
      capsule: 'dreamease-capsules',
      balm: 'soothe-restore-botanical-balm',
      'oil-infusion': 'root-scalp-revival-serum',
      any: 'dreamease-capsules',
    },
  },
  energy: {
    concern: QUIZ_CONCERNS[1],
    allies: [
      {
        name: 'Ashwagandha',
        latin: 'Withania somnifera',
        evidence: 'human',
        note: 'A traditional adaptogen; small human studies have examined its role in resilience to everyday stress.',
      },
      {
        name: 'Rhodiola',
        latin: 'Rhodiola rosea',
        evidence: 'traditional',
        note: 'Traditionally used by herbalists in cold climates for stamina and steadiness.',
      },
      {
        name: 'Holy basil',
        latin: 'Ocimum tenuiflorum',
        evidence: 'traditional',
        note: 'Traditionally used in Ayurvedic practice as a balancing, clarifying herb.',
      },
    ],
    products: {
      tea: 'alchemy-tea-blend',
      capsule: 'vital-vitality-capsules',
      balm: 'soothe-restore-botanical-balm',
      'oil-infusion': 'root-scalp-revival-serum',
      any: 'vital-vitality-capsules',
    },
  },
  immune: {
    concern: QUIZ_CONCERNS[2],
    allies: [
      {
        name: 'Elderberry',
        latin: 'Sambucus nigra',
        evidence: 'lab',
        note: 'Early laboratory research explores its properties; traditionally used by herbalists in seasonal wellness routines.',
      },
      {
        name: 'Astragalus',
        latin: 'Astragalus membranaceus',
        evidence: 'traditional',
        note: 'Traditionally used in Chinese herbal practice to nourish deep reserves over time.',
      },
      {
        name: 'Echinacea',
        latin: 'Echinacea purpurea',
        evidence: 'traditional',
        note: 'Traditionally used by herbalists during seasonal transitions.',
      },
    ],
    products: {
      tea: 'alchemy-tea-blend',
      capsule: 'immune-at-ease-capsules',
      balm: 'soothe-restore-botanical-balm',
      'oil-infusion': 'root-scalp-revival-serum',
      any: 'immune-at-ease-capsules',
    },
  },
  pain: {
    concern: QUIZ_CONCERNS[3],
    allies: [
      {
        name: 'Turmeric',
        latin: 'Curcuma longa',
        evidence: 'human',
        note: 'Traditionally used for centuries; small human studies have examined its role in inflammatory comfort.',
      },
      {
        name: 'Arnica',
        latin: 'Arnica montana',
        evidence: 'traditional',
        note: 'Traditionally used topically by herbalists for bumps, bruises, and overworked muscles (external use only).',
      },
      {
        name: 'Willow bark',
        latin: 'Salix alba',
        evidence: 'traditional',
        note: 'Traditionally used by herbalists for everyday aches; check with your healthcare provider if you take blood thinners.',
      },
    ],
    products: {
      tea: 'alchemy-tea-blend',
      capsule: 'vital-connect-capsules',
      balm: 'soothe-restore-botanical-balm',
      'oil-infusion': 'root-scalp-revival-serum',
      any: 'soothe-restore-botanical-balm',
    },
  },
  beauty: {
    concern: QUIZ_CONCERNS[4],
    allies: [
      {
        name: 'Rose',
        latin: 'Rosa damascena',
        evidence: 'traditional',
        note: 'Traditionally used in skincare rituals for its gentle, toning character.',
      },
      {
        name: 'Calendula',
        latin: 'Calendula officinalis',
        evidence: 'traditional',
        note: 'Traditionally used by herbalists in topical preparations for sensitive skin.',
      },
      {
        name: 'Hibiscus',
        latin: 'Hibiscus sabdariffa',
        evidence: 'lab',
        note: 'Early laboratory research explores its antioxidant profile; traditionally called the "botox plant" in folk beauty rituals.',
      },
    ],
    products: {
      tea: 'alchemy-tea-blend',
      capsule: 'radiance-support-capsules',
      balm: 'radiance-renewal-balm',
      'oil-infusion': 'root-scalp-revival-serum',
      any: 'radiance-renewal-balm',
    },
  },
  hormonal: {
    concern: QUIZ_CONCERNS[5],
    allies: [
      {
        name: 'Chasteberry',
        latin: 'Vitex agnus-castus',
        evidence: 'traditional',
        note: 'Traditionally used by herbalists in cyclical wellness routines.',
      },
      {
        name: 'Red raspberry leaf',
        latin: 'Rubus idaeus',
        evidence: 'traditional',
        note: 'Traditionally used as a nourishing uterine tonic in folk herbalism.',
      },
      {
        name: 'Shatavari',
        latin: 'Asparagus racemosus',
        evidence: 'traditional',
        note: 'Traditionally used in Ayurvedic practice as a feminine-balance herb.',
      },
    ],
    products: {
      tea: 'alchemy-tea-blend',
      capsule: 'sacred-balance-capsules',
      balm: 'soothe-restore-botanical-balm',
      'oil-infusion': 'root-scalp-revival-serum',
      any: 'sacred-balance-capsules',
    },
  },
  digestive: {
    concern: QUIZ_CONCERNS[6],
    allies: [
      {
        name: 'Peppermint',
        latin: 'Mentha × piperita',
        evidence: 'traditional',
        note: 'Traditionally used by herbalists to ease everyday digestive heaviness.',
      },
      {
        name: 'Ginger',
        latin: 'Zingiber officinale',
        evidence: 'human',
        note: 'Traditionally used worldwide; small human studies have examined its role in digestive comfort.',
      },
      {
        name: 'Fennel',
        latin: 'Foeniculum vulgare',
        evidence: 'traditional',
        note: 'Traditionally used after meals in Mediterranean folk practice.',
      },
    ],
    products: {
      tea: 'alchemy-tea-blend',
      capsule: 'seasonal-gut-reset',
      balm: 'soothe-restore-botanical-balm',
      'oil-infusion': 'root-scalp-revival-serum',
      any: 'seasonal-gut-reset',
    },
  },
  spiritual: {
    concern: QUIZ_CONCERNS[7],
    allies: [
      {
        name: 'Frankincense',
        latin: 'Boswellia sacra',
        evidence: 'traditional',
        note: 'Traditionally burned or anointed in meditation and ritual for grounding clarity.',
      },
      {
        name: 'Mugwort',
        latin: 'Artemisia vulgaris',
        evidence: 'traditional',
        note: 'Traditionally called the "dream herb" across cultures, used in dreamwork rituals.',
      },
      {
        name: 'Blue lotus',
        latin: 'Nymphaea caerulea',
        evidence: 'traditional',
        note: 'Traditionally used in sacred ceremony and quiet contemplation.',
      },
    ],
    products: {
      tea: 'alchemy-tea-blend',
      capsule: 'personalized-herbal-protocols',
      balm: 'soothe-restore-botanical-balm',
      'oil-infusion': 'root-scalp-revival-serum',
      any: 'personalized-herbal-protocols',
    },
  },
};

export interface QuizResult {
  concern: QuizConcern;
  form: QuizForm;
  allies: HerbalAlly[];
  productHandles: string[];
  productReason: string;
}

export function isValidConcernId(id: unknown): id is keyof typeof QUIZ_MAP {
  return typeof id === 'string' && id in QUIZ_MAP;
}

export function isValidFormId(id: unknown): id is string {
  return typeof id === 'string' && QUIZ_FORMS.some((f) => f.id === id);
}

export function getConcern(id: string): QuizConcern | undefined {
  return QUIZ_CONCERNS.find((c) => c.id === id);
}

export function getForm(id: string): QuizForm | undefined {
  return QUIZ_FORMS.find((f) => f.id === id);
}

/**
 * Pure recommendation engine: (concern, form) → allies + product handles.
 * Returns null for invalid inputs — callers surface a friendly error.
 */
export function getQuizResult(
  concernId: string,
  formId: string,
): QuizResult | null {
  const entry = QUIZ_MAP[concernId];
  const form = getForm(formId);
  if (!entry || !form) return null;
  const handle = entry.products[form.id] ?? entry.products.any;
  return {
    concern: entry.concern,
    form,
    allies: entry.allies,
    productHandles: [handle, 'alchemy-tea-blend', 'custom-remedy-consultation'],
    productReason: `Matched to your ${entry.concern.label.toLowerCase()} focus and your preference for ${form.label.toLowerCase()} forms.`,
  };
}
