/**
 * /checkout/success — order confirmation page.
 *
 * A general "order confirmed" landing page. Payment on this site is by
 * Cash App / Venmo or by an emailed Bookipi card invoice, and Amber
 * confirms every order personally — so this page simply thanks the
 * customer and points them to their email for confirmation.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '../../../components/shop/SiteHeader';
import { BRAND_NAME } from '../../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Order Confirmed',
  description: `Your order with ${BRAND_NAME} is confirmed.`,
};

export default function CheckoutSuccessPage() {
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
          Order Confirmed
        </h1>
        <p style={{ fontSize: '1.1rem', lineHeight: 1.7, margin: '0 0 1rem' }}>
          Thank you! Your order is in. Amber will confirm it personally via
          email before fulfillment — and if you chose to pay by card, your
          secure Bookipi invoice will arrive by email shortly.
        </p>
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
