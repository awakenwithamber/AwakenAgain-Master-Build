/**
 * /herbal-library/[herb] — per-herb detail pages (Herbal Index,
 * owner directive 2026-10-21).
 *
 * Public store surface, separate from the Grimoire: no gating. Routes
 * cover every catalog record PLUS the original 29 canonical HERB_INDEX
 * slugs (four of those are aliases of catalog records and resolve to
 * the same entry — no route regressions). Detail content is the card
 * view-model verbatim: name, Latin, categories, the record's
 * traditionalBenefits as the "Properties:" folkloric list, and the
 * record's traditionalNote. Records whose data is incomplete carry an
 * honest "entry in preparation" label; a canonical slug with no
 * catalog record at all renders the honest InPreparation state.
 * Unknown slugs 404 via notFound(). Records carrying sourced
 * references (Herbal Index Phase 1 overlay) render a "References &
 * further reading" list here — detail pages only, never on the
 * compact index cards.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import InPreparation from '../../../components/content/InPreparation';
import { InterestTracker } from '../../../components/personalization/InterestTracker';
import { ViewBotanicalCardButton } from '../../../components/herbs/ViewBotanicalCardButton';
import { HerbalIllustrationSlot } from '../../../components/herbs/HerbalIndexCard';
import { getHerb } from '../../../lib/content/herbs';
import {
  getHerbalCard,
  herbalRouteParams,
} from '../../../lib/herbal-index/cards';

export function generateStaticParams() {
  return herbalRouteParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ herb: string }>;
}): Promise<Metadata> {
  const { herb: slug } = await params;
  const card = getHerbalCard(slug);
  const entry = getHerb(slug);
  const name = card?.name ?? entry?.name;
  const latin = card?.latin ?? entry?.latin;
  return {
    title: name ? `${name} — Herb Library` : 'Herb Library',
    description:
      name && latin
        ? `${name} (${latin}) — botanical index card and library entry at Amber's Alchemy Apothecary.`
        : "Amber's Alchemy Apothecary herb library.",
    ...(card?.illustrationRenderable && card.illustrationUrl
      ? {
          openGraph: {
            images: [{ url: card.illustrationUrl }],
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
  const card = getHerbalCard(slug);
  const entry = getHerb(slug);
  if (!card && !entry) notFound();

  if (!card && entry) {
    // Canonical library slug with no catalog record yet: keep the
    // honest "in preparation" state rather than inventing an entry.
    return (
      <main id="main-content" className="page content-page">
        <InterestTracker category="herbs" signalKey={`herb-${slug}`} />
        <InPreparation
          title={`${entry.name} (${entry.latin})`}
          whatIsComing={`The full library entry for ${entry.name} — traditional uses, preparation methods, and safety notes — is being written for this new site. Nothing here is placeholder text; the entry simply isn't ready yet.`}
        />
        <p>
          Categories: {entry.categories.join(' · ')} ·{' '}
          <Link href="/herb-index">Back to the Herb Index</Link>
        </p>
      </main>
    );
  }

  if (!card) notFound();
  const categories =
    entry?.categories ?? card.categoryLabels;

  return (
    <main id="main-content" className="page content-page">
      <InterestTracker category="herbs" signalKey={`herb-${slug}`} />
      <article className="aa-herbal-card aa-herbal-detail">
        <div className="aa-herbal-body">
          <h1 className="aa-herbal-name">
            {card.name} <em className="aa-herbal-latin">({card.latin})</em>
          </h1>

          <HerbalIllustrationSlot card={card} large />

          {card.benefitsIncomplete && (
            <p className="aa-herbal-incomplete">
              Entry in preparation — this archive entry is still being
              completed. What is recorded so far is shown below, exactly as
              it stands.
            </p>
          )}

          <h2 className="aa-herbal-props-title">Properties:</h2>
          <p className="aa-herbal-framing">
            Traditional &amp; folkloric uses, as recorded in the apothecary
            archive:
          </p>
          {card.properties.length > 0 ? (
            <ul className="aa-herbal-props">
              {card.properties.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="aa-herbal-props-empty">No properties recorded yet.</p>
          )}
          {card.benefitsIncomplete && card.properties.length > 0 && (
            <p className="aa-herbal-incomplete">
              {card.benefitsListed} of 5 properties recorded so far.
            </p>
          )}

          <p className="aa-herbal-note">{card.note}</p>

          {card.caution && (
            <p className="aa-herbal-caution">
              <strong>Caution:</strong> {card.caution}
            </p>
          )}

          {card.references && card.references.length > 0 && (
            <section className="aa-herbal-references">
              <h2 className="aa-herbal-props-title">
                References &amp; further reading
              </h2>
              <ul className="aa-herbal-refs">
                {card.references.map((ref) => (
                  <li key={`${ref.kind}-${ref.label}`}>
                    {ref.url ? (
                      <a href={ref.url} target="_blank" rel="noreferrer">
                        {ref.label}
                      </a>
                    ) : (
                      ref.label
                    )}
                    {` — ${ref.body}`}
                    {ref.unverified && (
                      <em> (unverified — search by title)</em>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {entry && (
            <p>
              <ViewBotanicalCardButton slug={slug} name={card.name} />
            </p>
          )}

          <p>
            Categories: {categories.join(' · ')} ·{' '}
            <Link href="/herb-index">Back to the Herb Index</Link>
          </p>
        </div>
      </article>
    </main>
  );
}
