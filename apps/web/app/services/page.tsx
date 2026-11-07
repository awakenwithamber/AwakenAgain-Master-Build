/**
 * /services — Spiritual Services & Readings (workstream G).
 *
 * Spec §7: service cards (image, name, desc, $price, "Book This Service ✦"
 * → addToCart). Titles/prices are catalog-sourced so they never drift from
 * the shop; booking mechanics are not yet published, so each card says so
 * honestly rather than inventing a booking flow.
 *
 * Copy rewrite 2026-11-07 (owner direction): the page speaks in the
 * house's mystical, botanical voice, with every offering explained in
 * plain words and metaphor a newcomer can hold. The free-consultation
 * call to action follows the site's booking canon (see app/links):
 * every booking CTA points at /contact, where the consultation is
 * arranged personally — no booking system is invented here.
 */
import type { Metadata } from 'next';
import { ServiceCard } from '../../components/services/ServiceCard';
import { SERVICES } from '../../lib/content/services';
import {
  SERVICE_PAGES,
  servicePagePath,
} from '../../lib/content/service-pages';
import { InterestTracker } from '../../components/personalization/InterestTracker';
import { BRAND_NAME } from '../../lib/seo/config';
import styles from './services.module.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Spiritual Services & Readings',
  description: `Spiritual services, readings, cleansings, ceremonies, and guidance from ${BRAND_NAME} — offered with heart and arranged personally.`,
};

export default function ServicesPage() {
  return (
    <>
      <main id="main-content" className={styles.servicesMain}>
        <InterestTracker category="readings" signalKey="services" />
        <div className={styles.servicesHero}>
          <p className="section-ornament" aria-hidden="true">
            ✦
          </p>
          <h1>Spiritual Services &amp; Readings</h1>
          {/* Spiritual services intro — rewritten 2026-11-07 under the
              owner's direction, carrying forward her approved lines
              from the 2026-10-26 website version. */}
          <h2 className={styles.servicesTagline}>
            Awaken Your Spirit. Reconnect With Your Soul. ✨
          </h2>
          <p>
            Are you standing at a crossroads, walking through a season of
            change, or feeling something old and quiet calling your name?
          </p>
          <p>
            Below are the doorways this house offers: readings that hold
            up a mirror, cleansings that clear the old weather out of a
            home or a heart, guided journeys into the deeper rooms of
            your own story, protections like a hedge planted around a
            garden, ceremonies that mark life&rsquo;s thresholds, and
            guidance for the road between them. Each one is explained
            plainly, with a little moonlight on it — because magic you
            cannot understand is magic you cannot use.
          </p>
          <p>
            As an intuitive medium, I experience a deep connection with
            the spiritual realms, existing in the sacred space between
            the physical world and the unseen.
          </p>
          <p>
            I believe the bonds of love transcend time, distance, and
            even death. Through mediumship sessions, I offer a
            compassionate space to explore spiritual connections with
            loved ones who have passed, seeking meaningful messages,
            comfort, guidance, and the possibility of emotional closure.
          </p>
          <p>
            <strong>
              Your journey doesn&rsquo;t end when life changes. Sometimes,
              that&rsquo;s where your awakening begins.
            </strong>
          </p>
          <p className={styles.servicesClosing}>
            🌙 Awaken your intuition. Reclaim your energy. Rediscover
            your magic.
          </p>
          <p>
            Choose a service to begin; booking details are confirmed with
            you personally after booking.
          </p>
        </div>
        <section
          className={styles.exploreSection}
          aria-label="Free consultation"
        >
          <h2>Not Sure Where to Begin? ✦</h2>
          <p className={styles.exploreIntro}>
            Call for a free consultation, and I will ask a few questions
            and we will find what is right for you.
          </p>
          <p>
            No pressure, no script, and nothing to buy on the call — just
            a conversation about where you are and which doorway fits.
            Consultations are arranged personally through the contact
            page: tell me you would like a free consultation, and we will
            find a time together.
          </p>
          <p>
            <Link className="btn-primary" href="/contact">
              Book a Free Consultation ✦
            </Link>{' '}
            <a className="btn-primary" href="tel:+18018196795">
              Call (801) 819-6795
            </a>
          </p>
          <p>
            And for every service arranged personally with me, I ask only
            for what you can pay, with integrity — the right work should
            not have to wait for the perfect budget.
          </p>
        </section>
        <div className={styles.serviceGrid}>
          {SERVICES.map((service) => (
            <ServiceCard key={service.handle} service={service} />
          ))}
        </div>
        <section className={styles.exploreSection} aria-label="Services in depth">
          <h2>Services in Depth</h2>
          <p className={styles.exploreIntro}>
            Every doorway, opened slowly — what each service truly is,
            what a session holds, and how to begin yours.
          </p>
          <div className={styles.exploreGrid}>
            {SERVICE_PAGES.map((sp) => (
              <a
                key={sp.slug}
                className={styles.exploreCard}
                href={servicePagePath(sp.slug)}
              >
                <p className={styles.exploreEyebrow}>{sp.eyebrow}</p>
                <h3>{sp.title}</h3>
                <p>{sp.deliveryNote}</p>
              </a>
            ))}
          </div>
        </section>
        <p className={styles.servicesContact}>
          All readings and spiritual services here are offered for
          spiritual, reflective, and entertainment purposes — companions
          for your path, never a substitute for medical, legal, or
          professional care.
        </p>
        <p className={styles.servicesContact}>
          Prefer to talk first? <Link href="/contact">Contact Amber</Link> — every
          message is read personally.
        </p>
      </main>
    </>
  );
}
