/**
 * Partnerships — the ways to contribute, for /partner.
 *
 * Owner order 2026-10-15 (audit fix #8): people with an idea, a skill,
 * a product, funding, or land should be able to raise a hand. Each way
 * below is a plain factual description of the contribution — nothing
 * here offers terms, acceptance, a response time, or a return of any
 * kind. Every submission is read by the owner personally.
 */

export interface ContributionType {
  /** Stable id — stored on partner-idea leads and analytics. */
  id: string;
  label: string;
  blurb: string;
}

export const CONTRIBUTION_TYPES: ContributionType[] = [
  {
    id: 'idea',
    label: 'Bring an idea',
    blurb:
      'You have a concept that belongs somewhere in the AWAKEN series — a product, a program, a collaboration. Describe it in the form below; Amber reads every submission herself.',
  },
  {
    id: 'skills',
    label: 'Offer skills or services',
    blurb:
      'Design, writing, herbalism, development, operations, photography — tell us what you do well and where you would like to plug in.',
  },
  {
    id: 'supply',
    label: 'Supply products or materials',
    blurb:
      'You make or source something the apothecary or a sister project could use — botanicals, packaging, materials. Share what you offer.',
  },
  {
    id: 'invest',
    label: 'Invest or fund',
    blurb:
      'You would like to hear about funding part of the AWAKEN series as it grows. Register your interest and Amber will follow up personally. This page offers no investment, security, or return of any kind.',
  },
  {
    id: 'community-land',
    label: 'Community & land collaboration',
    blurb:
      'You have land, a venue, or a community that could host or grow an AWAKEN project — Eco-Villages and beyond. Describe the place and the possibility.',
  },
  {
    id: 'other',
    label: 'Something else',
    blurb:
      "Your way of contributing doesn't fit the boxes above. That's often where the best ideas start — tell us anyway.",
  },
];

export const CONTRIBUTION_TYPE_IDS: readonly string[] = CONTRIBUTION_TYPES.map(
  (t) => t.id,
);

export function isValidContributionType(value: unknown): value is string {
  return typeof value === 'string' && CONTRIBUTION_TYPE_IDS.includes(value);
}

export function getContributionType(id: string): ContributionType | undefined {
  return CONTRIBUTION_TYPES.find((t) => t.id === id);
}
