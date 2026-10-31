/**
 * /checkout/return — order payment-status landing page.
 *
 * DISPLAY ONLY. This page reads the order + its paid state through
 * the shared resolver (lib/orders/paid-state.ts) and shows where
 * things stand — including a refund or dispute when one has been
 * recorded on the order. It never marks anything paid: paid state
 * comes only from a merchant-recorded payment (the manual
 * confirmation ledger for today's emailed-invoice flow, or the
 * legacy card-payment ledger for historical orders). Orders today
 * are paid by emailed invoice — ACH bank transfer, Venmo, or Cash
 * App — and Amber confirms those payments by hand, so a just-paid
 * order can read "being confirmed" here until she records it. The
 * page points at the order-status lookup and does not guess.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { defaultOrderStore } from '../../../lib/stores/order-store';
import { resolveOrderPaidState } from '../../../lib/orders/paid-state';
import { BRAND_NAME } from '../../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Payment Status',
  description: `Your payment status with ${BRAND_NAME}.`,
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
                Your payment for order <strong>{order?.order_id}</strong>{' '}
                was refunded. If you have questions about your refund,
                please contact Amber.
              </>
            ) : (
              <>
                A payment dispute was opened for order{' '}
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
            Thank you! Your payment for order{' '}
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
            Your order <strong>{order.order_id}</strong> is placed.
            Orders are paid by emailed invoice — you can pay by ACH bank
            transfer, Venmo, or Cash App, using your order number as the
            payment reference. Amber confirms every payment by hand, so
            if you have already paid, your status can take a little
            while to update — you can check any time on the{' '}
            <Link href="/order-status" style={{ color: '#d4af37' }}>
              order status page
            </Link>{' '}
            with your order ID and email. If you have not received your
            invoice yet, your order is still saved — just contact Amber
            and she will help you finish.
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
            We could not find an order matching that link. Check your
            order on the{' '}
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
