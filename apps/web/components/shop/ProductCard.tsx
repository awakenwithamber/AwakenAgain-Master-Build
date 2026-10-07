/**
 * Product card for the shop index — client component (workstream G).
 *
 * Spec §3 anatomy: image → category badge → name → inline reviews (omitted
 * when none exist — the review store ships with zero fabricated reviews) →
 * benefit line → "who it's for" (derived from the shop-by-goal mapping) →
 * short desc → key-botanical HerbChips → "Why This Works" herb list → price
 * + Add button.
 *
 * Images: /images/products/<slug>.webp (workstream H populates); graceful
 * onError fallback to a monogram tile. Prices display as-is from the
 * catalog — this component never computes or alters pricing.
 */
'use client';

import { useState } from 'react';
import { HerbChip } from '../herbs/HerbChip';
import { PriceDisplay } from '../catalog/PriceDisplay';
import { toCents } from '../../lib/pricing/pricing';
import { useCart } from '../checkout/cart-store';
import type { Product } from '../../types';
import styles from './shop.module.css';

const CATEGORY_ICONS: Record<string, string> = {
  Soaps: '🧼',
  Capsules: '💊',
  Teas: '🍵',
  'Balms & Skincare': '🫙',
  Bundles: '🎁',
  'Grimoire & Digital': '📖',
  'Custom & Consultations': '⚗️',
  Services: '✨',
};

function slugifyHerb(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface HerbEntry {
  name: string;
  role?: string | null;
}

/** featured_ingredients records (name + role/traditional use). */
function featuredHerbs(product: Product): HerbEntry[] {
  const raw = product.featured_ingredients;
  if (!Array.isArray(raw)) return [];
  const out: HerbEntry[] = [];
  for (const h of raw) {
    if (typeof h === 'string') {
      out.push({ name: h });
      continue;
    }
    if (h && typeof h === 'object') {
      const rec = h as Record<string, unknown>;
      const name = typeof rec.name === 'string' ? rec.name : null;
      if (!name) continue;
      const role =
        typeof rec.role_in_formula === 'string'
          ? rec.role_in_formula
          : typeof rec.traditional_use === 'string'
            ? rec.traditional_use
            : null;
      out.push({ name, role });
    }
  }
  return out.slice(0, 5);
}

/** properties records: { property, note } or plain strings. */
function propertiesList(product: Product): Array<{ property: string; note?: string }> {
  const raw = product.properties;
  if (!Array.isArray(raw)) return [];
  const out: Array<{ property: string; note?: string }> = [];
  for (const p of raw) {
    if (typeof p === 'string') {
      out.push({ property: p });
      continue;
    }
    if (p && typeof p === 'object') {
      const rec = p as Record<string, unknown>;
      if (typeof rec.property === 'string') {
        out.push({
          property: rec.property,
          note: typeof rec.note === 'string' ? rec.note : undefined,
        });
      }
    }
  }
  return out;
}

export interface ProductCardProps {
  product: Product;
  /** Goal labels (with icons) this product is mapped to — for "who it's for". */
  goalLabels?: string[];
}

export function ProductCard({ product, goalLabels = [] }: ProductCardProps) {
  const { addItem } = useCart();
  const [imageFailed, setImageFailed] = useState(false);
  const [added, setAdded] = useState(false);

  const herbs = featuredHerbs(product);
  const props = propertiesList(product);
  const benefit = props[0]?.property ?? null;
  const whyWorks =
    herbs.length > 0
      ? herbs.map((h) => ({ label: h.name, note: h.role ?? undefined }))
      : props.slice(0, 4).map((p) => ({ label: p.property, note: p.note }));

  const hasPrice = typeof product.price === 'number';
  const icon = CATEGORY_ICONS[product.category] ?? '🌿';

  const handleAdd = () => {
    const ok = addItem(product.handle, undefined, undefined, 1);
    if (ok) {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 2200);
    }
  };

  return (
    <article className="product-card">
      <div className="product-card-image">
        {imageFailed ? (
          <div className={styles.imageFallback} aria-hidden="true">
            {product.title.charAt(0)}
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
      <div className="product-card-body">
        <span className="product-card-badge">
          {icon} {product.category}
        </span>
        <h3 className="product-card-name">
          <a href={`/shop/${product.handle}`}>{product.title}</a>
        </h3>
        {/* Inline reviews: omitted — no fabricated reviews; the review store
            ships empty and only approved owner-moderated reviews may appear. */}
        {benefit ? <p className="product-card-benefit">{benefit}</p> : null}
        {goalLabels.length > 0 ? (
          <p className="product-card-who">
            <strong>Good for:</strong> {goalLabels.join(' · ')}
          </p>
        ) : null}
        {product.short_description ? (
          <p className="product-card-desc">{product.short_description}</p>
        ) : null}
        {herbs.length > 0 ? (
          <div className="product-card-herbs" aria-label="Key botanicals">
            {herbs.map((h) => (
              <HerbChip key={h.name} herb={slugifyHerb(h.name)} label={h.name} />
            ))}
          </div>
        ) : null}
        {whyWorks.length > 0 ? (
          <div className="product-card-why">
            <strong>Why this works</strong>
            <ul>
              {whyWorks.map((w) => (
                <li key={w.label}>
                  {w.label}
                  {w.note ? <span> — {w.note}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="product-card-foot">
          <div>
            {hasPrice ? (
              <>
                <span className="product-card-price">
                  <PriceDisplay cents={toCents(product.price as number)} />
                </span>
                {typeof product.subscriber_price === 'number' ? (
                  <div>
                    <small>
                      Grimoire subscriber{' '}
                      <PriceDisplay cents={toCents(product.subscriber_price)} />
                    </small>
                  </div>
                ) : null}
              </>
            ) : (
              <span className="product-card-price">Price on inquiry</span>
            )}
          </div>
          <div className={styles.cardCtaRow}>
            {added ? (
              <span className={styles.addedNote} role="status">
                Added ✓
              </span>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={handleAdd}
                disabled={!hasPrice}
                aria-label={`Add ${product.title} to cart`}
              >
                Add ✦
              </button>
            )}
          </div>
        </div>
        {!hasPrice ? (
          <p>
            <small>
              Pricing not yet established — <a href="/contact">contact us</a>.
            </small>
          </p>
        ) : null}
      </div>
    </article>
  );
}
