/**
 * Seasonal feature banner — data-driven from lib/catalog/seasonal.ts.
 * HONESTY RULE: a theme name is a scent theme only, and the banner's
 * honesty line renders the SERVED entry's own copyRule from the data
 * (owner decision 2026-11-09 — each month shows its own rule; the line
 * was previously hard-coded to October's pumpkin sentence and rendered
 * under every month). NEVER state or imply a theme food is an ingredient.
 */
import { getSeasonalFeature } from '../../lib/catalog/seasonal';
import Link from 'next/link';

export function SeasonalBanner() {
  const now = new Date();
  const feature = getSeasonalFeature(now.getMonth() + 1, now.getFullYear());
  if (!feature) return null;
  return (
    <section aria-label="Seasonal feature">
      <h2>
        {feature.name} — {feature.tagline}
      </h2>
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
