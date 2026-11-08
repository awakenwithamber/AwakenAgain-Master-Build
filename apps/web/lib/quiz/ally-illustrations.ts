/**
 * Verified botanical illustrations for the quiz results ally cards.
 *
 * Owner ask (2026-11-08, Experience Directive package 2 follow-up):
 * botanical illustrations on ally cards WHERE AUTHENTIC ASSETS EXIST.
 * This module is the verification gate for that ask. An illustration is
 * returned for a herb ONLY when every link of this chain holds:
 *
 * 1. The site's canonical illustration map (lib/herbs/illustrations.ts,
 *    BOTANICAL_ILLUSTRATIONS) carries an entry for the herb's slug.
 * 2. That entry is hosted on Wikimedia Commons (upload.wikimedia.org /
 *    thumb.wikimedia.org). The map's other hosts are NOT usable: the
 *    manuscdn.com / cloudfront.net hotlinks returned 403 for every
 *    sampled URL as of 2026-10-08 (documented in illustrations.ts
 *    itself, and re-corroborated 2026-11-08), and the map's eight
 *    relative "images/soap-*.png" values point at files that do not
 *    exist under public/ either. A reference to a dead or missing
 *    file is not an asset.
 * 3. The slug carries an ILLUSTRATION_CREDITS record — the audit trail
 *    of the 2026-10-29 correction pass, which verified the image
 *    depicts the CORRECT species and recorded its license. Entries
 *    whose image depicts a different species (e.g. the '-2' variant
 *    records) never resolve here because the resolver is keyed by the
 *    ally's own catalog id, never by a variant slug.
 *
 * There are NO local illustration files to wire: public/images/herbs/
 * contains only the "botanical-coming-soon" placeholder SVG, and a
 * placeholder is not an illustration — it is never returned. Herbs
 * that fail any link of the chain resolve to undefined and their card
 * renders exactly as before (emoji + name). That is the honest state
 * of the asset library today (2026-11-08 inventory: 1 of the 37
 * pattern-ally herbs qualifies — ginkgo; 3 more qualifying herbs sit
 * in the per-goal pools, which the advisor does not render as cards).
 * When a real asset is added — a Commons entry that passes the
 * correction audit, or a genuine file under public/images/herbs/ —
 * it qualifies by satisfying the same chain, not by editing callers.
 *
 * RENDERING PAIRING: the Commons hosts are allowlisted in img-src by
 * lib/security/csp.ts (2026-11-08, alongside this module) — before
 * that, even the herb library's Commons illustrations were silently
 * CSP-blocked. CC BY / CC BY-SA licenses REQUIRE attribution wherever
 * the image renders, so the resolver returns the credit line and the
 * card prints it under the image. Public-domain / CC0 entries carry
 * no such requirement and return no credit line.
 */
import {
  BOTANICAL_ILLUSTRATIONS,
  ILLUSTRATION_CREDITS,
} from '../herbs/illustrations';

export interface AllyIllustration {
  /** Image URL (Wikimedia Commons, per the verification chain above). */
  src: string;
  /**
   * Attribution line that MUST render wherever the image renders —
   * present only when the license requires it (CC BY / CC BY-SA).
   */
  credit?: string;
  /** License of the image, e.g. 'CC BY 3.0'. */
  license: string;
  /** Canonical Wikimedia Commons file page for the image. */
  sourceUrl: string;
}

const COMMONS_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org'];

function isCommonsUrl(url: string): boolean {
  return COMMONS_HOSTS.some((host) => url.startsWith(`https://${host}/`));
}

function buildRegistry(): ReadonlyMap<string, AllyIllustration> {
  const registry = new Map<string, AllyIllustration>();
  for (const [slug, credit] of Object.entries(ILLUSTRATION_CREDITS)) {
    const src = BOTANICAL_ILLUSTRATIONS[slug];
    if (!src || !isCommonsUrl(src)) continue;
    registry.set(slug, {
      src,
      ...(credit.license.startsWith('CC BY')
        ? { credit: credit.attribution }
        : {}),
      license: credit.license,
      sourceUrl: credit.sourceUrl,
    });
  }
  return registry;
}

/** Slugs whose illustration passed the full verification chain. */
export const VERIFIED_ILLUSTRATION_SLUGS: readonly string[] = [
  ...buildRegistry().keys(),
].sort();

const REGISTRY = buildRegistry();

/**
 * The verified botanical illustration for a catalog herb id, or
 * undefined when no authentic, renderable asset exists for it.
 * Callers render an image ONLY on a non-undefined return.
 */
export function allyIllustrationFor(
  catalogHerbId: string,
): AllyIllustration | undefined {
  return REGISTRY.get(catalogHerbId);
}
