/**
 * /journal — Apothecary Journal index (G7).
 *
 * Server-rendered from lib/content/journal.ts (owner-published articles).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { JOURNAL_ARTICLES } from '../../lib/content/journal';
import { BRAND_NAME } from '../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Apothecary Journal',
  description: `Botanical wisdom, ancient herbal rituals, and the stories behind the plants — the living journal of ${BRAND_NAME}.`,
};

export default function JournalPage() {
  return (
    <main id="main-content" className="page journal-page">
      <h1>📖 {BRAND_NAME} Journal</h1>
      <p className="page-lede">
        Botanical wisdom, ancient herbal rituals, and the stories behind the
        plants — a living record of nature's intelligence.
      </p>
      <div className="journal-grid">
        {JOURNAL_ARTICLES.map((a) => (
          <article key={a.slug} className="journal-card">
            <span className="journal-tag">{a.tag}</span>
            <h2>
              <Link href={`/journal/${a.slug}`}>{a.title}</Link>
            </h2>
            <p>{a.excerpt}</p>
            <p className="journal-wisdom">“{a.wisdom}”</p>
            <p className="journal-herbs-used">
              🌿 Key herbs: {a.keyHerbs.join(', ')}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}
