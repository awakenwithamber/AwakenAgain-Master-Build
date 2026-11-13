/**
 * Per-page background artwork — route → image map (owner directive
 * 2026-11-12): "Use these photos as backgrounds for each page and
 * window… make them mostly transparent and prioritize readability
 * over image." Five flagged images from the original batch were
 * replaced with generated same-spirit artwork on the owner's word
 * (2026-11-12 20:23) — see the replacement entries below.
 *
 * Treatment (see components/layout/PageBackground.tsx + the
 * .aa-page-bg rules in app/globals.css): each artwork is a processed
 * WebP (phone chrome cropped, ≤ ~300 KB) rendered as a decorative,
 * aria-hidden, fixed layer BEHIND all content at low opacity, with
 * the site's dark plum veil gradient above the image so parchment
 * text contrast is preserved. Readability wins every tie.
 *
 * PREVIEW ONLY (owner approval gate, 2026-11-12): this system ships
 * to a preview for the owner's approval before any production push.
 */
export interface PageBackgroundSpec {
  /** Route path this artwork belongs to. */
  route: string;
  /** Public path of the processed WebP (file lives under public/). */
  src: string;
  /** Image-layer opacity — the readability band is 0.10–0.18. */
  opacity: number;
}

export const PAGE_BACKGROUNDS: Record<string, PageBackgroundSpec> = {
  // Home — candlelit manuscript (moon phases, zodiac wheel,
  // botanical plates), cropped out of the owner's gallery screenshot.
  '/': {
    route: '/',
    src: '/images/backgrounds/bg-manuscript-candlelight.webp',
    opacity: 0.1,
  },
  '/grimoire': {
    route: '/grimoire',
    src: '/images/backgrounds/bg-celestial-grimoire.webp',
    opacity: 0.14,
  },
  '/quiz': {
    route: '/quiz',
    src: '/images/backgrounds/bg-universe-signs.webp',
    opacity: 0.12,
  },
  '/services': {
    route: '/services',
    src: '/images/backgrounds/bg-protected-realms.webp',
    opacity: 0.13,
  },
  '/services/tarot': {
    route: '/services/tarot',
    src: '/images/backgrounds/bg-tarot-trio.webp',
    opacity: 0.15,
  },
  // Spiritual service pages → the priestess artwork (fifth
  // replacement, below). The [slug] page mounts <PageBackground>
  // by route, so business-setup / web-development — plain
  // professional pages by the owner's ruling — stay unadorned.
  '/services/astrology': {
    route: '/services/astrology',
    src: '/images/backgrounds/bg-priestess.webp',
    opacity: 0.13,
  },
  '/services/house-cleansing': {
    route: '/services/house-cleansing',
    src: '/images/backgrounds/bg-priestess.webp',
    opacity: 0.13,
  },
  '/services/aura-cleansing': {
    route: '/services/aura-cleansing',
    src: '/images/backgrounds/bg-priestess.webp',
    opacity: 0.13,
  },
  '/services/spirit-resolution': {
    route: '/services/spirit-resolution',
    src: '/images/backgrounds/bg-priestess.webp',
    opacity: 0.13,
  },
  '/services/past-life-regression': {
    route: '/services/past-life-regression',
    src: '/images/backgrounds/bg-priestess.webp',
    opacity: 0.13,
  },
  '/services/inner-renewal': {
    route: '/services/inner-renewal',
    src: '/images/backgrounds/bg-priestess.webp',
    opacity: 0.13,
  },
  // The tarot draw page: the route does not exist in this tree yet;
  // the mapping is recorded so the artwork mounts with the route
  // when it lands. (Asset is shared with /services/tarot.)
  '/message-for-you': {
    route: '/message-for-you',
    src: '/images/backgrounds/bg-tarot-trio.webp',
    opacity: 0.15,
  },
  '/about': {
    route: '/about',
    src: '/images/backgrounds/bg-witch-trials-engraving.webp',
    opacity: 0.1,
  },
  // --- Generated replacements for the five flagged originals
  // (owner directive 2026-11-12 20:23: "Replace the five flagged
  // images"). The flagged originals are NOT used anywhere.
  '/herb-index': {
    // Replaces the clove-tea cure-claim infographic.
    route: '/herb-index',
    src: '/images/backgrounds/bg-herb-tea.webp',
    opacity: 0.14,
  },
  '/journal': {
    // Replaces the watermarked "@The.Humble.Spirit" mirror artwork.
    route: '/journal',
    src: '/images/backgrounds/bg-mirror.webp',
    opacity: 0.13,
  },
  '/network': {
    // Replaces the watermarked "@The.Humble.Spirit" sun figure.
    route: '/network',
    src: '/images/backgrounds/bg-sun-moon.webp',
    opacity: 0.12,
  },
  '/links': {
    // Replaces the "KiKi"-signed "Love is the solution" poster.
    // NOTE: /links' <main> carries its own opaque shelf-photo
    // background (.pageBg in app/links/links.module.css), which
    // covers this fixed layer — see the build report; making the
    // prayer artwork visible there means retiring that background,
    // which is the owner's call at preview.
    route: '/links',
    src: '/images/backgrounds/bg-prayer.webp',
    opacity: 0.14,
  },
};

/**
 * FIFTH REPLACEMENT — WIRED: "replace-priestess" (white-robed
 * priestess at a candlelit altar, moon-phase and star charts;
 * generated, verified clean — no text, no watermark, no claims)
 * replaces the HELD White Witch engagement-bait poster on the
 * spiritual service pages: astrology, house-cleansing,
 * aura-cleansing, spirit-resolution, past-life-regression and
 * inner-renewal (the '/services/<slug>' entries above). The
 * flagged original was never wired anywhere.
 */

export function pageBackgroundFor(
  route: string,
): PageBackgroundSpec | undefined {
  return PAGE_BACKGROUNDS[route];
}
