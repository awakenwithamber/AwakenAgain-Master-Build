/**
 * Gaia nudge selection — pure logic (owner spec / copy pack 2026-10-25 §6).
 *
 * Gaia may offer ONE gentle, dismissible suggestion at a time — never a
 * modal, never blocking the page. This module decides WHICH nudge (if
 * any) and WHEN, as pure functions of (context, rotation state, now) so
 * the cadence is unit-testable without timers or a DOM. The React card
 * (components/chat/GaiaNudge.tsx) owns the clock and the rendering.
 *
 * Cadence (Amber's spec, copy pack §6):
 *   - first nudge no sooner than 60s after page load
 *   - at most ONE nudge every 7 minutes
 *   - max 3 nudges per session
 *   - dismissing a nudge snoozes the next for 7 minutes
 *   - never while the Gaia chat or the contact popup is open (enforced
 *     by the component via the overlay events; this module is pure)
 *
 * Signal sources — FIRST-PARTY ONLY. There is no ad-platform data
 * on-site and none is invented: selection uses the current page, the
 * consent-gated interest profile (lib/personalization/interests.ts —
 * callers pass a profile ONLY when consent was accepted; a null profile
 * means "no profiling", and selection falls back to page context), and
 * the first-touch utm_source/utm_campaign captured from the landing URL.
 */
import { getProductByHandle } from '../catalog/products';
import { topInterest, type InterestProfile } from './interests';
import { INVITE_COPY } from './invites';

export const GAIA_NUDGE_FIRST_DELAY_MS = 60_000;
export const GAIA_NUDGE_INTERVAL_MS = 7 * 60_000;
export const GAIA_NUDGE_MAX_PER_SESSION = 3;

export type GaiaNudgeKind =
  | 'quiz'
  | 'tea'
  | 'product'
  | 'subscription'
  | 'profile';

export interface GaiaNudge {
  kind: GaiaNudgeKind;
  /** Verbatim copy-pack §6 template text ({product} already resolved). */
  text: string;
  ctaLabel: string;
  /** Primary destination; null when the primary action opens contact. */
  href: string | null;
  /** Catalog handle when kind === 'product'. */
  productHandle?: string;
  /** Offer the "Message Amber" action alongside the primary CTA. */
  offerContact: boolean;
}

export interface GaiaNudgeContext {
  pathname: string;
  /** Consent-gated interest profile; null = no profiling signal. */
  profile: InterestProfile | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
}

export interface GaiaNudgeRotation {
  /** Session start (ms epoch) — the 60s first-delay is measured from here. */
  sessionStartedAt: number;
  shownCount: number;
  shownKinds: readonly GaiaNudgeKind[];
  lastShownAt: number | null;
  dismissedAt: number | null;
}

export function initialGaiaNudgeRotation(now: number): GaiaNudgeRotation {
  return {
    sessionStartedAt: now,
    shownCount: 0,
    shownKinds: [],
    lastShownAt: null,
    dismissedAt: null,
  };
}

/** True when the cadence allows a nudge at `now`. */
export function gaiaNudgeDue(state: GaiaNudgeRotation, now: number): boolean {
  if (state.shownCount >= GAIA_NUDGE_MAX_PER_SESSION) return false;
  if (now - state.sessionStartedAt < GAIA_NUDGE_FIRST_DELAY_MS) return false;
  if (state.lastShownAt !== null && now - state.lastShownAt < GAIA_NUDGE_INTERVAL_MS) {
    return false;
  }
  if (state.dismissedAt !== null && now - state.dismissedAt < GAIA_NUDGE_INTERVAL_MS) {
    return false;
  }
  return true;
}

export function recordGaiaNudgeShown(
  state: GaiaNudgeRotation,
  kind: GaiaNudgeKind,
  now: number,
): GaiaNudgeRotation {
  return {
    ...state,
    shownCount: state.shownCount + 1,
    shownKinds: [...state.shownKinds, kind],
    lastShownAt: now,
  };
}

export function recordGaiaNudgeDismissed(
  state: GaiaNudgeRotation,
  now: number,
): GaiaNudgeRotation {
  return { ...state, dismissedAt: now };
}

/* ------------------------------------------------------------------ */
/* Templates — copy pack §6, verbatim                                   */
/* ------------------------------------------------------------------ */

const QUIZ_NUDGE: GaiaNudge = {
  kind: 'quiz',
  text: "Psst — feeling a little lost in the garden? 🌿 The Herbal Allies Quiz takes two minutes and introduces you to the plants picked for you. Want to try it?",
  ctaLabel: 'Take the Herbal Allies Quiz',
  href: '/quiz',
  offerContact: false,
};

