/**
 * Dismissible consult banner — top of the homepage.
 * Gradient plum → amethyst bar linking to the free consultation
 * offer.
 *
 * History: the 2026-10-22 fix dropped the word "Free" (the catalog
 * consultation is a $33.33 offering) and pointed the banner at that
 * product. Owner decision 2026-10-27: the banner OFFERS A FREE
 * CONSULTATION — Amber's standing free-consultation practice,
 * arranged personally with her. It therefore links to /contact until
 * the native /book page ships; the $33.33 Personalized Formula
 * Consultation in the shop remains a separate paid offering.
 */
'use client';

import { useEffect, useState } from 'react';
import styles from './home.module.css';
import Link from 'next/link';

const DISMISS_KEY = 'aa-consult-banner-dismissed';

export function ConsultBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
    } catch {
      // Storage unavailable — keep the banner visible.
    }
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage unavailable — dismiss for this page view only.
    }
    setDismissed(true);
  };

  return (
    <div className={styles.consultBanner} role="note" aria-label="Consultation banner">
      <p>
        Not sure where to start?{' '}
        <Link href="/contact">Get a Free Personalized Formula Consultation</Link>
      </p>
      <button
        type="button"
        className={styles.consultDismiss}
        aria-label="Dismiss consultation banner"
        onClick={dismiss}
      >
        ✕
      </button>
    </div>
  );
}
