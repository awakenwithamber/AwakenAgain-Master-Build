/**
 * /checkout/return — landing page after the embedded card checkout.
 *
 * DISPLAY ONLY. This page reads the order + its paid state through
 * the shared resolver (lib/orders/paid-state.ts) and shows where
 * things stand — including a Stripe refund/dispute when one has been
 * recorded. It never marks anything paid: paid state is written
 * exclusively by the signature-verified webhook
 * (app/api/stripe/webhook). If the webhook has not landed yet,
 * the page says payment is being confirmed and points at the
 * order-status lookup — it does not guess.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { defaultOrderStore } from '../../../lib/stores/order-store';
import { resolveOrderPaidState } from '../../../lib/orders/paid-state';
import { BRAND_NAME } from '../../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Payment Status',
  description: `Your card payment status with ${BRAND_NAME}.`,
};

export const dynamic = 'force-dynamic';

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; order_id?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.order_id ?? '';
  const orders = orderId
    ? await defaultOrderStore().listOrders({ limit: 1000 })
    : [];
  const order = orders.find((o) => o.order_id === orderId) ?? null;
  const paidState = order ? await resolveOrderPaidState(order) : null;
  const payment = paidState?.is_paid ? paidState.stripe_payment : null;

  return (
    <main
      id="main-content"
      style={{
        maxWidth: '44rem',
        margin: '0 auto',
        padding: '4rem 1.25rem',
        textAlign: 'center',
        background: '#150b26',
        color: '#d4af37',
        minHeight: '60vh',
      }}
    >
      {paidState?.status === 'refunded' || paidState?.status === 'disputed' ? (
        <>
          <h1
            style={{
              fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
              fontSize: '2rem',
              margin: '0 0 1.5rem',
            }}
          >
            {paidState.status === 'refunded'
              ? 'Payment Refunded'
              : 'Payment Disputed'}
          </h1>
          <p style={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
            {paidState.status === 'refunded' ? (
              <>
                Your card payment for order <strong>{order?.order_id}</strong>{' '}
                was refunded through Stripe. If you have questions about
                your refund, please contact Amber.
              </>
            ) : (
              <>
                A payment dispute was opened through Stripe for order{' '}
                <strong>{order?.order_id}</strong>. If that is unexpected,
                please contact Amber.
              </>
            )}{' '}
            You can check any time on the{' '}
            <Link href="/order-status" style={{ color: '#d4af37' }}>
              order status page
            </Link>{' '}
            with your order ID and email.
          </p>
        </>
      ) : payment ? (
        <>
          <p aria-hidden="true" style={{ fontSize: '3rem', margin: '0 0 1rem' }}>
            ✨
          </p>
          <h1
            style={{
              fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
              fontSize: '2rem',
              margin: '0 0 1.5rem',
            }}
          >
            Payment Confirmed
          </h1>
          <p style={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
            Thank you! Your card payment for order{' '}
            <strong>{order?.order_id}</strong> is confirmed. Amber is
            preparing your order — it will ship within 3 to 5 business
            days, and we will notify you when it ships.
          </p>
        </>
      ) : order ? (
        <>
          <h1
            style={{
              fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
              fontSize: '2rem',
              margin: '0 0 1.5rem',
            }}
          >
            Payment Being Confirmed
          </h1>
          <p style={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
            Your order <strong>{order.order_id}</strong> is placed and in
            review. If you completed your card payment, confirmation can
            take a few moments — you can check any time on the{' '}
            <Link href="/order-status" style={{ color: '#d4af37' }}>
              order status page
            </Link>{' '}
            with your order ID and email. If your payment was not
            completed, your order is still saved — just contact Amber and
            she will help you finish paying by card, invoice, Venmo, or
            Cash App.
          </p>
        </>
      ) : (
        <>
          <h1
            style={{
              fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
              fontSize: '2rem',
              margin: '0 0 1.5rem',
            }}
          >
            Let\u2019s Find Your Order
          </h1>
          <p style={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
            We could not match that payment link to an order here. Check
            your order on the{' '}
            <Link href="/order-status" style={{ color: '#d4af37' }}>
              order status page
            </Link>{' '}
            with your order ID and the email you ordered with.
          </p>
        </>
      )}
      <p style={{ marginTop: '2rem' }}>
        <Link href="/shop" style={{ color: '#d4af37' }}>
          Continue shopping
        </Link>
      </p>
    </main>
  );
}
