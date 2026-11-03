/**
 * Shop-by-goal mapping — pure data module (workstream G).
 *
 * Separated from ShopClient.tsx so the regression test can import it
 * without pulling JSX into vitest (no react transform is configured).
 *
 * Goal → catalog handles, curated from the quiz concern mappings
 * (lib/quiz/quiz.ts). Every handle must be a REAL catalog product — the
 * regression test pins that.
 */

export interface ShopGoal {
  id: string;
  icon: string;
  label: string;
  handles: string[];
}

/** Goal → catalog handles, curated from the quiz concern mappings. */
export const SHOP_GOALS: ShopGoal[] = [
  {
    id: 'sleep',
    icon: '😴',
    label: 'Sleep Support',
    handles: [
      'dreamease-capsules',
      'lavender-fairy-dream-soap',
      'alchemy-tea-blend',
      'chill-pill-capsules',
    ],
  },
  {
    id: 'stress',
    icon: '🧘',
    label: 'Calm & Stress Support',
    handles: [
      'chill-pill-capsules',
      'alchemy-tea-blend',
      'lavender-fairy-dream-soap',
      'unwind-ritual-bundle',
    ],
  },
  {
    id: 'hormonal',
    icon: '🌸',
    label: "Women's Wellness",
    handles: ['sacred-balance-capsules', 'happy-pill-capsules'],
  },
  {
    id: 'hair',
    icon: '💇',
    label: 'Hair & Scalp Care',
    handles: ['root-scalp-revival-serum'],
  },
  {
    id: 'energy',
    icon: '⚡',
    label: 'Natural Energy',
    handles: [
      'vital-vitality-capsules',
      'focus-clarity-ritual',
      'metabolic-wellness-formula',
    ],
  },
  {
    id: 'beauty',
    icon: '✨',
    label: 'Skin Radiance',
    handles: [
      'radiance-renewal-balm',
      'radiance-support-capsules',
      'gaias-rose-soap',
      'citrus-goddess-glow-soap',
    ],
  },
  {
    id: 'pain',
    icon: '🌿',
    label: 'Muscle Comfort',
    handles: [
      'soothe-restore-botanical-balm',
      'vital-connect-capsules',
      'vital-flow-capsules',
    ],
  },
  {
    id: 'immune',
    icon: '🛡️',
    label: 'Immune Support',
    handles: ['immune-at-ease-capsules', 'environmental-wellness-support'],
  },
  {
    id: 'digestive',
    icon: '🍃',
    label: 'Digestive Ease',
    handles: ['seasonal-gut-reset', 'gentle-flow-ritual', 'alchemy-tea-blend'],
  },
];

/** handle → "icon label" strings, for "who it's for" on product cards. */
export function goalLabelsForHandle(handle: string): string[] {
  return SHOP_GOALS.filter((g) => g.handles.includes(handle)).map(
    (g) => `${g.icon} ${g.label}`,
  );
}
