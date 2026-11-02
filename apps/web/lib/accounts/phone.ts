/**
 * Phone numbers with country codes — Phase 2B (owner directive
 * 2026-10-30): registration collects a phone number WITH a country-code
 * selection and format validation.
 *
 * PHONE/SMS RULE (binding, owner spec item 3): the number is COLLECTED
 * and VALIDATED only. Phone verification is NOT required and SMS codes
 * are NOT offered — no SMS provider is configured. Nothing in this
 * module sends anything; it validates and normalizes for storage.
 *
 * PURE + CLIENT-SAFE: no server imports — the registration form and the
 * server validators share this one source of truth (the checkout
 * shipping-address module reuses PHONE_COUNTRIES for its country list
 * so the two country selectors can never drift apart).
 */

export interface PhoneCountry {
  /** Display name. */
  name: string;
  /** ISO 3166-1 alpha-2 — also the shipping-address country code. */
  iso2: string;
  /** International dialing code, digits only (no '+'). */
  dial: string;
}

/**
 * Country list for the phone country-code selector (and, by reuse, the
 * shipping-address country selector). US first (the shop's home
 * country and the form default), then alphabetical.
 */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { name: 'United States', iso2: 'US', dial: '1' },
  { name: 'Argentina', iso2: 'AR', dial: '54' },
  { name: 'Australia', iso2: 'AU', dial: '61' },
  { name: 'Austria', iso2: 'AT', dial: '43' },
  { name: 'Belgium', iso2: 'BE', dial: '32' },
  { name: 'Brazil', iso2: 'BR', dial: '55' },
  { name: 'Canada', iso2: 'CA', dial: '1' },
  { name: 'Chile', iso2: 'CL', dial: '56' },
  { name: 'China', iso2: 'CN', dial: '86' },
  { name: 'Colombia', iso2: 'CO', dial: '57' },
  { name: 'Costa Rica', iso2: 'CR', dial: '506' },
  { name: 'Czechia', iso2: 'CZ', dial: '420' },
  { name: 'Denmark', iso2: 'DK', dial: '45' },
  { name: 'Dominican Republic', iso2: 'DO', dial: '1' },
  { name: 'Ecuador', iso2: 'EC', dial: '593' },
  { name: 'Egypt', iso2: 'EG', dial: '20' },
  { name: 'Finland', iso2: 'FI', dial: '358' },
  { name: 'France', iso2: 'FR', dial: '33' },
  { name: 'Germany', iso2: 'DE', dial: '49' },
  { name: 'Greece', iso2: 'GR', dial: '30' },
  { name: 'Guatemala', iso2: 'GT', dial: '502' },
  { name: 'Hong Kong', iso2: 'HK', dial: '852' },
  { name: 'Hungary', iso2: 'HU', dial: '36' },
  { name: 'Iceland', iso2: 'IS', dial: '354' },
  { name: 'India', iso2: 'IN', dial: '91' },
  { name: 'Indonesia', iso2: 'ID', dial: '62' },
  { name: 'Ireland', iso2: 'IE', dial: '353' },
  { name: 'Israel', iso2: 'IL', dial: '972' },
  { name: 'Italy', iso2: 'IT', dial: '39' },
  { name: 'Jamaica', iso2: 'JM', dial: '1' },
  { name: 'Japan', iso2: 'JP', dial: '81' },
  { name: 'Kenya', iso2: 'KE', dial: '254' },
  { name: 'Malaysia', iso2: 'MY', dial: '60' },
  { name: 'Mexico', iso2: 'MX', dial: '52' },
  { name: 'Netherlands', iso2: 'NL', dial: '31' },
  { name: 'New Zealand', iso2: 'NZ', dial: '64' },
  { name: 'Nigeria', iso2: 'NG', dial: '234' },
  { name: 'Norway', iso2: 'NO', dial: '47' },
  { name: 'Panama', iso2: 'PA', dial: '507' },
  { name: 'Peru', iso2: 'PE', dial: '51' },
  { name: 'Philippines', iso2: 'PH', dial: '63' },
  { name: 'Poland', iso2: 'PL', dial: '48' },
  { name: 'Portugal', iso2: 'PT', dial: '351' },
  { name: 'Puerto Rico', iso2: 'PR', dial: '1' },
  { name: 'Romania', iso2: 'RO', dial: '40' },
  { name: 'Singapore', iso2: 'SG', dial: '65' },
  { name: 'South Africa', iso2: 'ZA', dial: '27' },
  { name: 'South Korea', iso2: 'KR', dial: '82' },
  { name: 'Spain', iso2: 'ES', dial: '34' },
  { name: 'Sweden', iso2: 'SE', dial: '46' },
  { name: 'Switzerland', iso2: 'CH', dial: '41' },
  { name: 'Taiwan', iso2: 'TW', dial: '886' },
  { name: 'Thailand', iso2: 'TH', dial: '66' },
  { name: 'Turkey', iso2: 'TR', dial: '90' },
  { name: 'Ukraine', iso2: 'UA', dial: '380' },
  { name: 'United Arab Emirates', iso2: 'AE', dial: '971' },
  { name: 'United Kingdom', iso2: 'GB', dial: '44' },
  { name: 'Vietnam', iso2: 'VN', dial: '84' },
];

