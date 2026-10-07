/**
 * /services — Healing Services (workstream G).
 *
 * Spec §7: service cards (image, name, desc, $price, "Book This Service ✦"
 * → addToCart). Titles/prices are catalog-sourced so they never drift from
 * the shop; booking mechanics are not yet published, so each card says so
 * honestly rather than inventing a booking flow.
 */
import type { Metadata } from 'next';
import { SiteHeader } from '../../components/shop/SiteHeader';
import { ServiceCard } from '../../components/services/ServiceCard';
import { SERVICES } from '../../lib/content/services';
import { BRAND_NAME } from '../../lib/seo/config';
import styles from './services.module.css';

export const metadata: Metadata = {
  title: 'Healing Services',
  description: `Healing services, consultations, and readings from ${BRAND_NAME} — book directly from the apothecary.`,
};

export default function ServicesPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className={styles.servicesMain}>
        <div className={styles.servicesHero}>
          <p className="section-ornament" aria-hidden="true">
            ✦
          </p>
          <h1>Healing Services</h1>
          <p>
            Personal guidance from the apothecary — consultations, readings,
            and energy work with Amber. Choose a service to begin; booking
            details are confirmed with you personally after booking.
          </p>
        </div>
        <div className={styles.serviceGrid}>
          {SERVICES.map((service) => (
            <ServiceCard key={service.handle} service={service} />
          ))}
        </div>
        <p className={styles.servicesContact}>
          Prefer to talk first? <a href="/contact">Contact Amber</a> — every
          message is read personally.
        </p>
      </main>
    </>
  );
}
