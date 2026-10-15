/**
 * /order-status — customer order lookup (Phase 2).
 *
 * The customer side of order tracking. Until now the site had NO
 * order-status view: checkout ended at a static confirmation page and a
 * tracking number had nowhere to be shown. This page is the view: the
 * customer enters the order ID from their confirmation plus the email
 * they ordered with, and POST /api/orders/status answers only when both
 * match the order record (one generic failure message — nothing here
 * can be used to enumerate orders).
 *
 * When the owner has recorded a tracking number for the order, the
 * result shows it with its public carrier link (USPS by default).
 */
import type { Metadata } from 'next';
import { OrderStatusForm } from './OrderStatusForm';
import { BRAND_NAME } from '../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Order Status',
  description: `Check the status of your ${BRAND_NAME} order and track your shipment.`,
};

export default function OrderStatusPage() {
  return (
    <main
      id="main-content"
      aria-labelledby="order-status-title"
      style={{
        maxWidth: '36rem',
        margin: '0 auto',
        padding: '3rem 1.25rem 4rem',
      }}
    >
      <h1 id="order-status-title">Check your order status</h1>
      <p style={{ lineHeight: 1.7 }}>
        Enter the order ID from your confirmation and the email you
        ordered with. Amber confirms every order personally — and once
        your order ships, its tracking number will appear here.
      </p>

      <section
        aria-label="Order lookup form"
        style={{
          backgroundColor: 'var(--plum-mid)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          marginTop: '1.5rem',
        }}
      >
        <OrderStatusForm />
      </section>
    </main>
  );
}
