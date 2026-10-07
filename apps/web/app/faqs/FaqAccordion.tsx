/**
 * FAQ accordion — client component (workstream G).
 *
 * Accessible: each question is a <button> with aria-expanded and
 * aria-controls; answers are regions tied to their buttons. The faqFadeIn
 * animation is the design-system keyframe from the Netlify source-of-truth
 * audit (§8).
 */
'use client';

import { useState } from 'react';
import { FAQS } from '../../lib/content/faqs';
import styles from './faq.module.css';

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className={styles.faqList}>
      {FAQS.map((faq, i) => {
        const open = openIndex === i;
        const answerId = `faq-answer-${i}`;
        return (
          <div key={faq.question} className={styles.faqItem}>
            <h2 style={{ margin: 0 }}>
              <button
                type="button"
                className={styles.faqQuestion}
                aria-expanded={open}
                aria-controls={answerId}
                id={`faq-button-${i}`}
                onClick={() => setOpenIndex(open ? null : i)}
              >
                <span>
                  {faq.question}
                  {faq.source === 'needs-verification' ? (
                    <span className={styles.faqNvBadge}>
                      — details being confirmed
                    </span>
                  ) : null}
                </span>
                <span className={styles.faqChevron} aria-hidden="true">
                  ✦
                </span>
              </button>
            </h2>
            {open ? (
              <div
                id={answerId}
                role="region"
                aria-labelledby={`faq-button-${i}`}
                className={styles.faqAnswer}
              >
                {faq.answer.map((paragraph, j) => (
                  <p key={j}>{paragraph}</p>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
