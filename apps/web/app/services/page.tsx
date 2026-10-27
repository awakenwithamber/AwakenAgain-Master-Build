/**
 * /services — Spiritual Services & Readings (workstream G).
 *
 * Spec §7: service cards (image, name, desc, $price, "Book This Service ✦"
 * → addToCart). Titles/prices are catalog-sourced so they never drift from
 * the shop; booking mechanics are not yet published, so each card says so
 * honestly rather than inventing a booking flow.
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
  description: `Spiritual services, consultations, and readings from ${BRAND_NAME} — book directly from the apothecary.`,
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
          {/* Spiritual services intro — owner-approved copy, Version 1 of
              the 2026-10-26 three-version set (website version). */}
          <h2 className={styles.servicesTagline}>
            Awaken Your Spirit. Reconnect With Your Soul. ✨
          </h2>
          <p>
            Are you navigating a major life transition, searching for
            clarity, or feeling called toward something greater?
          </p>
          <p>
            Explore the services below to discover spiritual guidance,
            intuitive coaching, energy work, and transformative experiences
            designed to support your journey toward greater happiness,
            balance, and inner peace.
          </p>
          <p>
            As an intuitive medium, I experience a deep connection with the
            spiritual realms, existing in the sacred space between the
            physical world and the unseen.
          </p>
          <p>
            I believe the bonds of love transcend time, distance, and even
            death. Through mediumship sessions, I offer a compassionate
            space to explore spiritual connections with loved ones who have
            passed, seeking meaningful messages, comfort, guidance, and the
            possibility of emotional closure.
          </p>
          <p>
            <strong>
              Your journey doesn&rsquo;t end when life changes. Sometimes,
              that&rsquo;s where your awakening begins.
            </strong>
          </p>
          <p className={styles.servicesClosing}>
            🌙 Awaken your intuition. Reclaim your energy. Rediscover your
            magic.
          </p>
          <p>
            Choose a service to begin; booking details are confirmed with
            you personally after booking.
          </p>
        </div>
        <div className={styles.serviceGrid}>
          {SERVICES.map((service) => (
            <ServiceCard key={service.handle} service={service} />
          ))}
        </div>
        <section className={styles.exploreSection} aria-label="Services in depth">
          <h2>Services in Depth</h2>
          <p className={styles.exploreIntro}>
            Each service, explored properly — what it is, what a session
            includes, and how to begin.
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
          Prefer to talk first? <Link href="/contact">Contact Amber</Link> — every
          message is read personally.
        </p>
      </main>
    </>
  );
}
