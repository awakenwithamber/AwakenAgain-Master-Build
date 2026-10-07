/**
 * /journal — Apothecary Journal index (workstream G).
 *
 * Server-rendered from lib/content/journal.ts (owner-published articles).
 * Each card carries a header imagery slot wired to
 * /images/journal/<slug>.webp (workstream H may populate later) with a
 * graceful fallback — no broken-image icons when assets are absent.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '../../components/shop/SiteHeader';
import { JournalImage } from './JournalImage';
import { JOURNAL_ARTICLES } from '../../lib/content/journal';
import { BRAND_NAME } from '../../lib/seo/config';
import styles from './journal.module.css';

export const metadata: Metadata = {
  title: 'Apothecary Journal',
  description: `Botanical wisdom, ancient herbal rituals, and the stories behind the plants — the living journal of ${BRAND_NAME}.`,
};

export default function JournalPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className={styles.journalMain}>
        <p className="section-ornament" aria-hidden="true">
          ✦
        </p>
        <h1>📖 {BRAND_NAME} Journal</h1>
        <p className={styles.journalLede}>
          Botanical wisdom, ancient herbal rituals, and the stories behind the
          plants — a living record of nature&apos;s intelligence.
        </p>
        <div className={styles.journalGrid}>
          {JOURNAL_ARTICLES.map((a) => (
            <article key={a.slug} className={styles.journalCard}>
              <div className={styles.journalCardImage}>
                <JournalImage slug={a.slug} title={a.title} />
              </div>
              <div className={styles.journalCardBody}>
                <span className={styles.journalTag}>{a.tag}</span>
                <h2>
                  <Link href={`/journal/${a.slug}`}>{a.title}</Link>
                </h2>
                <p className={styles.journalExcerpt}>{a.excerpt}</p>
                <p className={styles.journalWisdom}>“{a.wisdom}”</p>
                <p className={styles.journalHerbs}>
                  🌿 Key herbs: {a.keyHerbs.join(', ')}
                </p>
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
