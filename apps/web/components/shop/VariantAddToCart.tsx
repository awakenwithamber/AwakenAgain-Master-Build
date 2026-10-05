/**
 * Add-to-cart control for catalog products that are NOT individually
 * customized soaps: variant radio (from catalog data) + quantity + add.
 * Pricing is PREVIEW — the server recomputes authoritatively at checkout.
 */
'use client';

import { useState } from 'react';
import { toCents } from '../../lib/pricing/pricing';
import { PriceDisplay } from '../catalog/PriceDisplay';
import { useCart } from '../checkout/cart-store';
import type { Product } from '../../types';

interface Props {
  product: Product;
}

function variantLabel(v: NonNullable<Product['variants']>[number]): string {
  return String(v.name ?? v.size ?? v.variant_id ?? 'Option');
}

/** Deterministic variant identity — mirrors the server's resolver. */
export function variantIdentity(
  v: NonNullable<Product['variants']>[number],
): string {
  return String(v.variant_id ?? v.name ?? v.sku ?? '');
}

export function VariantAddToCart({ product }: Props) {
  const { addItem } = useCart();
  const variants = product.variants ?? [];
  const [variantIdx, setVariantIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = variants[variantIdx];
  const priceCents =
    typeof chosen?.price === 'number'
      ? toCents(chosen.price)
      : typeof product.price === 'number'
        ? toCents(product.price)
        : null;

  if (priceCents === null) return null;

  const handleAdd = () => {
    setError(null);
    const variantId =
      variants.length > 0 && chosen ? variantIdentity(chosen) : undefined;
    const ok = addItem(product.handle, variantId, undefined, quantity);
    if (!ok) {
      setError('Could not add to cart — please try again.');
      return;
    }
    setAdded(true);
  };

  return (
    <div>
      {variants.length > 0 ? (
        <fieldset>
          <legend>Choose an option</legend>
          {variants.map((v, i) => (
            <label key={variantIdentity(v) || i}>
              <input
                type="radio"
                name={`${product.handle}-variant`}
                checked={i === variantIdx}
                onChange={() => setVariantIdx(i)}
              />
              {variantLabel(v)}
              {typeof v.price === 'number' ? (
                <>
                  {' '}— <PriceDisplay cents={toCents(v.price)} />
                </>
              ) : null}
            </label>
          ))}
        </fieldset>
      ) : (
        <p>
          Price: <PriceDisplay cents={priceCents} />
        </p>
      )}
      <label>
        Quantity
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
        />
      </label>
      <button type="button" onClick={handleAdd}>
        Add to Cart — <PriceDisplay cents={priceCents * quantity} /> (preview)
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {added ? (
        <p>
          Added to your cart. <a href="/cart">Review cart</a>
        </p>
      ) : null}
    </div>
  );
}
