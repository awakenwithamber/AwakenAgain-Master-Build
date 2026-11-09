/**
 * Zodiac — deterministic sun-sign computation for member profiles
 * (Gaia profile build, owner spec 2026-11-08).
 *
 * PURE + CLIENT-SAFE: no server imports, no I/O. The sign is computed
 * from the birthday's MONTH AND DAY ONLY — the year is never needed,
 * which is what lets the public feed show a member's sign without
 * ever carrying their exact birthday (privacy rule: exact birthday,
 * address, and phone are never public).
 *
 * The qualities copy is presentation content — traditional astrology
 * descriptions of each sign's element and modality, in the shop's
 * voice. It makes no claims about a person; it describes the sign.
 *
 * A computed natal chart (ascendant, houses, planets) needs an
 * ephemeris engine this app does not have — PLANNED, not faked. When
 * a member adds birth time + birth place, the feed shows them beside
 * the sun sign as the seeds of that fuller chart.
 */

export type ZodiacElement = 'Fire' | 'Earth' | 'Air' | 'Water';
export type ZodiacModality = 'Cardinal' | 'Fixed' | 'Mutable';

export interface ZodiacSign {
  id: string;
  name: string;
  symbol: string;
  /** Display range, e.g. "Mar 21 – Apr 19". */
  datesLabel: string;
  element: ZodiacElement;
  /** The sign's modality — astrology's word for its quality of motion. */
  modality: ZodiacModality;
  /** Traditional qualities, presentation copy. */
  qualities: string;
  /** The ruling planet in traditional astrology (presentation). */
  ruler: string;
}

export const ZODIAC_SIGNS: readonly ZodiacSign[] = [
  {
    id: 'aries', name: 'Aries', symbol: '♈', datesLabel: 'Mar 21 – Apr 19',
    element: 'Fire', modality: 'Cardinal', ruler: 'Mars',
    qualities:
      'The first spark of the zodiac — bold, direct, and quick to begin. Aries energy starts things: it is the seed pushing through spring soil, all courage and forward motion.',
  },
  {
    id: 'taurus', name: 'Taurus', symbol: '♉', datesLabel: 'Apr 20 – May 20',
    element: 'Earth', modality: 'Fixed', ruler: 'Venus',
    qualities:
      'Steady, sensory, and deeply rooted. Taurus builds slowly and well, loves what is beautiful and lasting, and keeps its promises the way a garden keeps the seasons.',
  },
  {
    id: 'gemini', name: 'Gemini', symbol: '♊', datesLabel: 'May 21 – Jun 20',
    element: 'Air', modality: 'Mutable', ruler: 'Mercury',
    qualities:
      'Curious, quick, and bright-minded. Gemini gathers stories and ideas the way bees gather pollen — moving between blooms, connecting everything it touches.',
  },
  {
    id: 'cancer', name: 'Cancer', symbol: '♋', datesLabel: 'Jun 21 – Jul 22',
    element: 'Water', modality: 'Cardinal', ruler: 'the Moon',
    qualities:
      'Tender, protective, and ruled by the tides. Cancer remembers everything, tends its people like a hearth fire, and knows the way home by heart.',
  },
  {
    id: 'leo', name: 'Leo', symbol: '♌', datesLabel: 'Jul 23 – Aug 22',
    element: 'Fire', modality: 'Fixed', ruler: 'the Sun',
    qualities:
      'Warm, generous, and made to shine. Leo is high-summer sunlight — creative, proud, and happiest when its warmth is shared with the whole garden.',
  },
  {
    id: 'virgo', name: 'Virgo', symbol: '♍', datesLabel: 'Aug 23 – Sep 22',
    element: 'Earth', modality: 'Mutable', ruler: 'Mercury',
    qualities:
      'Precise, devoted, and quietly masterful. Virgo is the herbalist of the zodiac — sorting, refining, and healing through a thousand small, careful acts.',
  },
  {
    id: 'libra', name: 'Libra', symbol: '♎', datesLabel: 'Sep 23 – Oct 22',
    element: 'Air', modality: 'Cardinal', ruler: 'Venus',
    qualities:
      'Graceful, fair-minded, and drawn to harmony. Libra weighs every side like scales at the autumn equinox, and makes beauty feel like a form of justice.',
  },
  {
    id: 'scorpio', name: 'Scorpio', symbol: '♏', datesLabel: 'Oct 23 – Nov 21',
    element: 'Water', modality: 'Fixed', ruler: 'Pluto',
    qualities:
      'Deep, private, and unafraid of the dark. Scorpio is the root cellar and the compost heap — where things transform, out of sight, into something powerful.',
  },
  {
    id: 'sagittarius', name: 'Sagittarius', symbol: '♐', datesLabel: 'Nov 22 – Dec 21',
    element: 'Fire', modality: 'Mutable', ruler: 'Jupiter',
    qualities:
      'Honest, far-seeing, and hungry for the horizon. Sagittarius is the traveler and the teacher, following every trail that promises a wider view.',
  },
  {
    id: 'capricorn', name: 'Capricorn', symbol: '♑', datesLabel: 'Dec 22 – Jan 19',
    element: 'Earth', modality: 'Cardinal', ruler: 'Saturn',
    qualities:
      'Patient, ambitious, and built for the long climb. Capricorn is the mountain goat of the zodiac — it plants orchards whose shade it may never sit in.',
  },
  {
    id: 'aquarius', name: 'Aquarius', symbol: '♒', datesLabel: 'Jan 20 – Feb 18',
    element: 'Air', modality: 'Fixed', ruler: 'Uranus',
    qualities:
      'Original, principled, and a little ahead of its time. Aquarius pours water for the whole village — it thinks in communities, futures, and better ways.',
  },
  {
    id: 'pisces', name: 'Pisces', symbol: '♓', datesLabel: 'Feb 19 – Mar 20',
    element: 'Water', modality: 'Mutable', ruler: 'Neptune',
    qualities:
      'Gentle, dreamy, and boundlessly compassionate. Pisces is the deep pool at the garden’s edge — it feels everything, and turns feeling into art and mercy.',
  },
];

