/**
 * Star chart computation — Gaia profile build (owner addition
 * 2026-11-08: a dedicated star-chart page, computed automatically
 * from the member's stored birth data).
 *
 * PURE + deterministic: the same stored profile always produces the
 * same chart, and the chart is computed + stored at profile-save time
 * (lib/accounts/member-profile.ts), then surfaced on the feed — no
 * separate manual step.
 *
 * HONEST SCOPE — what is computed, and what is not:
 * - Sun sign: exact, from month/day (lib/accounts/zodiac.ts).
 * - Moon phase: computed from the synodic cycle against a known new
 *   moon epoch (2000-01-06 18:14 UTC). This is sound astronomy for
 *   the PHASE (name + illumination); it is labeled approximate
 *   because a phase is a range, not an instant. The moon's SIGN is
 *   NOT computed — that needs a true ephemeris, and faking it would
 *   be exactly the false precision the owner forbade.
 * - Ascendant, houses, planetary positions: NOT computed (they need
 *   an ephemeris engine + geocoded birth place). They stay PLANNED;
 *   when birth time + place are present the chart says so and names
 *   what they will unlock.
 */
import { zodiacForBirthday, type ZodiacSign } from './zodiac';
import type { MemberProfileData } from './accounts';

export interface MoonPhase {
  /** Phase name, e.g. "Waxing Gibbous". */
  name: string;
  /** Illuminated fraction of the disc, 0–1, rounded to 3 places. */
  illumination: number;
  /** Days since the last new moon, rounded to 1 place. */
  age_days: number;
}

export interface ComputedStarChart {
  sun_sign_id: string;
  moon_phase: MoonPhase;
  /** True when birth time AND birth place were on the profile. */
  has_birth_details: boolean;
  /** The exact inputs this chart was computed from — a change here means recompute. */
  computed_from: { birthday: string; birth_time: string | null; birth_place: string | null };
  computed_at: string;
}

const SYNODIC_DAYS = 29.530588853;
/** A known new moon: 2000-01-06 18:14 UTC. */
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14);

const PHASE_NAMES: readonly { until_age: number; name: string }[] = [
  { until_age: 1.0, name: 'New Moon' },
  { until_age: 6.4, name: 'Waxing Crescent' },
  { until_age: 8.4, name: 'First Quarter' },
  { until_age: 13.8, name: 'Waxing Gibbous' },
  { until_age: 15.8, name: 'Full Moon' },
  { until_age: 21.1, name: 'Waning Gibbous' },
  { until_age: 23.1, name: 'Last Quarter' },
  { until_age: 28.5, name: 'Waning Crescent' },
  { until_age: SYNODIC_DAYS, name: 'New Moon' },
];

/**
 * The moon phase at a moment — pure synodic math. Birthdays are taken
 * at noon UTC when no birth time exists (mid-day is the honest
 * midpoint of an unknown hour); with a birth time, that time is used
 * as UTC (the birthplace's timezone is not known — the phase spans
 * days, so the hour rarely moves the name; when it could, the label
 * 'approximate' on the display covers it).
 */
export function moonPhaseAt(birthday: string, birthTime: string | null): MoonPhase | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!match) return null;
  let hour = 12;
  let minute = 0;
  if (birthTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(birthTime)) {
    hour = Number(birthTime.slice(0, 2));
    minute = Number(birthTime.slice(3, 5));
  }
  const moment = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour, minute);
  const age = (((moment - NEW_MOON_EPOCH_MS) / 86_400_000) % SYNODIC_DAYS + SYNODIC_DAYS) % SYNODIC_DAYS;
  const illumination = (1 - Math.cos((2 * Math.PI * age) / SYNODIC_DAYS)) / 2;
  const name = PHASE_NAMES.find((phase) => age < phase.until_age)?.name ?? 'New Moon';
  return {
    name,
    illumination: Math.round(illumination * 1000) / 1000,
    age_days: Math.round(age * 10) / 10,
  };
}

/** Compute the full chart the app can honestly compute from a profile. */
export function computeStarChart(
  profile: Pick<MemberProfileData, 'birthday' | 'birth_time' | 'birth_place'>,
  now: Date = new Date(),
): ComputedStarChart | null {
  const sun: ZodiacSign | null = zodiacForBirthday(profile.birthday);
  const moon = moonPhaseAt(profile.birthday, profile.birth_time);
  if (!sun || !moon) return null;
  return {
    sun_sign_id: sun.id,
    moon_phase: moon,
    has_birth_details: Boolean(profile.birth_time && profile.birth_place),
    computed_from: {
      birthday: profile.birthday,
      birth_time: profile.birth_time,
      birth_place: profile.birth_place,
    },
    computed_at: now.toISOString(),
  };
}

/** True when a stored chart no longer matches the profile's birth data. */
export function starChartStale(
  chart: ComputedStarChart | null,
  profile: Pick<MemberProfileData, 'birthday' | 'birth_time' | 'birth_place'>,
): boolean {
  if (!chart) return true;
  return (
    chart.computed_from.birthday !== profile.birthday ||
    chart.computed_from.birth_time !== profile.birth_time ||
    chart.computed_from.birth_place !== profile.birth_place
  );
}
