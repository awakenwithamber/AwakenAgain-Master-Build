/**
 * October seasonal feature banner — data-driven from lib/catalog/seasonal.ts.
 * HONESTY RULE (from the data's copyRule): the "Pumpkin Spice" name is a
 * scent theme only. NEVER state or imply pumpkin is an ingredient.
 */
import { getSeasonalFeature } from '../../lib/catalog/seasonal';

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
        <em>Scent-theme naming only — pumpkin is not an ingredient in this soap.</em>
      </p>
      {feature.availability ? <p>{feature.availability}</p> : null}
      <p>
        <a href="/shop">Explore the Soap of the Month</a>
      </p>
    </section>
  );
}
