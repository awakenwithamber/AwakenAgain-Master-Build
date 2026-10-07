/**
 * Dismissible consult banner — top of the homepage.
 * Gradient plum → amethyst bar linking to the free custom formula consultation.
 */
'use client';

import { useEffect, useState } from 'react';
import styles from './home.module.css';

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
    <div className={styles.consultBanner} role="note" aria-label="Free consultation banner">
      <p>
        Not sure what to choose?{' '}
        <a href="/custom-formula">Get a Free Custom Formula Consultation</a>
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
