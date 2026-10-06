/**
 * /herbal-wisdom — educational hub (G7).
 *
 * Honest shell: the wisdom-article archive is being migrated. Links to the
 * routes that DO have content (journal, herb index, quiz).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import InPreparation from '../../components/content/InPreparation';
import { BRAND_NAME } from '../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Herbal Wisdom',
  description: `Botanical education from ${BRAND_NAME} — wisdom articles are being prepared for this new site.`,
};

export default function HerbalWisdomPage() {
  return (
    <main id="main-content" className="page content-page">
      <InPreparation
        title="Herbal Wisdom"
        whatIsComing="Our full herbal wisdom archive — plant profiles, preparation guides, and seasonal rituals — is being migrated into this new site. In the meantime, these are live now:"
      />
      <ul className="content-links">
        <li>
          <Link href="/journal">Apothecary Journal</Link> — published botanical essays
        </li>
        <li>
          <Link href="/herb-index">Herb Index</Link> — browse the botanical archive
        </li>
        <li>
          <Link href="/quiz">Herbal Allies Quiz</Link> — discover your allies
        </li>
      </ul>
    </main>
  );
}
