/**
 * The Awaken Network — the AWAKEN project series, for /network.
 *
 * Owner order 2026-10-15 (audit fix #8): the apothecary site carries a
 * pane for the wider series so visitors can discover the sister
 * projects and register interest in getting involved.
 *
 * HONESTY RULES for this module:
 * - One-liners state ONLY owner-documented facts about each project.
 *   No launch dates, no prices, no feature promises beyond the line.
 * - Status is a plain fact: only the apothecary is live today; the
 *   rest are in development / in formation and are labelled so.
 * - HARD EXCLUSION (standing owner directive): one further project —
 *   the mining venture — is barred from this site entirely and is
 *   deliberately absent here, unnamed. A source-scan guard test
 *   asserts its name occurs nowhere in the app source.
 */

export type NetworkProjectStatus = 'live' | 'in-development' | 'in-formation';

export interface NetworkProject {
  /** Stable slug — stored on affiliate-interest leads and analytics. */
  slug: string;
  name: string;
  oneLiner: string;
  status: NetworkProjectStatus;
  /** Visitor-facing status line. */
  statusLabel: string;
  /** Internal destination, when the project lives on this site. */
  href?: string;
}

export const NETWORK_PROJECTS: NetworkProject[] = [
  {
    slug: 'ambers-alchemy-apothecary',
    name: "Amber's Alchemy Apothecary",
    oneLiner:
      'Botanical products, herbal education, and the Living Grimoire — the apothecary you are standing in.',
    status: 'live',
    statusLabel: 'Live — you are here',
    href: '/',
  },
  {
    slug: 'awaken-network',
    name: 'The Awaken Network',
    oneLiner: 'A purpose-built community platform.',
    status: 'in-development',
    statusLabel: 'In development',
  },
  {
    slug: 'awaken-mobile',
    name: 'Awaken Mobile',
    oneLiner:
      'A consumer mobile service, offered under Awaken With Amber LLC.',
    status: 'in-formation',
    statusLabel: 'In formation',
  },
  {
    slug: 'farah-growth-studio',
    name: 'Farah Growth Studio',
    oneLiner: 'A multi-agent growth and operations studio.',
    status: 'in-development',
    statusLabel: 'In development',
  },
  {
    slug: 'awaken-agents',
    name: 'AWAKEN Agents',
    oneLiner: 'AI agents that research, build, test, and monitor.',
    status: 'in-development',
    statusLabel: 'In development',
  },
  {
    slug: 'awaken-eco-villages',
    name: 'Awaken Eco-Villages',
    oneLiner:
      'Replicable resilient community models — sustainable housing, energy, water, and food.',
    status: 'in-development',
    statusLabel: 'In development',
  },
  {
    slug: 'brandalchemy',
    name: 'BrandAlchemy',
    oneLiner:
      'A brand-recognition platform for businesses: logo studio, branded products, and an AI brand advisor.',
    status: 'in-development',
    statusLabel: 'In development',
  },
];

export const NETWORK_PROJECT_SLUGS: readonly string[] = NETWORK_PROJECTS.map(
  (p) => p.slug,
);

export function isValidProjectSlug(value: unknown): value is string {
  return typeof value === 'string' && NETWORK_PROJECT_SLUGS.includes(value);
}

export function getNetworkProject(slug: string): NetworkProject | undefined {
  return NETWORK_PROJECTS.find((p) => p.slug === slug);
}
