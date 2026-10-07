/**
 * /herbal-library/[herb] — per-herb detail pages (workstream E, G7).
 *
 * Botanical illustration hero + "View botanical card" trigger (workstream E).
 * The full archive entries are not yet verified/migrated, so each page
 * renders an honest "entry in preparation" state with the herb's canonical
 * name + categories. Unknown slugs 404 via notFound().
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import InPreparation from '../../../components/content/InPreparation';
import { ViewBotanicalCardButton } from '../../../components/herbs/ViewBotanicalCardButton';
import { HERB_INDEX, getHerb } from '../../../lib/content/herbs';
import { getHerbRecord } from '../../../lib/herbs/herb-data';

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
  const record = slug ? getHerbRecord(slug) : undefined;
  return {
    title: herb ? `${herb.name} — Herb Library` : 'Herb Library',
    description: herb
      ? `${herb.name} (${herb.latin}) — botanical illustration and library entry at Amber's Alchemy Apothecary.`
      : "Amber's Alchemy Apothecary herb library.",
    ...(record?.illustration
      ? {
          openGraph: {
            images: [{ url: record.illustration }],
          },
        }
      : {}),
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
  const record = getHerbRecord(slug);

  return (
    <main id="main-content" className="page content-page">
      <h1>
        {herb.name} <em>({herb.latin})</em>
      </h1>

      {record?.illustration && (
        <figure className="aa-herb-hero">
          <img
            src={record.illustration}
            alt={`Botanical illustration of ${herb.name}`}
            loading="eager"
          />
        </figure>
      )}

      <InPreparation
        title={`${herb.name} (${herb.latin})`}
        whatIsComing={`The full library entry for ${herb.name} — traditional uses, preparation methods, and safety notes — is being written for this new site. Nothing here is placeholder text; the entry simply isn't ready yet.`}
      />

      <p>
        <ViewBotanicalCardButton slug={slug} name={herb.name} />
      </p>

      <p>
        Categories: {herb.categories.join(' · ')} ·{' '}
        <Link href="/herb-index">Back to the Herb Index</Link>
      </p>
    </main>
  );
}
