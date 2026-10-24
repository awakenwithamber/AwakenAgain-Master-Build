/**
 * /checkout/success — order confirmation page.
 *
 * A general "order confirmed" landing page. Payment on this site is by
 * emailed invoice or by Cash App / Venmo, and Amber
 * confirms every order personally — so this page simply thanks the
 * customer, points them to their email for confirmation, and links the
 * order-status lookup (/order-status) where shipment tracking appears
 * once the owner records it.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ProfileInvite } from '../../../components/personalization/ProfileInvite';
import { BRAND_NAME } from '../../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Order Confirmed',
  description: `Your order with ${BRAND_NAME} is confirmed.`,
};

export default function CheckoutSuccessPage() {
  return (
    <>
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
          email before fulfillment — watch your inbox for your confirmation
          and payment details.
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
            href="/order-status"
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
            Check Order Status
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
        <ProfileInvite moment="order-success" />
      </main>
    </>
  );
}
