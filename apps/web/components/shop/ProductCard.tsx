/**
 * Product card for the shop index — server component.
 * Honest availability: inventory is NEEDS_VERIFICATION across the catalog,
 * so cards never claim "in stock"; pricing shows the canonical price.
 */
import { PriceDisplay } from '../catalog/PriceDisplay';
import type { Product } from '../../types';

export function ProductCard({ product }: { product: Product }) {
  const hasPrice = typeof product.price === 'number';
  return (
    <article>
      <h3>
        <a href={`/shop/${product.handle}`}>{product.title}</a>
      </h3>
      <p>{product.category}</p>
      {product.short_description ? <p>{product.short_description}</p> : null}
      <p>
        {hasPrice ? (
          <>
            <PriceDisplay cents={Math.round((product.price as number) * 100)} />
            {typeof product.subscriber_price === 'number' ? (
              <span>
                {' '}
                — Grimoire subscriber{' '}
                <PriceDisplay cents={Math.round((product.subscriber_price as number) * 100)} />
              </span>
            ) : null}
          </>
        ) : (
          <span>Pricing not yet established — contact us.</span>
        )}
      </p>
      <p>
        <small>Availability: being confirmed — we&apos;ll confirm before fulfillment.</small>
      </p>
    </article>
  );
}
