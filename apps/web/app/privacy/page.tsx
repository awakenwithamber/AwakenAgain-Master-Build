/**
 * /privacy — privacy policy (G7 LEGAL).
 *
 * Honest about what we actually collect and where it lives: quiz
 * leads and newsletter signups are stored with explicit consent;
 * order, account, and subscription records are stored in the site's
 * record stores (Postgres via Neon when DATABASE_URL is configured,
 * local data files otherwise — see lib/orders/store.ts
 * createOrderStore and lib/events/event-store.ts); card checkout runs
 * through Stripe's embedded checkout; Cash App and Venmo are manual
 * payment options; transactional email is sent via Resend; analytics
 * is PostHog (behavioral, no PII), consent-gated. No fabricated
 * compliance claims.
 *
 * The "Analytics & personalization" section (added 2026-10-14) describes
 * the consent-gated PostHog setup and the on-device interest profile
 * exactly as implemented in lib/personalization + lib/analytics — copy
 * flagged for the owner's legal review like the rest of this page.
 *
 * Stage 1 (2026-10-21, audit truth-in-copy): corrected the earlier
 * statements that checkout used "Cash App and Venmo only" and that
 * lead/review records were "stored locally… will migrate" — neither
 * described the current stack.
 */
import type { Metadata } from 'next';
import { BRAND_EMAIL, BRAND_NAME } from '../../lib/seo/config';
import { PrivacyChoices } from '../../components/privacy/PrivacyChoices';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${BRAND_NAME} collects, uses, and protects your information.`,
};

const UPDATED = '2026-10-21';

export default function PrivacyPage() {
  return (
    <main id="main-content" className="page content-page">
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: {UPDATED}</p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Quiz leads:</strong> if you share your name and email to
          receive Herbal Allies Quiz results, we store them with your explicit
          consent so we can send your results and occasional apothecary notes.
        </li>
        <li>
          <strong>Newsletter signups:</strong> email address and signup
          placement, stored only with your explicit consent.
        </li>
        <li>
          <strong>Reviews:</strong> display name, rating, and review text you
          submit — published only after moderation approval.
        </li>
        <li>
          <strong>Orders:</strong> when you place an order we store your
          name, email, optional phone and order notes, the items ordered,
          the order totals, and the payment method you chose, so we can
          fulfill the order and show its status. We never store card
          details (see Payments below).
        </li>
        <li>
          <strong>Accounts &amp; memberships:</strong> if you create an
          account or join the Living Grimoire membership, we store your
          email and the account and subscription records tied to it
          (such as saved quiz results, likes, and membership status).
        </li>
        <li>
          <strong>Analytics:</strong> behavioral analytics via PostHog
          (page views, quiz steps, searches), consent-gated as described
          below. We do not send names, emails, payment details, or review
          text to analytics.
        </li>
      </ul>

      <h2>Payments</h2>
      <ul>
        <li>
          <strong>Card checkout:</strong> card payments are processed by
          Stripe through its embedded checkout on this site. Your card
          details are entered into Stripe&apos;s checkout and go to
          Stripe — they are never stored on our site.
        </li>
        <li>
          <strong>Cash App and Venmo:</strong> also available as manual
          payment options. If you choose one, you send payment to the
          handles shown at checkout and we confirm receipt before
          fulfilling your order.
        </li>
      </ul>

      <h2>Analytics &amp; personalization — your choice</h2>
      <p>
        We use PostHog to understand how visitors use this site, in two
        tiers:
      </p>
      <ul>
        <li>
          <strong>Before you choose:</strong> only basic anonymous page
          counts are collected. Automatic event capture is off and no
          person profiles are created.
        </li>
        <li>
          <strong>If you accept:</strong> we also record detailed,
          privacy-screened usage events (such as quiz steps, builder
          choices, and searches — never names, emails, payment details, or
          message text), and this device keeps a small first-party
          interest profile — which corners of the apothecary you explore
          (herbs, soaps, the Living Grimoire of Light & Magic, readings,
          the quiz, articles) — so
          the homepage can greet you with what you love first. That
          profile is stored only in your own browser; it is never sent to
          us or anyone else.
        </li>
        <li>
          <strong>If you decline:</strong> analytics capture is turned off
          entirely and stays off until you change your mind here.
        </li>
      </ul>
      <p>
        We never fingerprint visitors, never track you across other sites,
        and never sell data. Visits from our own testing are tagged as
        test traffic so they never mingle with real visitor counts.
      </p>

      <h3 id="privacy-choices">Your privacy choices</h3>
      <p>
        Change or withdraw your choice at any time. Withdrawing deletes
        your on-device interest profile, turns analytics off, and resets
        your choice — everything happens on this device, immediately.
      </p>
      <PrivacyChoices />

      <h2>What we never do</h2>
      <ul>
        <li>We never sell your information.</li>
        <li>We never share your information with third parties for marketing.</li>
        <li>
          We never store card details — card payments are handled by
          Stripe through its embedded checkout, and Cash App and Venmo
          are available as manual payment options.
        </li>
      </ul>

      <h2>Your choices</h2>
      <p>
        Every newsletter email includes an unsubscribe option. To request a
        copy or deletion of your stored information, email{' '}
        <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a> and we will honor
        it.
      </p>

      <h2>Data storage</h2>
      <p>
        Order, account, subscription, lead, and review records are stored
        in our Postgres database, hosted by Neon, when database storage
        is configured for the site; when it is not configured, the same
        records are kept in the site&apos;s local data store instead.
        Transactional email — such as order confirmations — is sent via
        Resend. Analytics data is processed by PostHog under their
        data-processing terms.
      </p>

      <p className="legal-nv">
        ⚠ NEEDS VERIFICATION — standard small-business privacy language, not
        legal advice. Owner attorney review required before treating it as
        final.
      </p>

      <p>
        Questions about your privacy?{' '}
        <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a>
      </p>
    </main>
  );
}
