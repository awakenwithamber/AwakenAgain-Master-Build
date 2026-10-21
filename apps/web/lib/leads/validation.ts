/**
 * Lead + newsletter input validation (G6, G15; affiliate-interest and
 * partner-idea captures added 2026-10-15, audit fix #8).
 *
 * Pure functions — no I/O. Route Handlers call these before touching the
 * LeadStore. Rules: RFC-ish email shape, explicit consent required, answers
 * must reference real quiz ids. No PII leaves the validation layer.
 */
import {
  isValidConcernId,
  isValidFormId,
  normalizeQuizScreening,
  type QuizScreening,
} from '../quiz/quiz';
import { isValidProjectSlug, NETWORK_PROJECT_SLUGS } from '../content/network';
import { isValidContributionType } from '../content/partnerships';

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
  /** Stage 4 screening answers (absent → all "no", the legacy shape). */
  screening: QuizScreening;
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
      screening: normalizeQuizScreening(b.screening),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Get-involved captures (2026-10-15, audit fix #8)                    */
/*                                                                     */
/* /network affiliate interest + /partner idea forms. Same rules as    */
/* every lead: explicit consent is a hard gate, selections must        */
/* reference real project slugs / contribution types, and free text    */
/* is length-capped. Selections are stored as metadata on the lead     */
/* record — never as analytics PII.                                    */
/* ------------------------------------------------------------------ */

const MAX_NOTE = 1000;
const MAX_IDEA = 4000;
const MAX_LINKS = 600;

/** Trim-only text (paragraph breaks preserved), length-capped. */
function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length === 0 || t.length > max) return null;
  return t;
}

/** Optional free text: absent/blank → null; present → validated text. */
function optionalText(
  b: Record<string, unknown>,
  field: string,
  max: number,
  errors: string[],
  message: string,
): string | null {
  const raw = b[field];
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string' && raw.trim().length === 0) return null;
  const cleaned = cleanText(raw, max);
  if (!cleaned) errors.push(message);
  return cleaned;
}

export interface AffiliateInterestInput {
  name: string;
  email: string;
  consent: true;
  /** Validated project slugs, in /network display order, de-duplicated. */
  projectSlugs: string[];
  note: string | null;
}

export function validateAffiliateInterest(
  body: unknown,
): ValidationResult<AffiliateInterestInput> {
  const errors: string[] = [];
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }
  const b = body as Record<string, unknown>;
  const name = cleanString(b.name, MAX_NAME);
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  if (!name) errors.push('Please share your name (up to 120 characters).');
  if (!isValidEmail(email)) errors.push('Please provide a valid email address.');
  if (b.consent !== true)
    errors.push(
      'Consent is required — check the consent box so we may contact you about the affiliate program as it forms.',
    );

  let projectSlugs: string[] = [];
  if (!Array.isArray(b.projects) || b.projects.length === 0) {
    errors.push('Choose at least one project you are interested in.');
  } else {
    if (b.projects.some((p) => !isValidProjectSlug(p))) {
      errors.push('Unknown project in your selection — please choose from the list.');
    }
    const chosen = new Set(
      b.projects.filter((p): p is string => isValidProjectSlug(p)),
    );
    // Display order, de-duplicated — the stored selection is canonical.
    projectSlugs = NETWORK_PROJECT_SLUGS.filter((slug) => chosen.has(slug));
  }

  const note = optionalText(
    b,
    'note',
    MAX_NOTE,
    errors,
    `Please keep your note to ${MAX_NOTE} characters or fewer.`,
  );

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    value: {
      name: name!,
      email: email.toLowerCase(),
      consent: true,
      projectSlugs,
      note,
    },
  };
}

export interface PartnerIdeaInput {
  name: string;
  email: string;
  consent: true;
  contributionType: string;
  idea: string;
  links: string | null;
}

export function validatePartnerIdea(
  body: unknown,
): ValidationResult<PartnerIdeaInput> {
  const errors: string[] = [];
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }
  const b = body as Record<string, unknown>;
  const name = cleanString(b.name, MAX_NAME);
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  if (!name) errors.push('Please share your name (up to 120 characters).');
  if (!isValidEmail(email)) errors.push('Please provide a valid email address.');
  if (b.consent !== true)
    errors.push(
      'Consent is required — check the consent box so Amber may reply to your submission.',
    );
  if (!isValidContributionType(b.contributionType))
    errors.push('Choose how you would like to contribute.');
  const idea = cleanText(b.idea, MAX_IDEA);
  if (!idea)
    errors.push(
      `Please describe your idea or offer (up to ${MAX_IDEA} characters).`,
    );
  const links = optionalText(
    b,
    'links',
    MAX_LINKS,
    errors,
    `Please keep links to ${MAX_LINKS} characters or fewer.`,
  );

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    value: {
      name: name!,
      email: email.toLowerCase(),
      consent: true,
      contributionType: b.contributionType as string,
      idea: idea!,
      links,
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
