/**
 * Product-page FAQ — Phase 1 Batch 3 (server component).
 *
 * Generic ordering questions, identical on every product page. Every fact
 * is verified against the staged tree's own sources:
 * - Shipping: lib/checkout/order.ts (owner decision 2026-10-20) — flat
 *   $5.95 below the $45 general threshold, free at/above it, always free
 *   for verified Living Grimoire subscribers; lib/content/faqs.ts agrees.
 * - Fulfilment: Order email Template 1 (owner-selected 2026-10-19) —
 *   handmade by Amber, ships in 3–5 business days, customer notified at
 *   shipping.
 * - Payment: lib/checkout/order.ts payment-method note (owner directive
 *   2026-10-24) — Bookipi invoice emailed; paid by ACH bank transfer to
 *   Bluevine, Venmo @AwakenwithAmber, or Cash App $AmberPatten347, order
 *   number as the payment reference. app/checkout/page.tsx metadata
 *   states the same flow.
 */
export function ProductFaq() {
  return (
    <section aria-label="Frequently asked questions">
      <h2>Frequently Asked Questions</h2>

      <details>
        <summary>How much is shipping?</summary>
        <p>
          Shipping is $5.95 on orders under $45 — free at $45 or more, and
          always free for Living Grimoire members.
        </p>
      </details>

      <details>
        <summary>When will my order ship?</summary>
        <p>
          Every order is handmade to order by Amber and ships in 3–5
          business days. You are emailed when your order ships.
        </p>
      </details>

      <details>
        <summary>How do I pay?</summary>
        <p>
          We email you a Bookipi invoice — pay it by ACH bank transfer to
          Bluevine, Venmo @AwakenwithAmber, or Cash App $AmberPatten347,
          using your order number as the reference.
        </p>
      </details>

      <details>
        <summary>Is this product right for me?</summary>
        <p>
          See the Safety section on this page for this product&apos;s
          cautions, and talk to your healthcare provider before use if you
          are pregnant, nursing, or taking medication.
        </p>
      </details>
    </section>
  );
}
