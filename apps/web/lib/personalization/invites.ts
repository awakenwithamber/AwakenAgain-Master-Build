/**
 * Profile-invite visibility rules (owner spec 2026-10-14). Invites are
 * gentle one-line prompts at save-moments — never popups, never on a
 * first visit, at most once per moment per visitor, dismissible forever.
 *
 * Pure + storage-injectable for unit tests. "First visit" tracking: the
 * first time any invite logic runs for a brand-new visitor we stamp
 * FIRST_SEEN_KEY in local storage; a session flag in session storage
 * tells us whether THIS browser session is that first one. Invites only
 * appear from the second session onward.
 *
 * The invites point only at flows that exist today (the newsletter,
 * the Living Grimoire email sign-in, and — since Phase 3 Step 3 —
 * account profiles at /account). Nothing here creates or pretends to
 * create an account; it invites, the flows themselves do the work.
 */
import type { StorageLike } from './consent';

export const INVITE_MOMENTS = [
  'soap-builder',
  'quiz-results',
  'cart',
  'order-success',
] as const;

export type InviteMoment = (typeof INVITE_MOMENTS)[number];

export const FIRST_SEEN_KEY = 'aa_first_seen_v1';
export const SESSION_KEY = 'aa_session_v1';
export const INVITES_SEEN_KEY = 'aa_invites_seen_v1';

/**
 * Begin (or recognize) a browser session. Returns true when this session
 * is the visitor's FIRST-EVER session — invites stay hidden then.
 * Call once per page load from the invite component.
 */
export function beginSession(input: {
  local: StorageLike;
  session: StorageLike;
  now: number;
}): { isFirstVisit: boolean } {
  let sessionActive = false;
  try {
    sessionActive = input.session.getItem(SESSION_KEY) === '1';
  } catch {
    sessionActive = false;
  }
  if (sessionActive) return { isFirstVisit: false };

  let firstSeen: string | null = null;
  try {
    firstSeen = input.local.getItem(FIRST_SEEN_KEY);
  } catch {
    firstSeen = null;
  }
  const isFirstVisit = firstSeen === null;
  try {
    input.session.setItem(SESSION_KEY, '1');
    if (isFirstVisit) {
      input.local.setItem(FIRST_SEEN_KEY, String(input.now));
    }
  } catch {
    /* storage unavailable — treat as first visit (invites stay hidden) */
    return { isFirstVisit: true };
  }
  return { isFirstVisit };
}

function readSeenMap(local: StorageLike): Partial<Record<InviteMoment, number>> {
  try {
    const raw = local.getItem(INVITES_SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const seen: Partial<Record<InviteMoment, number>> = {};
    for (const moment of INVITE_MOMENTS) {
      const value = parsed[moment];
      if (typeof value === 'number') seen[moment] = value;
    }
    return seen;
  } catch {
    return {};
  }
}

/** An invite may show only for returning visitors who haven't seen/dismissed it. */
export function shouldShowInvite(input: {
  local: StorageLike;
  moment: InviteMoment;
  isFirstVisit: boolean;
}): boolean {
  if (input.isFirstVisit) return false;
  return readSeenMap(input.local)[input.moment] === undefined;
}

/** Record that a moment's invite was shown or dismissed — it never returns. */
export function markInviteSeen(
  local: StorageLike,
  moment: InviteMoment,
  now: number,
): void {
  try {
    const seen = readSeenMap(local);
    seen[moment] = now;
    local.setItem(INVITES_SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* ignore — worst case the invite shows once more */
  }
}

/** One-line benefit copy + the honest, working action for each moment. */
export const INVITE_COPY: Record<
  InviteMoment,
  { line: string; ctaLabel: string; ctaHref: string }
> = {
  'soap-builder': {
    line: 'Love your blend? The apothecary newsletter brings first looks at new scents and seasonal bars.',
    ctaLabel: 'Join the newsletter',
    ctaHref: '#newsletter-signup',
  },
  'quiz-results': {
    line: 'Keep your allies close — a free profile saves your results, likes, and searches across visits.',
    ctaLabel: 'Create your profile',
    ctaHref: '/account',
  },
  cart: {
    line: 'Living Grimoire of Light & Magic members save 10% and ship free — sign in with just your email, no password to remember.',
    ctaLabel: 'Sign in to the Living Grimoire of Light & Magic',
    ctaHref: '/grimoire',
  },
  'order-success': {
    line: 'Living Grimoire of Light & Magic members save 10% on every order — sign in with just your email, no password needed.',
    ctaLabel: 'Sign in to the Living Grimoire of Light & Magic',
    ctaHref: '/grimoire',
  },
};
