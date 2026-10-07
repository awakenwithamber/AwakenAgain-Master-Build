/**
 * Ritual bundle card — client component (workstream G).
 *
 * Shown first on the shop page (spec §7): image → title → benefit chips →
 * short description → price + "Begin the Ritual ✦" (existing addToCart).
 * Savings values are computed from the canonical pricing table, never
 * hard-coded — and only shown for the owner-confirmed Alchemy Soap
 * Collection (superseded bundles never carry savings claims).
 */
'use client';

import { useState } from 'react';
import { PriceDisplay } from '../catalog/PriceDisplay';
import {
  BUNDLE_ID,
  bundleSavingsCents,
  bundleSavingsPct,
  formatPrice,
  toCents,
} from '../../lib/pricing/pricing';
import { useCart } from '../checkout/cart-store';
import type { Product } from '../../types';
import styles from './shop.module.css';

function benefitChips(product: Product): string[] {
  const raw = product.properties;
  const chips: string[] = [];
  if (Array.isArray(raw)) {
    for (const p of raw) {
      if (typeof p === 'string') chips.push(p);
      else if (p && typeof p === 'object') {
        const rec = p as Record<string, unknown>;
        if (typeof rec.property === 'string') chips.push(rec.property);
      }
      if (chips.length >= 4) break;
    }
  }
  if (chips.length === 0 && Array.isArray(product.tags)) {
    for (const t of product.tags.slice(0, 4)) {
      if (typeof t === 'string') chips.push(t);
    }
  }
  return chips.slice(0, 4);
}

export function RitualBundleCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [imageFailed, setImageFailed] = useState(false);
  const [added, setAdded] = useState(false);

  const chips = benefitChips(product);
  const hasPrice = typeof product.price === 'number';
  const isAlchemyCollection = product.handle === BUNDLE_ID;

  const beginRitual = () => {
    const ok = addItem(product.handle, undefined, undefined, 1);
    if (ok) {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 2200);
    }
  };

  return (
    <article className={styles.bundleCard}>
      <div className={styles.bundleImage}>
        {imageFailed ? (
          <div className={styles.imageFallback} aria-hidden="true">
            🎁
          </div>
        ) : (
          <img
            src={`/images/products/${product.handle}.webp`}
            alt={product.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        )}
      </div>
      <div className={styles.bundleBody}>
        <h3>{product.title}</h3>
        {chips.length > 0 ? (
          <div className={styles.bundleChips} aria-label="Bundle benefits">
            {chips.map((chip) => (
              <span key={chip} className={styles.benefitChip}>
                {chip}
              </span>
            ))}
          </div>
        ) : null}
        {product.short_description ? (
          <p className={styles.bundleDesc}>{product.short_description}</p>
        ) : null}
        {isAlchemyCollection && hasPrice ? (
          <p className={styles.bundleSavings}>
            You save {formatPrice(bundleSavingsCents())} ({bundleSavingsPct()}%)
            versus buying the five styles individually.
          </p>
        ) : null}
        <div className={styles.bundleFoot}>
          <span className="product-card-price">
            {hasPrice ? (
              <PriceDisplay cents={toCents(product.price as number)} />
            ) : (
              'Price on inquiry'
            )}
          </span>
          {added ? (
            <span className={styles.addedNote} role="status">
              Ritual begun ✓ — in your cart
            </span>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={beginRitual}
              disabled={!hasPrice}
            >
              Begin the Ritual ✦
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
