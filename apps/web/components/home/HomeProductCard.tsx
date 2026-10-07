/**
 * Best Sellers product card — client component.
 *
 * Card anatomy (Netlify fidelity): image → category badge → name →
 * benefit line → short description → key-botanical HerbChips →
 * "Why This Works" herb list → price + Add button.
 *
 * Pricing is DISPLAY ONLY from the canonical catalog (integer cents);
 * the cart store and server recompute authoritatively at checkout.
 * Product images resolve to /images/products/<handle>.webp and hide
 * gracefully when the asset is not yet present.
 */
'use client';

import { useState } from 'react';
import { HerbChip } from '@/components/herbs/HerbChip';
import { PriceDisplay } from '../catalog/PriceDisplay';
import { useCart } from '../checkout/cart-store';
import type { HomeProductCardModel } from './product-cards';
import styles from './home.module.css';

export function HomeProductCard({ product }: { product: HomeProductCardModel }) {
  const { addItem } = useCart();
  const [imgVisible, setImgVisible] = useState(true);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    setError(null);
    const ok = addItem(product.handle, product.variantId, undefined, 1);
    if (!ok) {
      setError('Could not add to cart — please try again.');
      return;
    }
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2500);
  };

  return (
    <li>
      <article className={styles.productCard}>
        <div className={styles.productImageWrap}>
          {imgVisible ? (
            <img
              className={styles.productImage}
              src={product.imageSrc}
              alt={`${product.title} — Amber's Alchemy Apothecary`}
              loading="lazy"
              onError={() => setImgVisible(false)}
            />
          ) : (
            <span className={styles.productImageFallback} aria-hidden="true">
              {product.fallbackEmoji}
            </span>
          )}
        </div>
        <div className={styles.productBody}>
          <span className={styles.productBadge}>{product.category}</span>
          <h3 className={styles.productName}>
            <a href={`/shop/${product.handle}`}>{product.title}</a>
          </h3>
          {product.benefitLine ? (
            <p className={styles.productBenefit}>{product.benefitLine}</p>
          ) : null}
          {product.shortDescription ? (
            <p className={styles.productDesc}>{product.shortDescription}</p>
          ) : null}
          {product.herbChips.length > 0 ? (
            <div className={styles.herbChips} aria-label="Key botanicals">
              {product.herbChips.map((h) => (
                <HerbChip key={h.slug} herb={h.slug} label={h.label} />
              ))}
            </div>
          ) : null}
          {product.whyItWorks.length > 0 ? (
            <ul className={styles.whyItWorks} aria-label="Why this works">
              {product.whyItWorks.map((w) => (
                <li key={w.name}>
                  <strong>{w.name}</strong>
                  {w.role ? ` — ${w.role}` : null}
                </li>
              ))}
            </ul>
          ) : null}
          <div className={styles.productFoot}>
            <span className={styles.productPrice}>
              <PriceDisplay cents={product.priceCents} />
            </span>
            <button
              type="button"
              className={styles.addButton}
              onClick={handleAdd}
              disabled={added}
            >
              {added ? 'Added ✓' : 'Add'}
            </button>
          </div>
          {error ? (
            <p className={styles.addError} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </article>
    </li>
  );
}
