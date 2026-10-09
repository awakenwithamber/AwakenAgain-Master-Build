/**
 * /checkout/cancel — Stripe payment cancelled page.
 *
 * Shown when the customer cancels out of Stripe Checkout.
 * Their cart is preserved (we only clear on successful redirect).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '../../../components/shop/SiteHeader';
import { BRAND_NAME } from '../../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Checkout Cancelled',
  description: `Your card checkout at ${BRAND_NAME} was cancelled. Your cart is still saved.`,
};

export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string }>;
}) {
  const { order_id } = await searchParams;

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
          🌙
        </p>
        <h1
          style={{
            fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
            fontSize: '2rem',
            color: '#d4af37',
            margin: '0 0 1.5rem',
          }}
        >
          Checkout Cancelled
        </h1>
        <p style={{ fontSize: '1.1rem', lineHeight: 1.7, margin: '0 0 2rem' }}>
          No worries — your card was not charged and your cart is still saved.
          You can try again or pay with Cash App / Venmo instead.
        </p>
        <div
          style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <Link
            href="/checkout"
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
            Try Again
          </Link>
          <Link
            href="/cart"
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
            Review Cart
          </Link>
        </div>
        {order_id ? (
          <p style={{ fontSize: '0.85rem', color: '#b08d2a', marginTop: '2rem' }}>
            Order reference: {order_id}
          </p>
        ) : null}
      </main>
    </>
  );
}
