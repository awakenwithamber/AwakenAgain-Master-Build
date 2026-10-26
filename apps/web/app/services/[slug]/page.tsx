/**
 * /services/[slug] — individual service landing pages (Phase 2, 2026-10-14).
 *
 * Server component following the /shop/[slug] precedent. Content comes
 * from lib/content/service-pages.ts; price, title, and safety copy are
 * read from the mapped catalog record so they can never drift from the
 * shop. Booking uses the EXISTING mechanisms only:
 * - priced record → VariantAddToCart (the shop's own component; the
 *   server re-derives the total at checkout),
 * - unpriced or brand-new service → the inquiry path (contact page,
 *   email, phone) — no price is ever invented for these pages.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  SERVICE_PAGES,
  getServicePage,
  getServicePageRecord,
  servicePagePath,
} from '../../../lib/content/service-pages';
import { serviceSafetyCopy } from '../../../lib/content/service-safety';
import { PriceDisplay } from '../../../components/catalog/PriceDisplay';
import { VariantAddToCart } from '../../../components/shop/VariantAddToCart';
import { InterestTracker } from '../../../components/personalization/InterestTracker';
import styles from '../services.module.css';
import Link from 'next/link';

export function generateStaticParams() {
  return SERVICE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getServicePage(slug);
  if (!page) return { title: 'Service not found' };
  return {
    title: page.title,
    description: page.metaDescription,
    openGraph: {
      title: `${page.title} — Amber's Alchemy Apothecary`,
      description: page.metaDescription,
      type: 'website',
    },
  };
}

export default async function ServiceLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getServicePage(slug);
  if (!page) notFound();

  const record = getServicePageRecord(page);
  const price = typeof record?.price === 'number' ? record.price : null;
  const subscriberPrice =
    typeof record?.subscriber_price === 'number' ? record.subscriber_price : null;
  // Safety copy is cleaned at render (lib/content/service-safety):
  // the record's warnings + combined disclaimer repeat each other and
  // carry internal "(Sourced from …)" tags — deduped and stripped here,
  // records themselves untouched.
  const safetyCopy = serviceSafetyCopy(record);
  const related = page.relatedSlugs
    .map((s) => getServicePage(s))
    .filter((p) => p !== undefined);

  return (
    <main id="main-content" className={styles.detailMain}>
      {page.interestCategory ? (
        <InterestTracker
          category={page.interestCategory}
          signalKey={`service-${page.slug}`}
        />
      ) : null}
      <p className={styles.detailBack}>
        <Link href="/services">← All services</Link>
      </p>

      <div className={styles.detailHero}>
        {page.image ? (
          <figure className={styles.detailFigure}>
            <img
              src={`/images/services/${page.image}`}
              alt={page.imageAlt}
              className={styles.detailImage}
            />
            <figcaption>
              <small>Illustrated representation.</small>
            </figcaption>
          </figure>
        ) : (
          <div className={styles.detailFallback} aria-hidden="true">
            ✦
          </div>
        )}
        <p className={styles.serviceCategory}>{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <p className={styles.detailDelivery}>{page.deliveryNote}</p>
        {price !== null ? (
          <p className={styles.detailPrice}>
            <PriceDisplay cents={Math.round(price * 100)} />
            {subscriberPrice !== null ? (
              <span>
                {' '}
                · Living Grimoire of Light & Magic subscriber{' '}
                <PriceDisplay cents={Math.round(subscriberPrice * 100)} />
              </span>
            ) : null}
          </p>
        ) : (
          <p className={styles.detailPriceNote}>
            Price on inquiry — arranged personally, never guessed.
          </p>
        )}
      </div>

      <section aria-label="About this service" className={styles.detailSection}>
        {page.intro.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </section>

      <section aria-label="What is included" className={styles.detailSection}>
        <h2>What a session includes</h2>
        <ul className={styles.detailList}>
          {page.includes.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section aria-label="How it works" className={styles.detailSection}>
        <h2>How it works</h2>
        <ol className={styles.detailList}>
          {page.process.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>

      <section aria-label="Good to know" className={styles.detailSection}>
        <h2>Good to know</h2>
        {page.goodToKnow.map((note, i) => (
          <p key={i}>{note}</p>
        ))}
      </section>

      <section aria-label="Book or arrange this service" className={styles.bookingBox}>
        {price !== null && record ? (
          <>
            <h2>Book this service</h2>
            <VariantAddToCart product={record} />
            <p>
              <small>
                Booking details are confirmed with you personally after
                booking.
              </small>
            </p>
          </>
        ) : (
          <>
            <h2>Arrange this service</h2>
            <p>
              This service is arranged personally — pricing and scheduling
              are confirmed with Amber directly, so nothing is ever guessed
              or sprung on you.
            </p>
            <p>
              <Link className="btn-primary" href="/contact">
                Contact Amber ✦
              </Link>
            </p>
            <p>
              <small>
                Or write to{' '}
                <a href="mailto:Amber@awakenagain.com">Amber@awakenagain.com</a>{' '}
                or call{' '}
                <a href="tel:+18018196795">(801) 819-6795</a>.
              </small>
            </p>
          </>
        )}
      </section>

      {safetyCopy.length > 0 ? (
        <section aria-label="Safety" className={styles.detailSection}>
          <h2>Safety</h2>
          {safetyCopy.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </section>
      ) : null}

      {related.length > 0 ? (
        <section aria-label="Related services" className={styles.detailSection}>
          <h2>Related services</h2>
          <ul className={styles.relatedList}>
            {related.map((rel) => (
              <li key={rel.slug}>
                <Link href={servicePagePath(rel.slug)}>{rel.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
