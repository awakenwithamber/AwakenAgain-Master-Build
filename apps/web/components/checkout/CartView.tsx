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
import { useCart, cartItemTitle } from './cart-store';
import { previewCartTotals, FREE_SHIPPING_GENERAL_CENTS } from './cart-preview';
import { ProfileInvite } from '../personalization/ProfileInvite';

export function CartView() {
  const { items, bundle, loaded, removeItem, updateQuantity, setBundle, clear } =
    useCart();
  const [isSubscriber, setIsSubscriber] = useState(false);

  if (!loaded) return <p>Loading your cart…</p>;

  const preview = previewCartTotals(items, bundle, isSubscriber);
  const empty = items.length === 0 && !bundle;

  return (
    <>
      <main className="cart-main">
        <h1>Your Cart</h1>
        {empty ? (
          <p>
            Your cart is empty. <a href="/shop">Browse the shop</a>
          </p>
        ) : (
          <>
            <ul className="cart-items">
              {items.map((item) => {
                const custom = item.customization;
                const formula = item.formula;
                return (
                  <li key={item.id} className="cart-item">
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
                        className="cart-qty-input"
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
                        className="cart-btn"
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
                <li className="cart-item">
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
                    <button
                      type="button"
                      className="cart-btn"
                      onClick={() => setBundle(null)}
                    >
                      Remove bundle
                    </button>
                  </p>
                </li>
              ) : null}
            </ul>

            <label className="cart-subscriber">
              <input
                type="checkbox"
                checked={isSubscriber}
                onChange={(e) => setIsSubscriber(e.target.checked)}
              />
              I&apos;m a Living Grimoire subscriber (always free shipping)
            </label>

            <section aria-label="Order summary (preview)" className="cart-summary">
              <h2>Summary — preview</h2>
              <p>Subtotal: {formatPrice(preview.subtotalCents)}</p>
              {preview.subscriberDiscountCents > 0 ? (
                <p>
                  Living Grimoire subscriber discount (10%): −
                  {formatPrice(preview.subscriberDiscountCents)}{' '}
                  <small>
                    (applied when your membership is confirmed — verified at
                    checkout)
                  </small>
                </p>
              ) : null}
              <p>
                Shipping:{' '}
                {preview.shippingStatus === 'FREE'
                  ? isSubscriber
                    ? 'Free — Living Grimoire subscribers always ship free.'
                    : `Free — shipping is free on orders of ${formatPrice(preview.freeShippingThresholdCents)} or more.`
                  : `To be confirmed — no shipping charge is added to this order; we confirm the shipping cost with you before fulfillment. Shipping is free on orders of ${formatPrice(FREE_SHIPPING_GENERAL_CENTS)} or more, and always free for Living Grimoire subscribers.`}
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

            <ProfileInvite moment="cart" />

            <p>
              <a href="/checkout" className="btn-primary">
                Proceed to checkout
              </a>
            </p>
            <p>
              <button type="button" className="cart-btn" onClick={clear}>
                Clear cart
              </button>
            </p>
          </>
        )}
      </main>
    </>
  );
}
