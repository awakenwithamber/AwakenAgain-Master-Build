/**
 * Variant-aware price display (QA defect D-1/D-3 fix, 2026-10-30).
 *
 * The product-page header and the sticky buy bar used to render the
 * record's BASE price fields forever — a tea buyer who selected the
 * $11.00 tea-bags variant still saw "$9.00 / subscriber $8.10" in the
 * header. This client component follows the variant selected in
 * VariantAddToCart (which broadcasts `aa:variant-selected` for its
 * product handle) and renders that variant's price instead.
 *
 * DISPLAY ONLY — charged prices are recomputed authoritatively by the
 * server at checkout, exactly as before. The subscriber figure mirrors
 * the checkout mechanic: the variant's own subscriber_price when the
 * record carries one, otherwise the generic 10% subscriber discount
 * (lib/checkout pricing: subscriberDiscountedCents = round(c × 0.9)),
 * and only for products that carry a subscriber price at all.
 */
'use client';

import { useEffect, useState } from 'react';
import { toCents } from '../../lib/pricing/pricing';
import { PriceDisplay } from '../catalog/PriceDisplay';
import type { Product } from '../../types';

export const VARIANT_SELECTED_EVENT = 'aa:variant-selected';

interface VariantLike {
  price?: number;
  subscriber_price?: number;
}

function variantPriceCents(product: Product, idx: number): number | null {
  const variants = (product.variants ?? []) as VariantLike[];
  const v = variants[idx];
  if (v && typeof v.price === 'number') return toCents(v.price);
  return typeof product.price === 'number' ? toCents(product.price) : null;
}

function variantSubscriberCents(
  product: Product,
  idx: number,
  priceCents: number,
): number | null {
  if (typeof product.subscriber_price !== 'number') return null;
  const variants = (product.variants ?? []) as VariantLike[];
  const v = variants[idx];
  if (v && typeof v.subscriber_price === 'number') {
    return toCents(v.subscriber_price);
  }
  // Generic 10% subscriber mechanic — the same figure checkout computes.
  return Math.round(priceCents * 0.9);
}

export function useSelectedVariant(product: Product): number {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const onSelect = (e: Event) => {
      const detail = (e as CustomEvent<{ handle?: string; index?: number }>)
        .detail;
      if (detail?.handle === product.handle && typeof detail.index === 'number') {
        setIdx(detail.index);
      }
    };
    window.addEventListener(VARIANT_SELECTED_EVENT, onSelect);
    return () => window.removeEventListener(VARIANT_SELECTED_EVENT, onSelect);
  }, [product.handle]);
  return idx;
}

/** Full header price block: "Price: $X · subscriber $Y". */
export function VariantPriceBlock({ product }: { product: Product }) {
  const idx = useSelectedVariant(product);
  const priceCents = variantPriceCents(product, idx);
  if (priceCents === null) return null;
  const subCents = variantSubscriberCents(product, idx, priceCents);
  return (
    <p>
      Price: <PriceDisplay cents={priceCents} />
      {subCents !== null ? (
        <span>
          {' '}
          · Living Grimoire of Light &amp; Magic subscriber{' '}
          <PriceDisplay cents={subCents} />
        </span>
      ) : null}
    </p>
  );
}

/** Bare price figure for the sticky buy bar. */
export function VariantPriceInline({ product }: { product: Product }) {
  const idx = useSelectedVariant(product);
  const priceCents = variantPriceCents(product, idx);
  if (priceCents === null) return null;
  return <PriceDisplay cents={priceCents} />;
}
