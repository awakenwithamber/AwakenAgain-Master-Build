/**
 * /privacy — privacy policy (G7 LEGAL).
 *
 * Honest about what we actually collect: quiz leads and newsletter
 * signups are stored in our lead store with explicit consent; analytics is
 * PostHog (behavioral, no PII). No fabricated compliance claims.
 *
 * The "Analytics & personalization" section (added 2026-10-14) describes
 * the consent-gated PostHog setup and the on-device interest profile
 * exactly as implemented in lib/personalization + lib/analytics — copy
 * flagged for the owner's legal review like the rest of this page.
 */
import type { Metadata } from 'next';
import { BRAND_EMAIL, BRAND_NAME } from '../../lib/seo/config';
import { PrivacyChoices } from '../../components/privacy/PrivacyChoices';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${BRAND_NAME} collects, uses, and protects your information.`,
};

const UPDATED = '2026-10-14';

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
          (herbs, soaps, the Grimoire, readings, the quiz, articles) — so
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
