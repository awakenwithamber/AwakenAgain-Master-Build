/**
 * SEO + brand identity configuration for Amber's Alchemy Apothecary.
 *
 * Single source of truth for the canonical brand name, contact details,
 * and site URL. Every metadata, JSON-LD, sitemap, and robots module must
 * import from here — never retype the brand name or contact values.
 *
 * Brand law: the exact business name "Amber's Alchemy Apothecary" is used
 * everywhere customer-facing — never shortened.
 */

/** Exact canonical business name. Never shortened, never retyped elsewhere. */
export const BRAND_NAME = "Amber's Alchemy Apothecary";

/** Owner-verified contact details (MEMORY.md: CONTACT IDENTITY VERIFIED 2026-10-04). */
export const BRAND_EMAIL = 'awaken@consultant.com';
export const BRAND_PHONE_DISPLAY = '(801) 414-8984';
/** JSON-LD / structured-data telephone format. */
export const BRAND_PHONE_JSONLD = '+1-801-414-8984';
/** tel: link target for UI. */
export const BRAND_PHONE_TEL = 'tel:+18014148984';

/**
 * Canonical site base URL. Override per environment with
 * NEXT_PUBLIC_SITE_URL; defaults to the production domain.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://awakenagain.com';
  return raw.replace(/\/+$/, '');
}
