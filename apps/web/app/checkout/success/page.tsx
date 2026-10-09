/**
 * /checkout/success — Stripe payment confirmation page.
 *
 * Shown after Stripe redirects back from a successful card payment.
 * The webhook (/api/webhooks/stripe) is the payment source of truth;
 * this page confirms to the customer and clears any residual cart state.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '../../../components/shop/SiteHeader';
import { BRAND_NAME } from '../../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Payment Successful',
  description: `Your payment to ${BRAND_NAME} was successful.`,
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  return (
    <>
      <SiteHeader />
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
        <p aria-hidden="true" style={{ fontSize: '3rem', margin: '0 0 1rem' }}>
          ✨
        </p>
        <h1
          style={{
            fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
            fontSize: '2rem',
            color: '#d4af37',
            margin: '0 0 1.5rem',
          }}
        >
          Payment Successful
        </h1>
        <p style={{ fontSize: '1.1rem', lineHeight: 1.7, margin: '0 0 1rem' }}>
          Thank you! Your card payment has been received. Amber will confirm
          your order personally via email before fulfillment.
        </p>
        {session_id ? (
          <p
            style={{
              fontSize: '0.9rem',
              color: '#b08d2a',
              margin: '0 0 2rem',
            }}
          >
            Reference: {session_id.slice(0, 24)}…
          </p>
        ) : null}
        <div
          style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <Link
            href="/shop"
            style={{
              display: 'inline-block',
              fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
              background: 'linear-gradient(135deg, #d4af37, #b8912f)',
              color: '#150b26',
              borderRadius: '30px',
              padding: '0.9rem 2rem',
              textDecoration: 'none',
            }}
          >
            Continue Shopping
          </Link>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
              border: '1px solid rgba(212,175,55,0.5)',
              color: '#d4af37',
              borderRadius: '30px',
              padding: '0.9rem 2rem',
              textDecoration: 'none',
            }}
          >
            Back Home
          </Link>
        </div>
      </main>
    </>
  );
}