/**
 * Sign boundaries as (month, day) the sign STARTS. The sign for a
 * date is the last boundary at or before it, wrapping the year
 * (Capricorn spans the new year).
 */
const SIGN_STARTS: readonly { month: number; day: number; id: string }[] = [
  { month: 1, day: 20, id: 'aquarius' },
  { month: 2, day: 19, id: 'pisces' },
  { month: 3, day: 21, id: 'aries' },
  { month: 4, day: 20, id: 'taurus' },
  { month: 5, day: 21, id: 'gemini' },
  { month: 6, day: 21, id: 'cancer' },
  { month: 7, day: 23, id: 'leo' },
  { month: 8, day: 23, id: 'virgo' },
  { month: 9, day: 23, id: 'libra' },
  { month: 10, day: 23, id: 'scorpio' },
  { month: 11, day: 22, id: 'sagittarius' },
  { month: 12, day: 22, id: 'capricorn' },
];

const SIGN_BY_ID = new Map(ZODIAC_SIGNS.map((s) => [s.id, s]));

/** The sun sign for a month/day — deterministic, year-free. */
export function zodiacForMonthDay(month: number, day: number): ZodiacSign | null {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  let current = 'capricorn'; // dates before Jan 20 belong to Capricorn
  for (const start of SIGN_STARTS) {
    if (month > start.month || (month === start.month && day >= start.day)) {
      current = start.id;
    }
  }
  return SIGN_BY_ID.get(current) ?? null;
}

/** Parse a strict YYYY-MM-DD birthday into its parts, or null. */
export function parseBirthday(
  input: unknown,
): { year: number; month: number; day: number } | null {
  if (typeof input !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject impossible dates (Feb 30, Apr 31) by round-tripping UTC.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/** The sun sign for a YYYY-MM-DD birthday (month/day only). */
export function zodiacForBirthday(input: unknown): ZodiacSign | null {
  const parts = parseBirthday(input);
  if (!parts) return null;
  return zodiacForMonthDay(parts.month, parts.day);
}

/**
 * Completed years of age on a given date — the one age function both
 * gates (13+ profile, 18+ progress photos) use, so the boundary can
 * never drift between them. UTC throughout: a birthday arrives at the
 * same moment for the gate everywhere.
 */
export function ageOn(birthday: unknown, on: Date): number | null {
  const parts = parseBirthday(birthday);
  if (!parts) return null;
  let age = on.getUTCFullYear() - parts.year;
  const month = on.getUTCMonth() + 1;
  const day = on.getUTCDate();
  if (month < parts.month || (month === parts.month && day < parts.day)) {
    age -= 1;
  }
  return age;
}
