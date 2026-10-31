/**
 * Homepage product carousel (owner directive 2026-10-30) — a
 * horizontally scrolling row of the same HomeProductCard used by Best
 * Sellers, so a visitor can glide along a shelf instead of scrolling
 * forever. Clicking a card's name goes to that product's own page.
 * Accessible prev/next buttons scroll the track by a page-width; the
 * track itself is a plain scrollable list (keyboard- and touch-
 * friendly, scroll-snapped) — no autoplay, no infinite loop.
 */
'use client';

import { useRef } from 'react';
import { HomeProductCard } from './HomeProductCard';
import type { HomeProductCardModel } from './product-cards';
import styles from './home.module.css';

interface Props {
  id: string;
  title: string;
  sub: string;
  cards: HomeProductCardModel[];
}

export function ProductCarousel({ id, title, sub, cards }: Props) {
  const trackRef = useRef<HTMLUListElement>(null);
  if (cards.length === 0) return null;

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <section className={styles.section} aria-labelledby={`${id}-heading`}>
      <div className={styles.container}>
        <div className={styles.ornament} aria-hidden="true">
          ✦ ─────────────── ✦
        </div>
        <h2 id={`${id}-heading`} className={styles.sectionTitle}>
          {title}
        </h2>
        <p className={styles.sectionSub}>{sub}</p>
        <div className={styles.carouselWrap}>
          <div className={styles.carouselControls}>
            <button
              type="button"
              className={styles.carouselBtn}
              onClick={() => scrollByPage(-1)}
              aria-label={`Scroll ${title} backward`}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.carouselBtn}
              onClick={() => scrollByPage(1)}
              aria-label={`Scroll ${title} forward`}
            >
              ›
            </button>
          </div>
          <ul className={styles.carouselTrack} ref={trackRef}>
            {cards.map((card) => (
              <HomeProductCard key={card.handle} product={card} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
