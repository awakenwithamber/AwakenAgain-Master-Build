/**
 * /herb-index — browse the botanical archive by herb (G7).
 *
 * Index of canonical herb slugs + categories. Individual entries are not
 * yet written — detail pages render honest "in preparation" states.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { HERB_CATEGORIES, HERB_INDEX } from '../../lib/content/herbs';

export const metadata: Metadata = {
  title: 'Herb Index',
  description:
    "Browse the botanical archive of Amber's Alchemy Apothecary — herbs, roots, flowers, and mushrooms.",
};

export default function HerbIndexPage() {
  return (
    <main id="main-content" className="page content-page">
      <h1>🌿 Herb Index</h1>
      <p>
        Our botanical archive holds 300+ herbs, roots, flowers, and mushrooms
        from traditions around the world. Full entries are being written for
        this new site — below are the herbs featured in our quiz and journal
        so far.
      </p>
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
