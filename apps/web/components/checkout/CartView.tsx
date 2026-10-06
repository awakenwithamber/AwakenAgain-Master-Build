/**
 * Cart view — client component. Renders items and the bundle from THE single
 * cart module (components/checkout/cart-store). All totals shown are PREVIEW;
 * the server recomputes authoritatively at checkout.
 */
'use client';

import { useState } from 'react';
import { getShape } from '../../lib/catalog/shapes';
import { getHerb } from '../../lib/catalog/herbs';
import { formatPrice } from '../../lib/pricing/pricing';
import { track } from '../../lib/analytics/posthog';
import { ANALYTICS_EVENT_NAMES } from '../../lib/analytics/events';
import { SiteHeader } from '../shop/SiteHeader';
import { useCart, cartItemTitle } from './cart-store';
import { previewCartTotals } from './cart-preview';

export function CartView() {
  const { items, bundle, loaded, removeItem, updateQuantity, setBundle, clear } =
    useCart();
  const [isSubscriber, setIsSubscriber] = useState(false);

  if (!loaded) return <p>Loading your cart…</p>;

  const preview = previewCartTotals(items, bundle, isSubscriber);
  const empty = items.length === 0 && !bundle;

  return (
    <>
      <SiteHeader />
      <main>
        <h1>Your Cart</h1>
        {empty ? (
          <p>
            Your cart is empty. <a href="/shop">Browse the shop</a>
          </p>
        ) : (
          <>
            <ul>
              {items.map((item) => {
                const custom = item.customization;
                const formula = item.formula;
                return (
                  <li key={item.id}>
                    <strong>
                      {cartItemTitle(item.product_handle, item.variant_id, formula)}
                    </strong>
                    {custom ? (
                      <p>
                        <small>
                          {getShape(custom.shape)?.name} · {custom.base} ·{' '}
                          {custom.scent.type === 'signature'
                            ? `Signature ${custom.scent.recipe_id}`
                            : `Custom blend: ${custom.scent.oils.join(' + ')}`}
                          {custom.botanical ? ` · ${custom.botanical}` : ''} ·{' '}
                          {custom.color}
                        </small>
                      </p>
                    ) : null}
                    {formula ? (
                      <p>
                        <small>
                          {formula.herb_ids
                            .map((id) => getHerb(id)?.name ?? id)
                            .join(', ')}
                          {formula.creation_name
                            ? ` · “${formula.creation_name}”`
                            : ''}
                        </small>
                      </p>
                    ) : null}
                    <p>
                      {formatPrice(item.unit_price_cents)} ×{' '}
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        aria-label={`Quantity for ${cartItemTitle(item.product_handle, item.variant_id, formula)}`}
                        onChange={(e) => {
                          updateQuantity(item.id, Number(e.target.value) || 1);
                          track(ANALYTICS_EVENT_NAMES.cartUpdated, {
                            action: 'qty_change',
                            product_handle: item.product_handle,
                            qty: Number(e.target.value) || 1,
                          });
                        }}
                      />{' '}
                      = {formatPrice(item.unit_price_cents * item.quantity)}
                      <button
                        type="button"
                        onClick={() => {
                          removeItem(item.id);
                          track(ANALYTICS_EVENT_NAMES.cartUpdated, {
                            action: 'remove',
                            product_handle: item.product_handle,
                          });
                        }}
                      >
                        Remove
                      </button>
                    </p>
                  </li>
                );
              })}
              {bundle ? (
                <li>
                  <strong>The Alchemy Soap Collection</strong>
                  <p>
                    <small>
                      5 individually customized soaps —{' '}
                      {bundle.slots
                        .map((s) => `${getShape(s.shape)?.name}`)
                        .join(', ')}
                    </small>
                  </p>
                  <p>
                    {formatPrice(preview.bundleTotalCents)}{' '}
                    <button type="button" onClick={() => setBundle(null)}>
                      Remove bundle
                    </button>
                  </p>
                </li>
              ) : null}
            </ul>

            <label>
              <input
                type="checkbox"
                checked={isSubscriber}
                onChange={(e) => setIsSubscriber(e.target.checked)}
              />
              I&apos;m a Living Grimoire subscriber ($75 free-shipping threshold)
            </label>

            <section aria-label="Order summary (preview)">
              <h2>Summary — preview</h2>
              <p>Subtotal: {formatPrice(preview.subtotalCents)}</p>
              <p>
                Shipping:{' '}
                {preview.shippingStatus === 'FREE'
                  ? `Free (over ${formatPrice(preview.freeShippingThresholdCents)})`
                  : 'To be confirmed — no shipping charge added to this order; we confirm with you before fulfillment.'}
              </p>
              <p>
                <strong>Total (preview): {formatPrice(preview.totalCents)}</strong>
              </p>
              <p>
                <small>
                  Preview totals are display only. The server recomputes every
                  total from canonical data when you place your order.
                </small>
              </p>
            </section>

            <p>
              <a href="/checkout">Proceed to checkout</a>
            </p>
            <p>
              <button type="button" onClick={clear}>
                Clear cart
              </button>
            </p>
          </>
        )}
      </main>
    </>
  );
}
