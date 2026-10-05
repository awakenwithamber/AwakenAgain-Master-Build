/**
 * Server-side input sanitizers for Amber's Alchemy Apothecary.
 *
 * HANDOFF — checkout/API worker: import these in every Route Handler that
 * accepts request data (checkout, contact, quiz-lead, reviews). They are
 * pure functions with no dependencies, safe for the Node runtime.
 *
 * CONTRACT:
 * - Sanitizers never throw on garbage input — they return a cleaned value
 *   or null (invalid). Route handlers map null → 400 with a generic
 *   message; never echo raw input or stack traces in error responses.
 * - These run BEFORE lib/cart/validation.ts builders. The builders still
 *   throw on invalid business data; catch those throws in the handler and
 *   return 400 { errors: [...] }.
 * - No PII, payment data, or secrets are transformed here — contact fields
 *   stay server-side and never flow into PostHog (see lib/analytics).
 */

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;
const HTML_TAG = /<[^>]*>/g;

/** Strip HTML tags + control characters, trim, and cap length. */
export function sanitizePlainText(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(HTML_TAG, '')
    .replace(CONTROL_CHARS, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validate + normalize an email address. Returns the lowercase, trimmed
 * address or null when invalid. This is a syntactic gate only — deliverability
 * is not checked here.
 */
export function sanitizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim().toLowerCase();
  if (value.length === 0 || value.length > 254) return null;
  // Pragmatic RFC-5322 subset: local@domain.tld, no consecutive dots, no
  // leading/trailing dots in either part.
  const EMAIL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/;
  return EMAIL_RE.test(value) ? value : null;
}

/**
 * Normalize a phone number to a digit string with optional leading '+'.
 * Accepts common formatting (spaces, dashes, parentheses, dots).
 * Returns null when the digit count is outside 7–15 (E.164 range).
 */
export function sanitizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return (hasPlus ? '+' : '') + digits;
}

/**
 * Parse an integer within [min, max]. Rejects floats, NaN, non-numeric
 * strings, and out-of-range values. Returns null when invalid.
 */
export function sanitizeInt(
  input: unknown,
  options: { min: number; max: number },
): number | null {
  const { min, max } = options;
  let n: number;
  if (typeof input === 'number') {
    n = input;
  } else if (typeof input === 'string' && input.trim() !== '') {
    if (!/^-?\d+$/.test(input.trim())) return null;
    n = Number(input.trim());
  } else {
    return null;
  }
  if (!Number.isSafeInteger(n) || n < min || n > max) return null;
  return n;
}

/**
 * Validate a catalog ID/handle: lowercase slug characters only, capped
 * length. Rejects anything that could be a path, query, or script.
 */
export function sanitizeId(input: unknown, maxLength = 80): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim().toLowerCase();
  if (value.length === 0 || value.length > maxLength) return null;
  return /^[a-z0-9][a-z0-9-_]*$/.test(value) ? value : null;
}

/** Type guard for parsed JSON bodies: plain object, not array, not null. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
