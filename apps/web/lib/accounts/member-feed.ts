/**
 * Member feed composition — Gaia profile build (owner spec
 * 2026-11-08).
 *
 * SERVER-ONLY. Two compositions, deliberately separate types:
 *
 * - OWNER view (`getOwnMemberFeedAsync`): the member's own garden —
 *   everything, including their private fields (their own data),
 *   the controls state, and the reminder status.
 *
 * - PUBLIC view (`getPublicMemberFeedAsync`): what the world sees.
 *   Its type has NO address, NO phone, and NO birthday field — the
 *   privacy rule is enforced by construction, not by template
 *   discipline. It returns null when the profile is missing, the
 *   account is deleted, or the feed toggle is private — the public
 *   page 404s on null, so a private feed refuses rendering outright.
 *   Progress photos join the public view ONLY when the member has
 *   separately chosen to share them (their own toggle, default
 *   private) — and never for a private feed.
 *
 * Favorites = the account's likes (catalog titles resolved at read).
 * Herbal allies = the union of the member's saved quiz results
 * (profile saves + linked leads, composed by lib/accounts/profile.ts)
 * — classic snapshot allies and advisor allies alike, deduped by
 * name. Empty collections render as honest empty states; nothing is
 * invented to fill them.
 */
import {
  loadAccountAsync,
  normalizeAccountEmail,
  type MemberSocialLinks,
  type ProgressCheckin,
} from './accounts';
import { composeQuizResults, getProfileViewAsync } from './profile';
import { readLeadsForEmailAsync } from '../leads/lead-store';
import { zodiacForBirthday, type ZodiacSign } from './zodiac';
import {
  progressReminderStatus,
  type ProgressReminderStatus,
} from './member-profile';
import type { ShippingAddress } from '../checkout/shipping-address';

export interface FeedFavorite {
  handle: string;
  title: string;
}

export interface FeedAlly {
  name: string;
  latin: string | null;
  note: string | null;
}

export interface StarChartView {
  sun_sign: ZodiacSign;
  /** Moon phase at birth — computed (synodic math), stored with the chart. */
  moon_phase: { name: string; illumination: number; age_days: number } | null;
  /** Present only when the member added them (owner view; the public view never carries them). */
  birth_time: string | null;
  birth_place: string | null;
  /** True when the auto-computed chart is stored on the profile. */
  chart_saved: boolean;
  /** Honest scope note: ascendant/houses/planets are PLANNED, not built. */
  full_chart: 'planned';
}

/** Allies across every saved result — deduped by lowercase name, first note wins. */
export function alliesFromResults(
  results: readonly { result: import('../quiz/quiz').QuizResultSnapshot }[],
): FeedAlly[] {
  const byName = new Map<string, FeedAlly>();
  for (const saved of results) {
    const snapshot = saved.result;
    for (const ally of snapshot.allies ?? []) {
      const key = ally.name.trim().toLowerCase();
      if (!key || byName.has(key)) continue;
      byName.set(key, { name: ally.name, latin: ally.latin ?? null, note: ally.note ?? null });
    }
    for (const ally of snapshot.advisor?.allies ?? []) {
      const key = ally.name.trim().toLowerCase();
      if (!key || byName.has(key)) continue;
      byName.set(key, {
        name: ally.name,
        latin: ally.latin ?? null,
        note: ally.benefit ?? ally.traditionalNote ?? null,
      });
    }
  }
  return [...byName.values()];
}

function starChartFor(
  birthday: string,
  birthTime: string | null,
  birthPlace: string | null,
  stored: import('./accounts').StoredStarChart | null,
): StarChartView | null {
  const sun = zodiacForBirthday(birthday);
  if (!sun) return null;
  return {
    sun_sign: sun,
    moon_phase: stored?.moon_phase ?? null,
    birth_time: birthTime,
    birth_place: birthPlace,
    chart_saved: stored !== null,
    full_chart: 'planned',
  };
}

/* ------------------------------------------------------------------ */
/* Owner view                                                          */
/* ------------------------------------------------------------------ */

