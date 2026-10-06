/**
 * /privacy — privacy policy (G7 LEGAL).
 *
 * Honest about what we actually collect: quiz leads and newsletter
 * signups are stored in our lead store with explicit consent; analytics is
 * PostHog (behavioral, no PII). No fabricated compliance claims.
 */
import type { Metadata } from 'next';
import { BRAND_EMAIL, BRAND_NAME } from '../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${BRAND_NAME} collects, uses, and protects your information.`,
};

const UPDATED = '2026-10-05';

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
          <strong>Analytics:</strong> behavioral analytics via PostHog
          (page views, quiz steps, searches). We do not send names, emails,
          payment details, or review text to analytics.
        </li>
      </ul>

      <h2>What we never do</h2>
      <ul>
        <li>We never sell your information.</li>
        <li>We never share your information with third parties for marketing.</li>
        <li>
          We never store card details — checkout uses Cash App and Venmo only.
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
        Lead and review records are currently stored locally in the site's
        data store; they will migrate to our managed database with the same
        consent protections as the platform matures. Analytics data is
        processed by PostHog under their data-processing terms.
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