const TEA_NUDGE: GaiaNudge = {
  kind: 'tea',
  text: "Most newcomers start with tea — it's the form you already know. Want to blend your first cup with me?",
  ctaLabel: 'Build your tea',
  href: '/custom-formula/tea',
  offerContact: false,
};

const SUBSCRIPTION_NUDGE: GaiaNudge = {
  kind: 'subscription',
  text: 'The Living Grimoire opens a new page of plant wisdom every month for $7.77 — and members save 10% across the shop. Want a peek inside?',
  ctaLabel: 'Peek inside the Living Grimoire',
  href: '/grimoire',
  offerContact: false,
};

/**
 * Profile nudge destination = the same one ProfileInvite uses for its
 * profile moment (INVITE_COPY['quiz-results'] → /account), so the two
 * profile prompts can never drift apart.
 */
const PROFILE_NUDGE: GaiaNudge = {
  kind: 'profile',
  text: "Want me to remember your allies and picks between visits? Create a free profile and I'll keep your garden gate open for you.",
  ctaLabel: INVITE_COPY['quiz-results'].ctaLabel,
  href: INVITE_COPY['quiz-results'].ctaHref,
  offerContact: false,
};

/**
 * Interest category → catalog product for the product nudge. Handles
 * are verified against the live catalog in the unit tests (a renamed or
 * removed product makes the nudge silently unavailable, never a 404).
 */
const PRODUCT_BY_INTEREST: Partial<Record<string, string>> = {
  herbs: 'alchemy-tea-blend',
  soaps: 'gaias-rose-soap',
  readings: 'tarot-readings',
  articles: 'alchemy-tea-blend',
  quiz: 'alchemy-tea-blend',
};

function productNudge(profile: InterestProfile | null): GaiaNudge | null {
  if (!profile) return null;
  const top = topInterest(profile);
  if (!top) return null;
  const handle = PRODUCT_BY_INTEREST[top];
  if (!handle) return null;
  const product = getProductByHandle(handle);
  if (!product) return null;
  return {
    kind: 'product',
    text: `You've been browsing the apothecary shelves — this one keeps catching visitors' eyes: ${product.title}. Want a look?`,
    ctaLabel: 'Take a look',
    href: `/shop/${product.handle}`,
    productHandle: product.handle,
    offerContact: false,
  };
}

/**
 * The next nudge to show, or null when the cadence forbids one, every
 * template has already run this session, or nothing fits the context.
 *
 * Selection order (first match not yet shown wins):
 *   1. quiz — on the form guide / builder pages (visitors choosing a
 *      form are the ones most likely to be lost), or when a campaign
 *      utm mentions the quiz.
 *   2. product — when a clear top interest exists (consent-gated).
 *   3. tea — on shop / product / herb pages (browsing, not yet building).
 *   4. subscription — when the top interest is the Grimoire, or anywhere
 *      late in the rotation.
 *   5. profile — the gentle fallback.
 */
export function nextGaiaNudge(
  context: GaiaNudgeContext,
  state: GaiaNudgeRotation,
  now: number,
): GaiaNudge | null {
  if (!gaiaNudgeDue(state, now)) return null;
  const shown = new Set(state.shownKinds);
  const path = context.pathname || '/';

  const candidates: (GaiaNudge | null)[] = [];

  const onFormPages =
    path === '/custom-formula' || path.startsWith('/custom-formula/');
  const campaign = (context.utmCampaign ?? '').toLowerCase();
  if (onFormPages || campaign.includes('quiz')) candidates.push(QUIZ_NUDGE);

  candidates.push(productNudge(context.profile));

  const browsing =
    path === '/shop' || path.startsWith('/shop/') ||
    path === '/herbal-library' || path.startsWith('/herbal-library/') ||
    path === '/herb-index';
  if (browsing) candidates.push(TEA_NUDGE);

  const top = context.profile ? topInterest(context.profile) : null;
  if (top === 'grimoire' || state.shownCount >= 1) {
    candidates.push(SUBSCRIPTION_NUDGE);
  }

  candidates.push(PROFILE_NUDGE);
  if (!onFormPages) candidates.push(QUIZ_NUDGE);
  candidates.push(TEA_NUDGE);

  for (const candidate of candidates) {
    if (candidate && !shown.has(candidate.kind)) return candidate;
  }
  return null;
}
