/**
 * /herb-index — the Herbal Index (owner directive 2026-10-21).
 *
 * Its OWN public store surface, fully separate from the Grimoire: no
 * entitlement, subscription, or gating code is involved in this route.
 *
 * Search the archive with the Herb Explorer, then browse the full card
 * grid: one parchment card per catalog record (built to reach 333 herb
 * cards as approved additions land in the catalog — the grid is derived
 * from the records, so additions appear with no code change). Card
 * content is verbatim from each record; entries whose archive record is
 * still incomplete say so on the card itself.
 */
import type { Metadata } from 'next';
import { HERB_CATEGORIES } from '../../lib/content/herbs';
import {
  HERBAL_CARDS,
  herbalIndexManifest,
} from '../../lib/herbal-index/cards';
import { HerbExplorer } from '../../components/herbs/HerbExplorer';
import { HerbalIndexCardView } from '../../components/herbs/HerbalIndexCard';
import { InterestTracker } from '../../components/personalization/InterestTracker';

export const metadata: Metadata = {
  title: 'Herbal Encyclopedia',
  description:
    "Search the botanical archive of Amber's Alchemy Apothecary by symptom or concern — herbs, roots, flowers, and mushrooms.",
};

export default function HerbIndexPage() {
  const manifest = herbalIndexManifest();
  return (
    <main id="main-content" className="page content-page">
      <InterestTracker category="herbs" signalKey="herb-index" />
      <h1>🌿 Herbal Encyclopedia</h1>
      {/* Owner-supplied Herb & Ingredient Library header art (2026-10-23;
          registered as asset_brand_herbal_library_header in
          lib/media/image-manifest.ts). */}
      <img
        className="herb-index-header-art"
        src="/images/brand/herbal-library-header.jpg"
        alt="Herb & Ingredient Library — an open botanical herbal under a moon-phase arch (owner-supplied artwork)"
        width={1012}
        height={1196}
        loading="lazy"
      />
      <p>
        Our botanical archive holds herbs, roots, flowers, and mushrooms from
        traditions around the world. Start with the explorer below, or browse
        the full card index.
      </p>
      <p>
        The index is being built to {manifest.targetCards} herb cards. It
        currently holds {manifest.totalRecords} archive entries —{' '}
        {manifest.herbRecords} of them herbs, roots, flowers, resins, oils,
        and mushrooms, the rest other traditional ingredients (vitamins,
        minerals, and the like) kept in the archive for the formula builders.
        Every card shows only what its archive record actually holds:
        properties are listed verbatim as traditional &amp; folkloric uses,
        and an entry that is still being completed says so on its card.
      </p>

      <HerbExplorer />

      <h2>Browse by category</h2>
      <ul className="herb-categories">
        {HERB_CATEGORIES.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <h2>All index cards</h2>
      <div className="aa-herbal-grid">
        {HERBAL_CARDS.map((card) => (
          <HerbalIndexCardView key={card.slug} card={card} />
        ))}
      </div>
    </main>
  );
}
