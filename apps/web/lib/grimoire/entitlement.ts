/**
 * Grimoire entitlement resolution — THE ONE check the book uses
 * (Stage 2). Folds the three independent entitlement sources:
 *
 *   SUBSCRIPTION_ACTIVE — lib/subscriptions/entitlement.ts semantics
 *     (latest subscription record for the email is 'active',
 *     fail-closed), unchanged.
 *   PERMANENT_UNLOCK — lib/grimoire/unlock.ts (latest unlock record
 *     is 'active', not revoked). Independent of the subscription
 *     ledger: permanent rights survive subscription cancellation,
 *     and subscribing never removes them.
 *   KEEPER — server env config GRIMOIRE_KEEPER_EMAILS
 *     (comma-separated, server-only, default empty). Owner decision
 *     §13(5) Keeper expiry is still OPEN (2026-10-21): Keeper is
 *     built WITHOUT expiry, structured so an expiry can be added to
 *     this module later. A keeper must still authenticate via the OTP
 *     session — an email on the list alone grants nothing; this
 *     module is only ever consulted with the email of a VERIFIED
 *     session (see app/api/grimoire-otp/route.ts + app/grimoire).
 *
 * FREE_PREVIEW is the first 16 composed pages of the site book
 * (front matter pp. 1–7, one sample page from each of the five
 * publishable collected works pp. 8–12, the framing in full
 * pp. 13–14, the about page p. 15, and the concern index p. 16 —
 * owner directive 2026-10-21, the assembly manifest's Option B;
 * composition after the 2026-11-08 removal of the four
 * copyright-conflicted editions); pages 17+ require one of the
 * sources above.
 *
 * SERVER-ONLY: reads server env + the ledgers. Never import from a
 * client component — GRIMOIRE_KEEPER_EMAILS values must never reach
 * the client bundle (a test asserts this import boundary).
 */
import {
  isEntitledSubscriberAsync,
  normalizeSubscriptionEmail,
} from '../subscriptions/entitlement';
import { isUnlockEntitled } from './unlock';

import { composedPageCount, getEditionManifest } from './manifest';

/** Composed book page count — derived from the manifest model
 *  (1,051 after the 2026-11-08 removal of the four
 *  copyright-conflicted editions: real family edition + the five
 *  retained collected works; the held Elverum contributes
 *  nothing). */
export const GRIMOIRE_TOTAL_PAGES = composedPageCount(getEditionManifest());
/** Last free-preview page number (composed pages 1–16 are free). */
export const FREE_PREVIEW_LAST_PAGE = 16;

/** Keeper emails from server env (normalized; empty when unset). */
export function keeperEmails(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const raw = env.GRIMOIRE_KEEPER_EMAILS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((e) => normalizeSubscriptionEmail(e))
    .filter((e) => e.length > 0);
}

export function isKeeperEmail(
  email: unknown,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const target = normalizeSubscriptionEmail(email);
  if (!target) return false;
  return keeperEmails(env).includes(target);
}

export interface GrimoireEntitlement {
  /** Normalized session email, or null for an anonymous viewer. */
  email: string | null;
  /** True when any source entitles the viewer to the full book. */
  entitled: boolean;
  is_subscriber: boolean;
  has_permanent_unlock: boolean;
  is_keeper: boolean;
  /** 1-based page numbers this viewer may read in full. */
  entitled_pages: number[];
}

function allPages(): number[] {
  return Array.from({ length: GRIMOIRE_TOTAL_PAGES }, (_, i) => i + 1);
}

function previewPages(): number[] {
  return Array.from({ length: FREE_PREVIEW_LAST_PAGE }, (_, i) => i + 1);
}

/**
 * Resolve the full entitlement for a VERIFIED session email (or null
 * for anonymous). Fail-closed: any source that cannot be read counts
 * as not entitled, exactly like the subscription check.
 */
export async function resolveGrimoireEntitlement(
  emailInput: unknown,
): Promise<GrimoireEntitlement> {
  const email = normalizeSubscriptionEmail(emailInput) || null;
  if (!email) {
    return {
      email: null,
      entitled: false,
      is_subscriber: false,
      has_permanent_unlock: false,
      is_keeper: false,
      entitled_pages: previewPages(),
    };
  }
  const [is_subscriber, has_permanent_unlock] = await Promise.all([
    isEntitledSubscriberAsync(email).catch(() => false),
    isUnlockEntitled(email).catch(() => false),
  ]);
  const is_keeper = isKeeperEmail(email);
  const entitled = is_subscriber || has_permanent_unlock || is_keeper;
  return {
    email,
    entitled,
    is_subscriber,
    has_permanent_unlock,
    is_keeper,
    entitled_pages: entitled ? allPages() : previewPages(),
  };
}

/** Boolean form bound as the OTP route's entitlement check. */
export async function isGrimoireEntitled(email: unknown): Promise<boolean> {
  return (await resolveGrimoireEntitlement(email)).entitled;
}
