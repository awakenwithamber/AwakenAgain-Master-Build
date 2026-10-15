/**
 * /partner — Partnerships (owner order 2026-10-15, audit fix #8).
 *
 * The ways to contribute to the AWAKEN series, each a short factual
 * paragraph, plus the partner/idea form. Content lives in
 * lib/content/partnerships.ts. Honest by design: every submission is
 * read by the owner personally; no response time and no acceptance is
 * promised anywhere on this page.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTRIBUTION_TYPES } from '../../lib/content/partnerships';
import { PartnerIdeaForm } from '../../components/partner/PartnerIdeaForm';
import { BRAND_NAME } from '../../lib/seo/config';
import styles from '../../components/partner/partner.module.css';

export const metadata: Metadata = {
  title: 'Partner With Us',
  description: `Ways to contribute to the AWAKEN series from ${BRAND_NAME} and Awaken With Amber LLC — bring an idea, offer skills or services, supply products or materials, invest or fund, or collaborate on community and land.`,
  alternates: { canonical: '/partner' },
};

export default function PartnerPage() {
  return (
    <main id="main-content" className={styles.pageMain}>
      <div className={styles.hero}>
        <p className="section-ornament" aria-hidden="true">
          ✦
        </p>
        <h1>Partner With Us</h1>
        <p>
          The AWAKEN series grows through people who bring something to
          the table — an idea, a craft, a product, funding, a place.
          These are the ways in. Every submission is read by Amber
          personally.
        </p>
      </div>

      <div className={styles.wayGrid}>
        {CONTRIBUTION_TYPES.map((type) => (
          <article key={type.id} className={styles.wayCard}>
            <h2 className={styles.wayName}>{type.label}</h2>
            <p className={styles.wayBlurb}>{type.blurb}</p>
          </article>
        ))}
      </div>

      <section
        className={styles.sectionBlock}
        id="partner-form"
        aria-labelledby="partner-form-heading"
      >
        <h2 id="partner-form-heading">Share Your Idea</h2>
        <p className={styles.sectionIntro}>
          Tell it plainly — what you are offering, and which corner of
          the series it touches. Submissions are reviewed by Amber
          herself; there is no form letter and no promised timeline.
        </p>
        <PartnerIdeaForm />
      </section>

      <p className={styles.crossLink}>
        Interested in sharing the apothecary with your own audience
        instead? <Link href="/network">Register affiliate interest →</Link>
      </p>
    </main>
  );
}
