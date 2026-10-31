/**
 * "Choose your form" guide data — consultation landing (/custom-formula).
 *
 * Pure data module (no imports, no side effects) so the fixed form order
 * and every CTA target are unit-testable. Copy is Amber's copy pack
 * 2026-10-25, verbatim. Claim-safe traditional-use language only.
 *
 * FIXED ORDER (owner directive): Tea, Balm, Tincture, Serum, Capsules —
 * tea first (most familiar), capsules last (least familiar to newcomers).
 *
 * Site truth honored here: there is NO tincture product or builder in
 * this apothecary. The tincture card is educational (quiz + Message
 * Amber), and carries the standing line that the liquid form here is
 * crafted as a Botanical Oil Infusion. No tincture product is invented.
 */

export type FormGuideAction =
  | { type: 'link'; label: string; href: string }
  | { type: 'contact'; label: string };

export interface FormGuideEntry {
  id: 'tea' | 'balm' | 'tincture' | 'serum' | 'capsules';
  emoji: string;
  name: string;
  title: string;
  tagline: string;
  whatItIs: string;
  /** Optional standing-truth note (tincture card only). */
  note?: string;
  body: string;
  mind: string;
  soul: string;
  actions: FormGuideAction[];
}

export const FORM_GUIDE_INTRO = {
  heading: 'Not Sure Where to Start? Start With a Form You Already Know.',
  body: "Most people walk into the apothecary not knowing a single herb — and that's completely normal. You don't need herbal knowledge to begin. Think of each form below as a different door into the same garden: they all lead to the plants, they just open in the way that fits your life. Pick the door that feels familiar, and the herbs will meet you there.",
} as const;

export const FORM_GUIDE: readonly FormGuideEntry[] = [
  {
    id: 'tea',
    emoji: '🍵',
    name: 'Tea',
    title: 'Herbal Tea Blend',
    tagline: 'The gentlest doorway in.',
    whatItIs:
      'Dried herbs steeped in hot water — the oldest form of herbalism there is. If you can make a cup of tea, you can do this.',
    body: "Warm water draws the plants' goodness into your cup, sip by sip, through the day.",
    mind: 'The kettle, the steam, the pause — a built-in moment to slow down and breathe.',
    soul: "A small daily ritual that turns 'taking care of myself' into something you actually look forward to.",
    actions: [{ type: 'link', label: 'Build your tea', href: '/custom-formula/tea' }],
  },
  {
    id: 'balm',
    emoji: '🫙',
    name: 'Balm',
    title: 'Balm / Salve',
    tagline: 'Herbs through the skin.',
    whatItIs:
      'Herb-infused oils set into a soft, rub-on balm. You massage it where your body asks for attention — no measuring, no brewing.',
    body: 'Works right where you put it: skin, muscles, and the places that carry your day.',
    mind: "The simple act of touch slows you down and tells your nervous system it's safe to soften.",
    soul: 'Anointing is one of the oldest rituals there is — care you can feel in your hands.',
    actions: [
      { type: 'link', label: 'Build your balm', href: '/custom-formula/balm' },
      { type: 'link', label: 'Shop balms', href: '/shop' },
      { type: 'contact', label: 'Ask about a custom balm' },
    ],
  },
  {
    id: 'tincture',
    emoji: '💧',
    name: 'Tincture',
    title: 'Drops',
    tagline: 'A few drops, deeply extracted.',
    whatItIs:
      'Herbs steeped for weeks in alcohol (sometimes vinegar or glycerin) until the liquid itself becomes the remedy. Taken by the dropper, in a little water or under the tongue.',
    note: "In Amber's apothecary, the liquid form is crafted as a Botanical Oil Infusion rather than an alcohol tincture — ask Amber if you're not sure which liquid is right for you.",
    body: 'Concentrated and fast to take — a dropper instead of a whole cup or capsule.',
    mind: 'For people who want their ritual to take ten seconds, not ten minutes.',
    soul: "The old apothecaries called these 'essences' — the spirit of the plant, kept in a bottle.",
    actions: [
      { type: 'link', label: 'Take the quiz', href: '/quiz' },
      { type: 'contact', label: 'Message Amber' },
    ],
  },
  {
    id: 'serum',
    emoji: '✨',
    name: 'Serum',
    title: 'Botanical Serum / Oil',
    tagline: 'Liquid gold for skin and scalp.',
    whatItIs:
      'Herbs slow-infused into nourishing oils, used drop by drop on skin or scalp and massaged in. A serum lives OUTSIDE the body — it is never swallowed.',
    body: 'Feeds the surface directly: scalp, skin, and hair, where dryness and dullness start.',
    mind: 'A few mindful minutes with your hands in your hair can be the quietest part of the day.',
    soul: 'Oils have carried prayers and plant medicine in every tradition — this is beauty as a ritual, not a routine.',
    actions: [
      { type: 'link', label: 'Shop the serum', href: '/shop/root-scalp-revival-serum' },
    ],
  },
  {
    id: 'capsules',
    emoji: '💊',
    name: 'Capsules',
    title: 'Custom Herbal Capsules',
    tagline: 'The apothecary, in your pocket.',
    whatItIs:
      'Think of capsules as herbal super-vitamins: whole herbs, finely ground and sealed into a small capsule you take like any daily supplement. No taste, no brewing, no ritual required.',
    body: 'Steady, measured support that fits into the routine you already have — morning vitamins, meet your herbal allies.',
    mind: 'Nothing new to learn and nothing to prepare — the easiest form to stay consistent with.',
    soul: 'Not every ritual needs candles. Sometimes devotion looks like showing up for yourself in the simplest way, every day.',
    actions: [
      { type: 'link', label: 'Build your capsules', href: '/custom-formula/capsules' },
    ],
  },
];

/** Explainer box rendered between the Serum and Capsules cards. */
export const TINCTURE_VS_SERUM = {
  heading: "Tincture or Serum? Here's the Simple Difference.",
  body: "Same garden, different doors. A TINCTURE is an alcohol (or vinegar) extract you take BY MOUTH, in drops — it works from the inside out. A SERUM is an oil infusion you put ON YOUR SKIN or scalp and massage in — it works from the outside in, and is never swallowed. If it goes in a dropper bottle, ask one question: 'mouth or skin?' That answer tells you which one you're holding.",
} as const;

/** Builder-page intro metaphor lines (copy pack §3), keyed by builder kind. */
export const BUILDER_INTRO_LINES: Record<'tea' | 'capsule' | 'balm', string> = {
  tea: "New to herbs? A tea blend is like a soup recipe — a few plants, hot water, and a little patience. You can't get this wrong.",
  capsule:
    'New to herbs? Think of your formula like a team: each herb has one job, and together they cover yours. Pick what calls to you — the safety step will double-check everything.',
  balm: 'New to balms? Think of it like choosing a favorite jar from the apothecary shelf — your finish, your botanicals, your scent — and Amber crafts it the slow way, just for you.',
};
