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
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.awakenagain.com';
  return raw.replace(/\/+$/, '');
}

/**
 * Comprehensive SEO keywords (owner directive 2026-10-10).
 * Covers: spiritual awakening, herbalism, empath/magic/soul topics,
 * sustainability, eco living, and economic well-being themes.
 */
export const SITE_KEYWORDS = [
  // Core brand
  'awaken', 'awaken again', 'awaken with amber', "amber's alchemy apothecary",
  // Spirituality & magic
  'spirituality', 'spiritual awakening', 'magic', 'light magic', 'soul',
  'soul healing', 'empath', 'empath protection', 'starseed', 'lightworker',
  'energy worker', 'psychic protection', 'spiritual guidance',
  // Love & relationships
  'love', 'self love', 'love ritual', 'heart healing',
  // Herbalism & wellness
  'herbalism', 'herbal remedies', 'botanical medicine', 'natural remedies',
  'herbal capsules', 'handmade soap', 'artisan soap', 'natural skincare',
  'herbalist', 'plant medicine', 'how to use herbs', 'herb guide',
  // Sustainability & eco
  'sustainable', 'sustainability', 'eco', 'eco living', 'eco-friendly',
  'natural living', 'sustainable wellness',
  // Economic well-being
  'economic well-being', 'financial wellness', 'abundance', 'prosperity',
  'manifestation',
  // How-to
  'how to', 'how to cleanse energy', 'how to protect energy',
  'how to use crystals', 'how to meditate',
] as const;
