/**
 * First-party interest profile (owner spec 2026-10-14). Client-side ONLY:
 * the profile lives in the visitor's own localStorage, never leaves the
 * device (except consented, aggregate PostHog events the visitor opted
 * into), involves no fingerprinting and no cross-site tracking.
 *
 * SCORING RULES (simple + explainable — this block IS the documentation):
 *   +1  viewing a section page (herb index / herbal library → herbs,
 *       soap shop / a soap product page → soaps, Grimoire → grimoire,
 *       services → readings, journal → articles, a capsule product → herbs)
 *   +3  completing something (finishing the Herbal Allies Quiz → quiz,
 *       completing the soap-builder ritual → soaps)
 *   Scores only ever accrue while analytics consent = 'accepted'
 *   (enforced inside recordInterest — callers never check themselves).
 *   Each category is capped at MAX_SCORE so one binge can't pin the
 *   profile forever; older interests fade only by being out-scored.
 *
 * TOP INTEREST: a category is the "clear top interest" when its score is
 * at least MIN_TOP_SCORE and strictly greater than every other score.
 * A tie means no personalization — the homepage stays in default order.
 */
import {
  readConsentState,
  type StorageLike,
} from './consent';

export const INTEREST_CATEGORIES = [
  'herbs',
  'soaps',
  'grimoire',
  'readings',
  'quiz',
  'articles',
] as const;

export type InterestCategory = (typeof INTEREST_CATEGORIES)[number];

export const INTERESTS_STORAGE_KEY = 'aa_interest_profile_v1';

/** Per-category score cap — keeps the profile responsive to new interests. */
export const MAX_SCORE = 30;

/** Minimum score before a category can lead the homepage. */
export const MIN_TOP_SCORE = 3;

export type InterestProfile = Record<InterestCategory, number>;

export function emptyProfile(): InterestProfile {
  return {
    herbs: 0,
    soaps: 0,
    grimoire: 0,
    readings: 0,
    quiz: 0,
    articles: 0,
  };
}

/** Read the stored profile. Corrupt/absent data reads as an empty profile. */
export function readProfile(storage: StorageLike): InterestProfile {
  try {
    const raw = storage.getItem(INTERESTS_STORAGE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    const profile = emptyProfile();
    for (const category of INTEREST_CATEGORIES) {
      const value = parsed[category];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        profile[category] = Math.min(MAX_SCORE, Math.floor(value));
      }
    }
    return profile;
  } catch {
    return emptyProfile();
  }
}

function writeProfile(storage: StorageLike, profile: InterestProfile): void {
  try {
    storage.setItem(INTERESTS_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable — personalization simply stays off */
  }
}

/**
 * Accrue interest. NO-OP unless consent is currently 'accepted' — the
 * consent gate lives here so no caller can accidentally profile a visitor
 * who hasn't agreed (or who declined). Returns the updated profile.
 */
export function recordInterest(
  storage: StorageLike,
  category: InterestCategory,
  points = 1,
): InterestProfile {
  const profile = readProfile(storage);
  if (readConsentState(storage) !== 'accepted') return profile;
  if (!INTEREST_CATEGORIES.includes(category) || points <= 0) return profile;
  profile[category] = Math.min(MAX_SCORE, profile[category] + points);
  writeProfile(storage, profile);
  return profile;
}

/** Delete the local interest profile (consent withdrawal / privacy page). */
export function clearProfile(storage: StorageLike): void {
  try {
    storage.removeItem(INTERESTS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * The clear top interest, or null when there is no signal worth acting
 * on (all zeros, below the minimum, or a tie for first place).
 */
export function topInterest(profile: InterestProfile): InterestCategory | null {
  let best: InterestCategory | null = null;
  let bestScore = 0;
  let tied = false;
  for (const category of INTEREST_CATEGORIES) {
    const score = profile[category];
    if (score > bestScore) {
      best = category;
      bestScore = score;
      tied = false;
    } else if (score === bestScore && score > 0) {
      tied = true;
    }
  }
  if (!best || tied || bestScore < MIN_TOP_SCORE) return null;
  return best;
}

/**
 * Catalog category → interest category (product-page views). Returns
 * null for categories that signal none of the six interests.
 */
export function interestForCatalogCategory(
  category: string | undefined,
): InterestCategory | null {
  switch (category) {
    case 'Soaps':
      return 'soaps';
    case 'Capsules':
    case 'Teas':
    case 'Balms & Skincare':
      return 'herbs';
    case 'Services':
      return 'readings';
    case 'Grimoire & Digital':
      return 'grimoire';
    default:
      return null;
  }
}
