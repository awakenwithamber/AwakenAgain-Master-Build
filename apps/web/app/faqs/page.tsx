/**
 * /faqs — frequently asked questions (workstream G).
 *
 * Server page: metadata + layout; the interactive accordion lives in
 * FaqAccordion.tsx (client). Content is the owner-verified lib/content/faqs
 * set — answers grounded in verified facts, unverified items honestly
 * marked.
 */
import type { Metadata } from 'next';
import { SiteHeader } from '../../components/shop/SiteHeader';
import { FaqAccordion } from './FaqAccordion';
import { BRAND_NAME } from '../../lib/seo/config';
import styles from './faq.module.css';

export const metadata: Metadata = {
  title: 'FAQs',
  description: `Frequently asked questions about ordering, shipping, payments, and services at ${BRAND_NAME}.`,
};

export default function FaqsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className={styles.faqMain}>
        <p className="section-ornament" aria-hidden="true">
          ✦
        </p>
        <h1>Frequently Asked Questions</h1>
        <p className={styles.faqLede}>
          Answers grounded in the apothecary&apos;s verified practices. Where
          a detail is still being confirmed, we say so honestly.
        </p>
        <FaqAccordion />
      </main>
    </>
  );
}