export interface OwnMemberFeed {
  email: string;
  full_name: string;
  bio: string;
  photo_data_url: string;
  /** PRIVATE fields — owner view only, the member's own data. */
  birthday: string;
  phone: string | null;
  address: ShippingAddress | null;
  feed_visibility: 'public' | 'private';
  progress_photos_visibility: 'private' | 'shared';
  progress_reminders_opt_in: boolean;
  socials: MemberSocialLinks;
  favorites: FeedFavorite[];
  allies: FeedAlly[];
  star_chart: StarChartView | null;
  /** The member's own check-ins — visible to them regardless of sharing. */
  progress_checkins: ProgressCheckin[];
  reminder: ProgressReminderStatus;
  /** The public URL of this feed (meaningful while visibility is public). */
  public_path: string;
}

export function memberPublicPath(email: string): string {
  return `/members/${encodeURIComponent(email)}`;
}

export async function getOwnMemberFeedAsync(
  emailInput: unknown,
  now: Date = new Date(),
): Promise<OwnMemberFeed | null> {
  const email = normalizeAccountEmail(emailInput);
  if (!email) return null;
  const state = await loadAccountAsync(email);
  if (!state.exists || state.deleted || !state.member_profile) return null;
  const profile = await getProfileViewAsync(email);
  const leads = await readLeadsForEmailAsync(email);
  const results = composeQuizResults(state, leads);
  const member = state.member_profile;
  return {
    email,
    full_name: member.full_name,
    bio: member.bio,
    photo_data_url: member.photo_data_url,
    birthday: member.birthday,
    phone: member.phone,
    address: member.address,
    feed_visibility: member.feed_visibility,
    progress_photos_visibility: member.progress_photos_visibility,
    progress_reminders_opt_in: member.progress_reminders_opt_in,
    socials: member.socials,
    favorites: profile?.likes ?? [],
    allies: alliesFromResults(results),
    star_chart: starChartFor(member.birthday, member.birth_time, member.birth_place, state.star_chart),
    progress_checkins: state.progress_checkins,
    reminder: progressReminderStatus(state, now),
    public_path: memberPublicPath(email),
  };
}

/* ------------------------------------------------------------------ */
/* Public view — the privacy boundary                                  */
/* ------------------------------------------------------------------ */

/**
 * The public feed. NOTE what is NOT here: no address, no phone, no
 * birthday (the sun sign is computed server-side from month/day and
 * only the sign travels). Progress photos appear only when the member
 * separately shared them.
 */
export interface PublicMemberFeed {
  full_name: string;
  bio: string;
  photo_data_url: string;
  socials: MemberSocialLinks;
  favorites: FeedFavorite[];
  allies: FeedAlly[];
  star_chart: StarChartView | null;
  /** Non-empty ONLY when the member chose to share progress photos. */
  progress_checkins: ProgressCheckin[];
  progress_shared: boolean;
}

export async function getPublicMemberFeedAsync(
  emailInput: unknown,
): Promise<PublicMemberFeed | null> {
  const email = normalizeAccountEmail(emailInput);
  if (!email) return null;
  const state = await loadAccountAsync(email);
  if (!state.exists || state.deleted || !state.member_profile) return null;
  const member = state.member_profile;
  if (member.feed_visibility !== 'public') return null; // the toggle refuses rendering
  const profile = await getProfileViewAsync(email);
  const leads = await readLeadsForEmailAsync(email);
  const results = composeQuizResults(state, leads);
  const progressShared = member.progress_photos_visibility === 'shared';
  return {
    full_name: member.full_name,
    bio: member.bio,
    photo_data_url: member.photo_data_url,
    socials: member.socials,
    favorites: profile?.likes ?? [],
    allies: alliesFromResults(results),
    // Birth time/place are the member's chart seeds; the public chart
    // shows the sun sign, its qualities, and the moon phase — the
    // time/place themselves stay owner-side.
    star_chart: starChartFor(member.birthday, null, null, state.star_chart),
    progress_checkins: progressShared ? state.progress_checkins : [],
    progress_shared: progressShared,
  };
}
