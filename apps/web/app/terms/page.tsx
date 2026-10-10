/**
 * /terms — terms of service (G7 LEGAL).
 *
 * Plain-language terms: payments (Cash App/Venmo only), shipping,
 * handmade variation, reviews, services. Not legal advice.
 */
import type { Metadata } from 'next';
import { BRAND_EMAIL, BRAND_NAME, BRAND_PHONE_DISPLAY } from '../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `Terms of service for purchasing from ${BRAND_NAME}.`,
};

const UPDATED = '2026-10-05';

export default function TermsPage() {
  return (
    <main id="main-content" className="page content-page">
      <h1>Terms of Service</h1>
      <p className="legal-updated">Last updated: {UPDATED}</p>

      <h2>Who we are</h2>
      <p>
        {BRAND_NAME} (“we”, “us”) is a small-batch apothecary based in Salt
        Lake City, Utah, selling handcrafted botanical soaps, capsules,
        balms, digital content, and services through this website.
      </p>

      <h2>Payments</h2>
      <p>
        We accept <strong>Cash App ($AmberPatten347)</strong> and{' '}
        <strong>Venmo (@AwakenwithAmber)</strong> only. At checkout you will
        see exact payment instructions; your order is confirmed once we
        receive your payment. Prices are shown in USD and are validated on
        our server — the totals we display are previews, and the
        server-confirmed total governs.
      </p>

      <h2>Shipping & fulfillment</h2>
      <p>
        Shipping is free on orders over $45, and always free for Living
        Grimoire subscribers. Orders are handcrafted and typically ship
        within 3–5 business days where operationally accurate. You will
        be notified if a delay affects your order.
      </p>

      <h2>Handmade variation</h2>
      <p>
        Every product is made by hand in small batches. Natural variation in
        color, scent, and texture is normal and does not qualify as a defect.
      </p>

      <h2>Reviews</h2>
      <p>
        By submitting a review you grant us permission to display it (with
        your display name) on this site after moderation. Reviews containing
        medical claims, hateful content, or spam will not be published.
      </p>

      <h2>Services & readings</h2>
      <p>
        Services are offered for spiritual, reflective, and entertainment
        purposes only. Booking details for each service are being confirmed;
        services arranged directly with us are confirmed by email before any
        payment is sent.
      </p>

      <h2>Intellectual property</h2>
      <p>
        Journal articles, Living Grimoire content, product formulations, and
        site copy are the property of {BRAND_NAME}. You may share links and
        brief excerpts with attribution; please do not republish full works.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, our liability for any claim
        arising from your use of this site or our products is limited to the
        amount you paid for the product or service at issue.
      </p>

      <p className="legal-nv">
        ⚠ NEEDS VERIFICATION — plain-language small-business terms, not legal
        advice. Owner attorney review required before treating them as final.
      </p>

      <p>
        Questions? <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a> ·{' '}
        {BRAND_PHONE_DISPLAY}
      </p>
    </main>
  );
}
