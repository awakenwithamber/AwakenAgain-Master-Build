/**
 * SHARED CONTRACT — canonical public image paths.
 * Owner: workstream H (Asset pipeline) populates these files under public/.
 * Consumers (F, G, C, D, E) code against these constants — do not invent
 * new public paths without coordinating with H.
 */

export const SHAPE_IMAGES = {
  smallRose: '/images/shapes/shape-small-rose.png',
  mediumRose: '/images/shapes/shape-medium-rose.png',
  waveRectangle: '/images/shapes/shape-wave-rectangle.png',
  floralRound: '/images/shapes/shape-floral-round.png',
  plainRectangle: '/images/shapes/shape-plain-rectangle.png',
  plainRectangleClean: '/images/shapes/shape-plain-rectangle-clean.png',
} as const;

export const SOAP_LINEUP = {
  hero: '/images/soap/soap-lineup-5.png',
} as const;

/** /images/products/<slug>.webp — matches the catalog record image fields. */
export function productImage(slug: string): string {
  return `/images/products/${slug}.webp`;
}

export const BRAND_IMAGES = {
  banner: '/images/brand/brand-banner.jpg',
  ogImage: '/images/brand/social-preview-og.jpg',
} as const;

export const AUDIO = {
  ambientApothecary: '/audio/ambient-apothecary.mp3',
} as const;
