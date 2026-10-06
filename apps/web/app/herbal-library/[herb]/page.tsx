/**
 * /herbal-library/[herb] — per-herb detail pages (G7).
 *
 * The full archive entries are not yet verified/migrated, so each page
 * renders an honest "entry in preparation" state with the herb's canonical
 * name + categories. Unknown slugs 404 via notFound().
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import InPreparation from '../../../components/content/InPreparation';
import { HERB_INDEX, getHerb } from '../../../lib/content/herbs';

export function generateStaticParams() {
  return HERB_INDEX.map((h) => ({ herb: h.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ herb: string }>;
}): Promise<Metadata> {
  const { herb: slug } = await params;
  const herb = getHerb(slug);
  return {
    title: herb ? `${herb.name} — Herb Library` : 'Herb Library',
    description: herb
      ? `${herb.name} (${herb.latin}) — entry in preparation at Amber's Alchemy Apothecary.`
      : "Amber's Alchemy Apothecary herb library.",
  };
}

export default async function HerbDetailPage({
  params,
}: {
  params: Promise<{ herb: string }>;
}) {
  const { herb: slug } = await params;
  const herb = getHerb(slug);
  if (!herb) notFound();
  return (
    <main id="main-content" className="page content-page">
      <InPreparation
        title={`${herb.name} (${herb.latin})`}
        whatIsComing={`The full library entry for ${herb.name} — traditional uses, preparation methods, and safety notes — is being written for this new site. Nothing here is placeholder text; the entry simply isn't ready yet.`}
      />
      <p>
        Categories: {herb.categories.join(' · ')} ·{' '}
        <Link href="/herb-index">Back to the Herb Index</Link>
      </p>
    </main>
  );
}
