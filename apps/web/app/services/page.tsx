/**
 * /services — services & readings (G7).
 *
 * Server-rendered from lib/content/services.ts (catalog-sourced titles and
 * prices). Booking mechanics are NOT published in the source — every
 * service carries an honest NEEDS_VERIFICATION marker instead of invented
 * booking flows, prices, or timelines.
 */
import type { Metadata } from 'next';
import { SERVICES } from '../../lib/content/services';
import { formatPrice, toCents } from '../../lib/pricing/pricing';
import { BRAND_EMAIL, BRAND_NAME, BRAND_PHONE_DISPLAY, BRAND_PHONE_TEL } from '../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Services & Readings',
  description: `Consultations, readings, and rituals from ${BRAND_NAME}. Booking details being confirmed.`,
};

export default function ServicesPage() {
  return (
    <main id="main-content" className="page content-page">
      <h1>Services & Readings</h1>
      <p className="page-lede">
        Personal guidance from the apothecary — consultations, readings, and
        energy work. Booking details for each service are being confirmed
        (marked below); in the meantime, every service can be arranged
        personally by email or phone.
      </p>
      <ul className="services-list">
        {SERVICES.map((s) => (
          <li key={s.handle} className="service-card">
            <h2>{s.title}</h2>
            <p className="service-category">{s.category}</p>
            {s.price !== null && (
              <p className="service-price">
                {formatPrice(toCents(s.price))}{' '}
                <span className="service-price-note">
                  (shop listing price; service delivery details to be confirmed)
                </span>
              </p>
            )}
            {s.shortDescription && <p>{s.shortDescription}</p>}
            <p className="service-booking-nv" role="note">
              ⚠ Booking details to be confirmed — NEEDS VERIFICATION
              <br />
              {s.bookingNote}
            </p>
          </li>
        ))}
      </ul>
      <p className="services-contact">
        Ready to book? <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a> ·{' '}
        <a href={BRAND_PHONE_TEL}>{BRAND_PHONE_DISPLAY}</a> — {BRAND_NAME} reads
        every message.
      </p>
    </main>
  );
}
