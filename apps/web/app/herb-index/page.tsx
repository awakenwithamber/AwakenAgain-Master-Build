/**
 * /herb-index — Herb Explorer + botanical archive index (workstream E, G7).
 *
 * Search the archive by symptom/concern, then open any result's botanical
 * index card. Below the explorer, the full canonical index links out to the
 * per-herb library entries (29 herbs; full entries are being written and
 * render honest "in preparation" states until verified).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { HERB_CATEGORIES, HERB_INDEX } from '../../lib/content/herbs';
import { HerbExplorer } from '../../components/herbs/HerbExplorer';

export const metadata: Metadata = {
  title: 'Herb Index',
  description:
    "Search the botanical archive of Amber's Alchemy Apothecary by symptom or concern — herbs, roots, flowers, and mushrooms.",
};

export default function HerbIndexPage() {
  return (
    <main id="main-content" className="page content-page">
      <h1>🌿 Herb Index</h1>
      <p>
        Our botanical archive holds 300+ herbs, roots, flowers, and mushrooms
        from traditions around the world. Start with the explorer below, or
        browse the archive.
      </p>

      <HerbExplorer />

      <h2>Browse by category</h2>
      <ul className="herb-categories">
        {HERB_CATEGORIES.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <h2>Featured herbs</h2>
      <ul className="herb-index-list">
        {HERB_INDEX.map((h) => (
          <li key={h.slug}>
            <Link href={`/herbal-library/${h.slug}`}>
              {h.name} <em>({h.latin})</em>
            </Link>
            <span className="herb-index-cats">{h.categories.join(' · ')}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
