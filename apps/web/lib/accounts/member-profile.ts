/**
 * Member profile — validation, gates, and reminder math (Gaia profile
 * build, owner spec 2026-11-08).
 *
 * SERVER-ONLY (the save path appends account events). The pure
 * validators here are the server authority for every member-profile
 * write: the Gaia flow's client checks are a preview only.
 *
 * Owner's hard rules implemented in this module:
 * - Required: full name, birthday, brief bio, profile photo.
 *   Optional: phone, address, birth time, birth place.
 * - AGE GATE 13+: profile creation refuses a birthday under 13.
 * - AGE GATE 18+: before/after progress photos refuse under 18 —
 *   computed from the SAVED birthday, never a client-supplied value.
 * - Every uploaded photo is EXIF/GPS-stripped server-side BEFORE
 *   storage (lib/media/exif-strip.ts); an upload that cannot be proven
 *   clean is rejected, never stored raw.
 * - Reminder emails are OPT-IN; the state that drives them (last
 *   check-in, last reminder) lives in the account store, server-side.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  addProgressCheckinAsync,
  loadAccountAsync,
  normalizeAccountEmail,
  recordProfileWelcomeSentAsync,
  recordProgressReminderSentAsync,
  recordStarChartComputedAsync,
  setMemberProfileAsync,
  type AccountState,
  type MemberProfileData,
  type MemberSocialLinks,
  type ProgressCheckin,
} from './accounts';
import { computeStarChart, starChartStale } from './star-chart';
import { accountSessionSecret } from './session';
import { validatePhoneNumber } from './phone';
import { ageOn, parseBirthday, zodiacForBirthday } from './zodiac';
import {
  validateShippingAddress,
  type ShippingAddress,
} from '../checkout/shipping-address';
import { sanitizePlainText } from '../security/validation';
import { cleanImageDataUrl } from '../media/exif-strip';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const MIN_PROFILE_AGE = 13;
export const MIN_PROGRESS_AGE = 18;
/** Check-ins come every other week (owner spec, Phase B). */
export const CHECKIN_INTERVAL_DAYS = 14;
/** Decoded photo cap — photos live in the account event store. */
export const MAX_PHOTO_BYTES = 400 * 1024;
export const MAX_BIO_LENGTH = 500;
export const MAX_CHECKINS = 104; // two years of fortnightly check-ins

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export interface MemberProfileInput {
  full_name?: unknown;
  birthday?: unknown;
  bio?: unknown;
  photo_data_url?: unknown;
  phone_country?: unknown;
  phone_number?: unknown;
  address?: unknown;
  birth_time?: unknown;
  birth_place?: unknown;
  feed_visibility?: unknown;
  progress_photos_visibility?: unknown;
  progress_reminders_opt_in?: unknown;
  socials?: unknown;
}

export type MemberProfileValidation =
  | { ok: true; profile: MemberProfileData }
  | { ok: false; errors: string[] };

function cleanSocialUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, 200);
  if (!trimmed) return undefined;
  // A handle (@name / name) or a full profile URL — stored verbatim as
  // the member typed it (display layer turns handles into links).
  if (/^(https?:\/\/)?[\w.@/-]+$/.test(trimmed) && !/\s/.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

export function cleanSocials(input: unknown): MemberSocialLinks {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {};
  }
  const source = input as Record<string, unknown>;
  const socials: MemberSocialLinks = {};
  const facebook = cleanSocialUrl(source.facebook);
  const tiktok = cleanSocialUrl(source.tiktok);
  const instagram = cleanSocialUrl(source.instagram);
  if (facebook) socials.facebook = facebook;
  if (tiktok) socials.tiktok = tiktok;
  if (instagram) socials.instagram = instagram;
  return socials;
}

/**
 * Validate a member-profile submission into a storable snapshot.
 * `existing` lets an edit keep a previously stored photo when the
 * submission carries none. `now` is injectable for gate tests.
 */
