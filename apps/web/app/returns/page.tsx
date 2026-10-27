/**
 * /returns — Returns & Refunds policy (Fix-All Stage 4, audit R-23).
 *
 * Terms are the owner's approved decision of 2026-10-21 (~09:02 MDT,
 * §13(7)) — see lib/policies.ts. Nothing beyond those terms is stated:
 * no restocking fees, no return-shipping charges, and no refund
 * timelines were approved, so none appear here. Behind the
 * POLICY_APPROVED flag: if approval is ever withdrawn, the page falls
 * back to the interim "contact us" statement rather than publishing
 * unapproved terms.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND_EMAIL, BRAND_NAME } from '../../lib/seo/config';
import { isPolicyApproved } from '../../lib/policies';

export const metadata: Metadata = {
  title: 'Returns & Refunds',
  description: `Returns and refunds policy for ${BRAND_NAME}.`,
};

const UPDATED = '2026-10-21';

export default function ReturnsPage() {
  const approved = isPolicyApproved('returns');
  return (
    <main id="main-content" className="page content-page">
      <h1>Returns &amp; Refunds</h1>
      <p className="legal-updated">Last updated: {UPDATED}</p>

      {!approved ? (
        <section aria-label="Returns">
          <p>
            Our returns policy is being finalized. If something is not
            right with your order, please contact us at{' '}
            <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a> and we
            will help you arrange a return or another resolution.
          </p>
        </section>
      ) : (
        <>
          <section aria-label="Returns">
            <h2>Returns</h2>
            <p>
              Unopened items may be returned within 30 days of delivery.
            </p>
            <p>
              Opened consumables are final sale — with one exception: if
              an item arrives damaged, or we sent you the wrong item, we
              will make it right regardless of whether the item has been
              opened.
            </p>
            <p>
              To arrange a return, or to report a damaged or wrong item,
              contact us at{' '}
              <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a> — we
              will help you arrange the return from there.
            </p>
          </section>

          <section aria-label="About your order">
            <h2>About your order</h2>
            <p>
              Every item is handmade by Amber, and orders ship in 3–5
              business days. Natural variation in color, scent, and
              texture is a normal part of handmade goods and is not a
              defect — but a damaged item is always covered by the
              exception above.
            </p>
          </section>

          <section aria-label="Subscriptions and the Living Grimoire unlock">
            <h2>Subscriptions and the Living Grimoire unlock</h2>
            <p>
              Living Grimoire subscriptions can be cancelled anytime
              from your <Link href="/account">account page</Link> or the
              Customer Portal, and your access continues through the end
              of the paid period.
            </p>
            <p>
              The $8.88 permanent unlock is not a subscription.
              Cancelling a subscription never affects it — the unlock
              stays yours. If an unlock purchase itself is refunded, the
              unlock is revoked, as stated in its purchase terms.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
