/**
 * Service card — client component (workstream G).
 *
 * Spec §7: image → name → desc → $price (when published) → "Book This
 * Service ✦" (existing addToCart). Services without a published price never
 * get one invented — they link to contact for arrangement instead.
 */
'use client';

import { useState } from 'react';
import { PriceDisplay } from '../catalog/PriceDisplay';
import { toCents } from '../../lib/pricing/pricing';
import { useCart } from '../checkout/cart-store';
import type { ServiceEntry } from '../../lib/content/services';
import styles from '../../app/services/services.module.css';

export function ServiceCard({ service }: { service: ServiceEntry }) {
  const { addItem } = useCart();
  const [imageFailed, setImageFailed] = useState(false);
  const [booked, setBooked] = useState(false);

  const hasPrice = typeof service.price === 'number';

  const book = () => {
    const ok = addItem(service.handle, undefined, undefined, 1);
    if (ok) {
      setBooked(true);
      window.setTimeout(() => setBooked(false), 2200);
    }
  };

  return (
    <article className={styles.serviceCard}>
      <div className={styles.serviceImage}>
        {imageFailed ? (
          <div className={styles.imageFallback} aria-hidden="true">
            ✦
          </div>
        ) : (
          <img
            src={`/images/services/${service.handle}.webp`}
            alt={service.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        )}
      </div>
      <div className={styles.serviceBody}>
        <p className={styles.serviceCategory}>{service.category}</p>
        <h2 className={styles.serviceName}>{service.title}</h2>
        {service.shortDescription ? (
          <p className={styles.serviceDesc}>{service.shortDescription}</p>
        ) : null}
        <div className={styles.serviceFoot}>
          <span className={styles.servicePrice}>
            {hasPrice ? (
              <PriceDisplay cents={toCents(service.price as number)} />
            ) : (
              'Price on inquiry'
            )}
          </span>
          {booked ? (
            <span className={styles.addedNote} role="status">
              In your cart ✓
            </span>
          ) : hasPrice ? (
            <button
              type="button"
              className="btn-primary"
              onClick={book}
              aria-label={`Book ${service.title}`}
            >
              Book This Service ✦
            </button>
          ) : (
            <a className="btn-secondary" href="/contact">
              Inquire ✦
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