export function phoneCountryByIso2(iso2: unknown): PhoneCountry | null {
  if (typeof iso2 !== 'string') return null;
  const target = iso2.trim().toUpperCase();
  return PHONE_COUNTRIES.find((c) => c.iso2 === target) ?? null;
}

export interface PhoneValidation {
  ok: boolean;
  /** Normalized storage form: '+<dial><national digits>' (ok only). */
  normalized?: string;
  /** Plain-language problem (not ok only). */
  error?: string;
}

/**
 * Validate a phone number given as (country ISO2, national number as
 * typed). Rules: the country must be a known selection; the national
 * part may carry spaces, dashes, parentheses and one leading '+' (a
 * full international paste is tolerated when it starts with the
 * selected country's dial code); the national digits must be 4–14 long
 * and the full international digit count (dial + national) must sit in
 * the E.164 envelope of 7–15 digits. US/CA numbers must be exactly 10
 * national digits (NANP).
 */
export function validatePhoneNumber(
  countryIso2: unknown,
  nationalInput: unknown,
): PhoneValidation {
  const country = phoneCountryByIso2(countryIso2);
  if (!country) {
    return { ok: false, error: 'Please choose your country code.' };
  }
  if (typeof nationalInput !== 'string' || !nationalInput.trim()) {
    return { ok: false, error: 'Please enter your phone number.' };
  }
  let digits = nationalInput.replace(/[^\d]/g, '');
  // Tolerate a pasted full international number for the chosen country.
  if (
    digits.length > 10 &&
    digits.startsWith(country.dial) &&
    nationalInput.trim().startsWith('+')
  ) {
    digits = digits.slice(country.dial.length);
  }
  // NANP trunk prefix: a US/CA number typed as 1-XXX-XXX-XXXX.
  if (country.dial === '1' && digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  // National trunk 0: most countries dial a leading 0 domestically
  // that is dropped in international form (07123… → +44 7123…). Italy
  // is the well-known exception — its leading 0 is significant and
  // stays.
  if (country.dial !== '1' && country.iso2 !== 'IT' && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length < 4 || digits.length > 14) {
    return {
      ok: false,
      error: 'That phone number does not look complete — please check it and try again.',
    };
  }
  if (country.dial === '1' && digits.length !== 10) {
    return {
      ok: false,
      error: 'US and Canada numbers need 10 digits (area code + number).',
    };
  }
  const total = country.dial.length + digits.length;
  if (total < 7 || total > 15) {
    return {
      ok: false,
      error: 'That phone number does not look complete — please check it and try again.',
    };
  }
  return { ok: true, normalized: `+${country.dial}${digits}` };
}

/**
 * Split a stored normalized number ('+<dial><digits>') back into its
 * country + national parts for form pre-fill. Longest dial-code match
 * wins; returns null when no known country matches.
 */
export function splitNormalizedPhone(
  normalized: unknown,
): { country: PhoneCountry; national: string } | null {
  if (typeof normalized !== 'string' || !normalized.startsWith('+')) {
    return null;
  }
  const digits = normalized.slice(1).replace(/[^\d]/g, '');
  let best: PhoneCountry | null = null;
  for (const country of PHONE_COUNTRIES) {
    if (
      digits.startsWith(country.dial) &&
      (!best || country.dial.length > best.dial.length)
    ) {
      best = country;
    }
  }
  if (!best) return null;
  // NANP countries share dial '1' — the stored form cannot distinguish
  // US from CA; the US entry is the default resolution.
  if (best.dial === '1') {
    best = PHONE_COUNTRIES[0];
  }
  return { country: best, national: digits.slice(best.dial.length) };
}
