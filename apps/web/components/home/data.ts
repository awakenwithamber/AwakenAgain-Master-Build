/**
 * Homepage section data — Amber's Alchemy Apothecary.
 *
 * Copy for the "What Can We Help You With?" goal cards is drawn from the
 * canonical catalog's short_description text (owner content). Product
 * handles below are real catalog handles → /shop/<handle> pages exist.
 */

export interface GoalCard {
  emoji: string;
  badge?: string;
  heading: string;
  copy: string;
  link: { href: string; label: string };
}

export const GOAL_CARDS: GoalCard[] = [
  {
    emoji: '😴',
    badge: 'Best for beginners',
    heading: 'Better Sleep',
    copy: 'A moonlit capsule ritual for deep rest, a quiet mind, and mornings that feel softer.',
    link: { href: '/shop/dreamease-capsules', label: 'Go to recommended formula' },
  },
  {
    emoji: '🧘',
    badge: 'Most popular',
    heading: 'Reduced Stress',
    copy: 'A calming botanical blend for relaxation, emotional balance, and everyday stress support.',
    link: { href: '/shop/chill-pill-capsules', label: 'Go to recommended formula' },
  },
  {
    emoji: '🌸',
    heading: 'Balanced Hormones',
    copy: 'A botanical blend supporting normal menstrual-cycle wellness, comfort, and steady daily energy.',
    link: { href: '/shop/sacred-balance-capsules', label: 'Shop Hormones →' },
  },
  {
    emoji: '💇',
    heading: 'Stronger Hair',
    copy: 'A botanical scalp serum for conditioning, shine, and fuller-looking hair.',
    link: { href: '/shop/root-scalp-revival-serum', label: 'Shop Hair →' },
  },
  {
    emoji: '⚡',
    heading: 'Natural Energy',
    copy: 'Clean, grounded energy for the days you need to feel bright, focused, and fully online.',
    link: { href: '/shop/vital-vitality-capsules', label: 'Shop Energy →' },
  },
  {
    emoji: '✨',
    heading: 'Younger Skin',
    copy: 'A rich botanical face-and-body balm that moisturizes, softens, and supports a radiant-looking complexion.',
    link: { href: '/shop/radiance-renewal-balm', label: 'Shop Skin →' },
  },
  {
    emoji: '🌿',
    heading: 'Pain Relief',
    copy: 'A comforting herbal massage balm for tired muscles and everyday body care.',
    link: { href: '/shop/soothe-restore-botanical-balm', label: 'Shop Pain Relief →' },
  },
];

export interface HowMadeStep {
  title: string;
  copy: string;
}

export const HOW_MADE_STEPS: HowMadeStep[] = [
  {
    title: 'Sourced',
    copy: 'Each herb is selected for potency and purity.',
  },
  {
    title: 'Infused',
    copy: 'Slowly infused to preserve natural plant compounds.',
  },
  {
    title: 'Handcrafted',
    copy: 'Made by hand in small batches.',
  },
  {
    title: 'Shipped',
    copy: 'Packed and shipped with care.',
  },
];

export interface TrustStat {
  value: string;
  label: string;
  copy: string;
}

export const TRUST_STATS: TrustStat[] = [
  {
    value: '316+',
    label: 'Medicinal Herbs',
    copy: 'A deep botanical library behind every formula.',
  },
  {
    value: 'Small-Batch',
    label: 'Handcrafted',
    copy: 'Handcrafted — never mass-produced.',
  },
  {
    value: 'Zero',
    label: 'Fillers',
    copy: 'Pure botanical ingredients only.',
  },
  {
    value: 'Custom',
    label: 'Formulas',
    copy: 'Tailored to your body and symptoms.',
  },
];

/** Catalog handles shown in the "Best Sellers" row. Real products only. */
export const BEST_SELLER_HANDLES = [
  'dreamease-capsules',
  'chill-pill-capsules',
  'sacred-balance-capsules',
  'gaias-rose-soap',
] as const;

/** Featured product that anchors the homepage Reviews section (wired to the real reviews system). */
export const REVIEWS_PRODUCT_HANDLE = 'dreamease-capsules';
