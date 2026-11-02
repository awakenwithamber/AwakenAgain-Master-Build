/**
 * Gaia beginner guide — short questionnaire + page-aware routing
 * (combined build 2026-11-02; owner wording + direction on file).
 *
 * Amber's exact beginner-popup wording — do not paraphrase:
 * "If you do not know where to begin, chat with Gaia! Answer a short
 * questionnaire and she will lead you to the section that will help
 * you the most."
 *
 * This module is PURE (no JSX, no browser access) so the routing can
 * be unit-tested directly. It recommends a SECTION of the site; it
 * never recommends a product as a remedy or treatment, and it does
 * not gate or limit chat messages in any way (the 11-free-messages
 * gate is a separate, later owner decision — NOT built here).
 */

export const GAIA_BEGINNER_WORDING =
  'If you do not know where to begin, chat with Gaia! Answer a short questionnaire and she will lead you to the section that will help you the most.';

export type GaiaGoal = 'product' | 'learn' | 'grimoire' | 'custom' | 'browse';
export type GaiaInterest = 'sleep' | 'calm' | 'skin' | 'soap' | 'energy';

export interface GaiaGuideOption<T extends string> {
  value: T;
  label: string;
}

export const GAIA_GOAL_QUESTION = 'What brings you to the apothecary today?';
export const GAIA_GOAL_OPTIONS: readonly GaiaGuideOption<GaiaGoal>[] = [
  { value: 'product', label: 'Find something made for me' },
  { value: 'learn', label: 'Learn about herbs and botanicals' },
  { value: 'grimoire', label: 'Explore the Living Grimoire' },
  { value: 'custom', label: 'Create something custom' },
  { value: 'browse', label: 'Just looking around' },
];

export const GAIA_INTEREST_QUESTION = 'Which of these is closest to what you need?';
export const GAIA_INTEREST_OPTIONS: readonly GaiaGuideOption<GaiaInterest>[] = [
  { value: 'sleep', label: 'Rest and sleep' },
  { value: 'calm', label: 'Calm and balance' },
  { value: 'skin', label: 'Skin and glow' },
  { value: 'soap', label: 'Soaps and scents' },
  { value: 'energy', label: 'Energy and focus' },
];

/** Goals that ask the follow-up interest question. */
export function goalNeedsInterest(goal: GaiaGoal): boolean {
  return goal === 'product' || goal === 'custom';
}

export interface GaiaRecommendation {
  href: string;
  label: string;
  blurb: string;
}

const INTEREST_BLURB: Record<GaiaInterest, string> = {
  sleep: 'for rest and sleep',
  calm: 'for calm and balance',
  skin: 'for skin and glow',
  soap: 'for soaps and scents',
  energy: 'for energy and focus',
};

/**
 * The section Gaia leads the visitor to, from their answers and the
 * page they are standing on (page-aware guidance):
 * - Learning goals always land on the Herb Encyclopedia.
 * - Grimoire goals land on the Grimoire — or, when the visitor is
 *   already inside it, on the subscribe page that opens the rest.
 * - Custom goals land on the custom builders (soap interest goes to
 *   the Soap Builder).
 * - Product goals land on the quiz, which leads to a personalized
 *   formula — except a soap interest, which lands on the Soap Shop.
 * - Browsing is page-aware: from a product page the quiz is the
 *   helpful next step; from the Herb Encyclopedia, the shop; from
 *   the Grimoire, its subscribe page; anywhere else, the shop.
 */
export function gaiaRecommendation(
  goal: GaiaGoal,
  interest: GaiaInterest | null,
  pathname: string,
): GaiaRecommendation {
  const path = pathname || '/';
  switch (goal) {
    case 'learn':
      return {
        href: '/herb-index',
        label: 'Herb Encyclopedia',
        blurb:
          'Start with the Herb Encyclopedia — every botanical in the apothecary, explained plainly.',
      };
    case 'grimoire':
      return path.startsWith('/grimoire')
        ? {
            href: '/grimoire/subscribe',
            label: 'Living Grimoire membership',
            blurb:
              'You are already at the Grimoire — the membership page shows how the full book opens.',
          }
        : {
            href: '/grimoire',
            label: 'The Living Grimoire',
            blurb:
              'The Living Grimoire is Amber’s family book of botanical knowledge — the first pages are free to read.',
          };
    case 'custom':
      return interest === 'soap'
        ? {
            href: '/soap-builder',
            label: 'Soap Builder',
            blurb:
              'Build your own bar in the Soap Builder — pick your shape, scent, and botanicals.',
          }
        : {
            href: '/custom-formula',
            label: 'Customized products',
            blurb:
              'The customized products page walks you through teas, balms, serums, and capsules made to order.',
          };
    case 'product':
      if (interest === 'soap') {
        return {
          href: '/soap-shop',
          label: 'Soap Shop',
          blurb:
            'Handmade bars live in the Soap Shop — start with the scents that sound like you.',
        };
      }
      return {
        href: '/quiz',
        label: 'Take the short quiz',
        blurb: interest
          ? `The quiz asks a few questions and leads you to a personalized formula ${INTEREST_BLURB[interest]}.`
          : 'The quiz asks a few questions and leads you to a personalized formula.',
      };
    case 'browse':
    default:
      if (path.startsWith('/shop/') || path.startsWith('/soap-shop')) {
        return {
          href: '/quiz',
          label: 'Take the short quiz',
          blurb:
            'Since you are already looking at products, the quiz is the fastest way to a personalized formula.',
        };
      }
      if (path.startsWith('/herb-index') || path.startsWith('/herbal-wisdom')) {
        return {
          href: '/shop',
          label: 'Browse the shop',
          blurb:
            'You have met the botanicals — now see what Amber makes with them in the shop.',
        };
      }
      if (path.startsWith('/grimoire')) {
        return {
          href: '/grimoire/subscribe',
          label: 'Living Grimoire membership',
          blurb:
            'The membership page shows how the full Living Grimoire opens, beyond the free pages.',
        };
      }
      return {
        href: '/shop',
        label: 'Browse the shop',
        blurb: 'Start in the shop — Best Sellers are right on the home page, too.',
      };
  }
}