export function validateMemberProfile(
  input: MemberProfileInput,
  existing: MemberProfileData | null,
  now: Date = new Date(),
): MemberProfileValidation {
  const errors: string[] = [];

  const full_name = sanitizePlainText(input.full_name, 120);
  if (full_name.length < 2) {
    errors.push('Please share your full name — two characters or more.');
  }

  const birthdayRaw = typeof input.birthday === 'string' ? input.birthday.trim() : '';
  const birthdayParts = parseBirthday(birthdayRaw);
  if (!birthdayParts) {
    errors.push('Please enter your birthday as YYYY-MM-DD — we need it for your star chart and to confirm you are 13 or older.');
  }
  let birthday = '';
  if (birthdayParts) {
    birthday = birthdayRaw;
    const age = ageOn(birthday, now);
    if (age === null || age < MIN_PROFILE_AGE) {
      errors.push('Profiles are for members 13 and older. If your birthday is right, this garden opens to you at 13 — come back then.');
    }
    if (age !== null && age > 120) {
      errors.push('That birthday would make you over 120 — please check it and try again.');
    }
  }

  const bio = sanitizePlainText(input.bio, MAX_BIO_LENGTH);
  if (bio.length < 1) {
    errors.push('Please add a brief bio — a line or two about you.');
  }

  // Photo: a fresh upload is EXIF-stripped here, before anything is
  // stored. An edit with no new photo keeps the stored (already
  // stripped) one.
  let photo_data_url = '';
  if (typeof input.photo_data_url === 'string' && input.photo_data_url.trim()) {
    const cleaned = cleanImageDataUrl(input.photo_data_url, MAX_PHOTO_BYTES);
    if (!cleaned) {
      errors.push('That photo could not be accepted — please use a JPG, PNG, or WebP image under 400 KB. (We remove location data from every photo before it is stored; a photo we cannot clean is never stored.)');
    } else {
      photo_data_url = cleaned.dataUrl;
    }
  } else if (existing) {
    photo_data_url = existing.photo_data_url;
  } else {
    errors.push('Please add a profile photo — a picture of you for your garden gate.');
  }

  // Optional: phone (only validated when something was typed).
  let phone: string | null = null;
  const phoneNumber = typeof input.phone_number === 'string' ? input.phone_number.trim() : '';
  if (phoneNumber) {
    const validated = validatePhoneNumber(input.phone_country ?? 'US', phoneNumber);
    if (!validated.ok || !validated.normalized) {
      errors.push(validated.error ?? 'Please check your phone number.');
    } else {
      phone = validated.normalized;
    }
  }

  // Optional: address (validated only when a field carries content).
  let address: ShippingAddress | null = null;
  if (input.address !== undefined && input.address !== null) {
    const raw = input.address as Record<string, unknown>;
    const hasContent =
      typeof raw === 'object' &&
      ['name', 'street', 'city', 'state', 'postal_code'].some(
        (key) => typeof raw[key] === 'string' && (raw[key] as string).trim(),
      );
    if (hasContent) {
      const validated = validateShippingAddress(input.address);
      if (!validated.ok) {
        errors.push(...validated.errors.map((e) => `Address: ${e}`));
      } else {
        address = validated.address;
      }
    }
  }

  // Optional: birth time (HH:MM 24h) + birth place (free text).
  let birth_time: string | null = null;
  if (typeof input.birth_time === 'string' && input.birth_time.trim()) {
    const value = input.birth_time.trim();
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      birth_time = value;
    } else {
      errors.push('Birth time should be in 24-hour HH:MM form (for example 07:30) — or leave it blank.');
    }
  }
  const birth_place = sanitizePlainText(input.birth_place, 120) || null;

  const feed_visibility = input.feed_visibility === 'private' ? 'private' : 'public';
  const progress_photos_visibility =
    input.progress_photos_visibility === 'shared' ? 'shared' : 'private';
  const progress_reminders_opt_in = input.progress_reminders_opt_in === true;

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    profile: {
      full_name,
      birthday,
      bio,
      photo_data_url,
      phone,
      address,
      birth_time,
      birth_place,
      feed_visibility,
      progress_photos_visibility,
      progress_reminders_opt_in,
      socials: cleanSocials(input.socials),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Age gates                                                           */
/* ------------------------------------------------------------------ */

/** 18+ gate for before/after photos — from the SAVED birthday only. */
export function progressPhotosAllowed(
  state: AccountState,
  now: Date = new Date(),
): boolean {
  if (!state.member_profile) return false;
  const age = ageOn(state.member_profile.birthday, now);
  return age !== null && age >= MIN_PROGRESS_AGE;
}

/* ------------------------------------------------------------------ */
/* Reminder math (Phase B)                                             */
/* ------------------------------------------------------------------ */

export interface ProgressReminderStatus {
  /** A member profile exists at all. */
  has_profile: boolean;
  /** The member opted in to reminder emails. */
  opted_in: boolean;
  /** The member may use progress photos (18+). */
  progress_allowed: boolean;
  /** ISO of the next check-in due date, or null without a profile. */
  next_due_at: string | null;
  /** True when now is at/past the next due date. */
  due: boolean;
  /** A reminder was already invoked for the current due date. */
  reminded_for_current_cycle: boolean;
  /** Due AND opted in AND not yet reminded this cycle. */
  email_reminder_due: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function nextCheckinDueAt(state: AccountState): Date | null {
  if (!state.member_profile) return null;
  const checkins = state.progress_checkins;
  if (checkins.length === 0) {
    // No check-in yet: the first one is due the moment the profile
    // exists — anchored at profile creation (account created_at).
    const created = state.created_at ? Date.parse(state.created_at) : NaN;
    return Number.isNaN(created) ? new Date(0) : new Date(created);
  }
  const last = checkins[checkins.length - 1];
  const lastTime = Date.parse(last.recorded_at);
  if (Number.isNaN(lastTime)) return new Date(0);
  return new Date(lastTime + CHECKIN_INTERVAL_DAYS * DAY_MS);
}

export function progressReminderStatus(
  state: AccountState,
  now: Date = new Date(),
): ProgressReminderStatus {
  const profile = state.member_profile;
  const dueAt = nextCheckinDueAt(state);
  const due = dueAt !== null && now.getTime() >= dueAt.getTime();
  const reminded =
    dueAt !== null &&
    state.last_progress_reminder?.sent_for_due_at === dueAt.toISOString();
  const optedIn = profile?.progress_reminders_opt_in === true;
  return {
    has_profile: profile !== null,
    opted_in: optedIn,
    progress_allowed: progressPhotosAllowed(state, now),
    next_due_at: dueAt ? dueAt.toISOString() : null,
    due,
    reminded_for_current_cycle: reminded,
    email_reminder_due: due && optedIn && !reminded,
  };
}

/* ------------------------------------------------------------------ */
/* Mutations (validated wrappers over the account store)               */
/* ------------------------------------------------------------------ */

export type SaveMemberProfileResult =
  | { ok: true; state: AccountState; created: boolean }
  | { ok: false; errors: string[] };

/** Validate + save a member profile. `created` = first profile ever. */
export async function saveMemberProfileAsync(
  emailInput: unknown,
  input: MemberProfileInput,
  now: Date = new Date(),
): Promise<SaveMemberProfileResult> {
  const email = normalizeAccountEmail(emailInput);
  const before = await loadAccountAsync(email);
  if (!before.exists || before.deleted) {
    return { ok: false, errors: ['Please sign in to continue.'] };
  }
  const validated = validateMemberProfile(input, before.member_profile, now);
  if (!validated.ok) return { ok: false, errors: validated.errors };
  const created = before.member_profile === null;
  let state = await setMemberProfileAsync(email, validated.profile);
  // The star chart is added AUTOMATICALLY (owner spec): computed from
  // the stored birth data at save time and appended whenever the
  // birth data changed — no separate manual step for the member.
  if (starChartStale(state.star_chart, validated.profile)) {
    const chart = computeStarChart(validated.profile, now);
    if (chart) {
      state = await recordStarChartComputedAsync(email, chart);
    }
  }
  return { ok: true, state, created };
}

export type AddCheckinResult =
  | { ok: true; state: AccountState; checkin: ProgressCheckin }
  | { ok: false; errors: string[]; status: number };

/**
 * Add a before/after check-in. Enforces, server-side, in order:
 * profile exists → member is 18+ (from the saved birthday) → the
 * photo cleans (EXIF strip) — a photo that cannot be cleaned is
 * rejected, never stored.
 */
export async function submitProgressCheckinAsync(
  emailInput: unknown,
  input: { kind?: unknown; photo_data_url?: unknown; note?: unknown },
  now: Date = new Date(),
): Promise<AddCheckinResult> {
  const email = normalizeAccountEmail(emailInput);
  const state = await loadAccountAsync(email);
  if (!state.exists || state.deleted || !state.member_profile) {
    return { ok: false, errors: ['Create your profile first — check-ins live in your garden.'], status: 409 };
  }
  if (!progressPhotosAllowed(state, now)) {
    return {
      ok: false,
      errors: ['Before-and-after progress photos are for members 18 and older. Your feed, favorites, allies, and star chart are all still yours.'],
      status: 403,
    };
  }
  if (state.progress_checkins.length >= MAX_CHECKINS) {
    return { ok: false, errors: ['Your progress garden is full — two years of check-ins is a wonderful archive already.'], status: 409 };
  }
  const cleaned = cleanImageDataUrl(input.photo_data_url, MAX_PHOTO_BYTES);
  if (!cleaned) {
    return {
      ok: false,
      errors: ['That photo could not be accepted — please use a JPG, PNG, or WebP image under 400 KB. (We remove location data from every photo before it is stored; a photo we cannot clean is never stored.)'],
      status: 422,
    };
  }
  const kind =
    input.kind === 'before' || input.kind === 'after' ? input.kind : 'checkin';
  const checkin: ProgressCheckin = {
    id: randomUUID(),
    kind,
    photo_data_url: cleaned.dataUrl,
    note: sanitizePlainText(input.note, 280) || null,
    recorded_at: now.toISOString(),
  };
  const next = await addProgressCheckinAsync(email, checkin);
  return { ok: true, state: next, checkin };
}

/* ------------------------------------------------------------------ */
/* Reminder-email unsubscribe token (Phase B — easy unsubscribe)       */
/* ------------------------------------------------------------------ */

/**
 * The unsubscribe token is an HMAC over the member's email under the
 * account-session secret — the same fail-closed secret discipline as
 * sessions. No secret configured → no token → reminder emails fall
 * back to pointing at the profile's own settings (never a dead link
 * pretending to work).
 */
export function reminderUnsubscribeToken(emailInput: unknown): string | null {
  const secret = accountSessionSecret();
  if (!secret) return null;
  const email = normalizeAccountEmail(emailInput);
  if (!email) return null;
  return createHmac('sha256', secret).update(`progress-reminder:${email}`).digest('base64url');
}

export function verifyReminderUnsubscribeToken(
  emailInput: unknown,
  token: unknown,
): boolean {
  const expected = reminderUnsubscribeToken(emailInput);
  if (!expected || typeof token !== 'string' || !token) return false;
  const presented = Buffer.from(token, 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  if (presented.length !== wanted.length) return false;
  return timingSafeEqual(presented, wanted);
}

/**
 * Turn reminder emails OFF for a member (the token route's one job —
 * it never touches any other profile field: it re-saves the snapshot
 * with only the opt-in flipped).
 */
export async function optOutProgressRemindersAsync(
  emailInput: unknown,
): Promise<boolean> {
  const email = normalizeAccountEmail(emailInput);
  const state = await loadAccountAsync(email);
  if (!state.member_profile) return false;
  if (state.member_profile.progress_reminders_opt_in) {
    await setMemberProfileAsync(email, {
      ...state.member_profile,
      progress_reminders_opt_in: false,
    });
  }
  return true;
}

/** Record helpers re-exported for the send services (jobs layer). */
export { recordProfileWelcomeSentAsync, recordProgressReminderSentAsync };

/** The member's sun sign from their saved birthday (month/day only). */
export function memberSunSign(state: AccountState) {
  if (!state.member_profile) return null;
  return zodiacForBirthday(state.member_profile.birthday);
}
