/**
 * Lead + newsletter input validation (G6, G15).
 *
 * Pure functions — no I/O. Route Handlers call these before touching the
 * LeadStore. Rules: RFC-ish email shape, explicit consent required, answers
 * must reference real quiz ids. No PII leaves the validation layer.
 */
import { isValidConcernId, isValidFormId } from '../quiz/quiz';

export interface ValidationResult<T> {
  ok: boolean;
  errors: string[];
  value?: T;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_NAME = 120;
const MAX_EMAIL = 254;

export function isValidEmail(email: unknown): email is string {
  return (
    typeof email === 'string' &&
    email.length <= MAX_EMAIL &&
    EMAIL_RE.test(email.trim())
  );
}

function cleanString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s+/g, ' ');
  if (t.length === 0 || t.length > max) return null;
  return t;
}

export interface QuizLeadInput {
  name: string;
  email: string;
  consent: true;
  concernId: string;
  formId: string;
}

export function validateQuizLead(body: unknown): ValidationResult<QuizLeadInput> {
  const errors: string[] = [];
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }
  const b = body as Record<string, unknown>;
  const name = cleanString(b.name, MAX_NAME);
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  if (!name) errors.push('Please share your first name (up to 120 characters).');
  if (!isValidEmail(email)) errors.push('Please provide a valid email address.');
  if (b.consent !== true)
    errors.push('Consent is required — check the consent box to receive your results.');
  if (!isValidConcernId(b.concernId))
    errors.push('Unknown quiz concern — please restart the quiz.');
  if (!isValidFormId(b.formId))
    errors.push('Unknown remedy form — please restart the quiz.');
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    value: {
      name: name!,
      email: email.toLowerCase(),
      consent: true,
      concernId: b.concernId as string,
      formId: b.formId as string,
    },
  };
}

export interface NewsletterInput {
  email: string;
  consent: true;
  placement: string;
}

const MAX_PLACEMENT = 40;

export function validateNewsletter(
  body: unknown,
): ValidationResult<NewsletterInput> {
  const errors: string[] = [];
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }
  const b = body as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  if (!isValidEmail(email)) errors.push('Please provide a valid email address.');
  if (b.consent !== true)
    errors.push('Consent is required to join the newsletter.');
  const placement =
    typeof b.placement === 'string' ? b.placement.trim().slice(0, MAX_PLACEMENT) : 'footer';
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    value: { email: email.toLowerCase(), consent: true, placement },
  };
}
