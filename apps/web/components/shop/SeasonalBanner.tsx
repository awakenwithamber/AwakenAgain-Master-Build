/**
 * Seasonal feature banner — data-driven from lib/catalog/seasonal.ts.
 * HONESTY RULE: a theme name is a scent theme only, and the banner's
 * honesty line renders the SERVED entry's own copyRule from the data
 * (owner decision 2026-11-09 — each month shows its own rule; the line
 * was previously hard-coded to October's pumpkin sentence and rendered
 * under every month). NEVER state or imply a theme food is an ingredient.
 */
import { getSeasonalFeature } from '../../lib/catalog/seasonal';
import { getAsset } from '../../lib/media/image-manifest';
import Link from 'next/link';

export function SeasonalBanner() {
  const now = new Date();
  const feature = getSeasonalFeature(now.getMonth() + 1, now.getFullYear());
  if (!feature) return null;
  // Feature imagery comes from the registry, never a bare path: render
  // only when the entry's image slot resolves to a real (non-MISSING)
  // asset. Entries without a registered real image render text-only,
  // exactly as before.
  const image = feature.image_slot_id ? getAsset(feature.image_slot_id) : undefined;
  const showImage = image && image.provenance !== 'MISSING_ASSET' ? image : undefined;
  return (
    <section aria-label="Seasonal feature">
      <h2>
        {feature.name} — {feature.tagline}
      </h2>
      {showImage ? <img src={showImage.path} alt={showImage.depicts} /> : null}
      <p>{feature.copy}</p>
      <p>
        <em>{feature.copyRule}</em>
      </p>
      {feature.availability ? <p>{feature.availability}</p> : null}
      <p>
        <Link href="/shop">Explore the Soap of the Month</Link>
      </p>
    </section>
  );
}
