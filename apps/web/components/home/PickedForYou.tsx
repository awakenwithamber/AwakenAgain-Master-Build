/**
 * "Picked for you" row (owner spec 2026-10-14). Renders ONLY after
 * mount, only when the visitor accepted analytics consent AND has a
 * clear top interest (lib/personalization rules — unit-tested). Pick
 * models are computed on the server from the canonical catalog for every
 * interest; this component merely selects the row for the visitor's top
 * interest, so nothing about the visitor leaves the device.
 *
 * - Product interests → up to 3 product cards (existing HomeProductCard).
 * - grimoire → its product picks plus a doorway card into /grimoire.
 * - articles → up to 3 journal article cards.
 * For everyone else it renders nothing — the homepage is unchanged.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CONSENT_CHANGED_EVENT,
  topInterestNow,
} from '../../lib/personalization/client';
import type { InterestCategory } from '../../lib/personalization/interests';
import { HomeProductCard } from './HomeProductCard';
import type { HomeProductCardModel } from './product-cards';
import styles from './home.module.css';

export interface ArticlePick {
  slug: string;
  title: string;
  excerpt: string;
}

const INTEREST_LABEL: Record<InterestCategory, string> = {
  herbs: 'your love of personalized formulas',
  soaps: 'your love of handcrafted soaps',
  grimoire: 'your love of the Living Grimoire of Light & Magic',
  readings: 'your interest in readings & services',
  quiz: 'your Herbal Allies path',
  articles: 'your love of apothecary reading',
};

export function PickedForYou({
  picksByInterest,
  articlePicks,
}: {
  picksByInterest: Partial<Record<InterestCategory, HomeProductCardModel[]>>;
  articlePicks: ArticlePick[];
}) {
  const [top, setTop] = useState<InterestCategory | null>(null);

  useEffect(() => {
    const sync = () => setTop(topInterestNow());
    sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
  }, []);

  if (!top) return null;
  const products = picksByInterest[top] ?? [];
  const showArticles = top === 'articles';
  if (!showArticles && products.length === 0) return null;
  if (showArticles && articlePicks.length === 0) return null;

  return (
    <section
      className={`${styles.section} ${styles.paneBg}`}
      aria-labelledby="picked-for-you-heading"
    >
      <div className={`${styles.paneInner} ${styles.container}`}>
        <div className={styles.ornament} aria-hidden="true">
          ✦ ─────────────── ✦
        </div>
        <h2 id="picked-for-you-heading" className={styles.sectionTitle}>
          Picked for You
        </h2>
        <p className={styles.sectionSub}>
          Because of {INTEREST_LABEL[top]} — chosen on this device, from
          what you have explored here.
        </p>
        {showArticles ? (
          <div className={styles.learnGrid}>
            {articlePicks.map((article) => (
              <article key={article.slug} className={styles.learnCard}>
                <h3 className={styles.learnTitle}>{article.title}</h3>
                <p className={styles.learnCopy}>{article.excerpt}</p>
                <Link
                  className={styles.btnSecondary}
                  href={`/journal/${article.slug}`}
                >
                  Read the article →
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <>
            <ul className={styles.productGrid}>
              {products.map((card) => (
                <HomeProductCard key={card.handle} product={card} />
              ))}
            </ul>
            {top === 'grimoire' ? (
              <p className={styles.sectionSub}>
                <Link className={styles.btnSecondary} href="/grimoire">
                  Enter the Living Grimoire of Light & Magic →
                </Link>
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
