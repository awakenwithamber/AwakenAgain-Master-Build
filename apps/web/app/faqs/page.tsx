/**
 * /faqs — frequently asked questions (G7).
 *
 * Server-rendered from lib/content/faqs.ts. Answers grounded in
 * owner-verified facts; unverified items carry honest markers.
 */
import type { Metadata } from 'next';
import { FAQS } from '../../lib/content/faqs';
import { BRAND_NAME } from '../../lib/seo/config';

export const metadata: Metadata = {
  title: 'FAQs',
  description: `Frequently asked questions about ordering, shipping, payments, and services at ${BRAND_NAME}.`,
};

export default function FaqsPage() {
  return (
    <main id="main-content" className="page content-page">
      <h1>Frequently Asked Questions</h1>
      <div className="faq-list">
        {FAQS.map((faq) => (
          <details key={faq.question} className="faq-item">
            <summary>
              {faq.question}
              {faq.source === 'needs-verification' && (
                <span className="faq-nv-badge"> — details being confirmed</span>
              )}
            </summary>
            <div className="faq-answer">
              {faq.answer.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
