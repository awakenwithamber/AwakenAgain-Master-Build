/**
 * "Privacy choices" control for the privacy page (owner spec 2026-10-14).
 * Shows the visitor's current analytics-consent state and lets them
 * change it anytime:
 *   Accept  → full consented capture + interest personalization on.
 *   Decline → PostHog opted out entirely; honored until changed here.
 *   Withdraw & delete my data → wipes the local interest profile, opts
 *             PostHog out, and resets the consent choice (the consent bar
 *             may ask again on a future visit).
 * Everything happens on this device; nothing is sent anywhere.
 */
'use client';

import { useEffect, useState } from 'react';
import {
  CONSENT_CHANGED_EVENT,
  applyConsentChoiceNow,
  getConsentStateNow,
  withdrawAndDeleteNow,
} from '../../lib/personalization/client';
import type { ConsentState } from '../../lib/personalization/consent';
import styles from './privacy.module.css';

const STATE_LABEL: Record<ConsentState, string> = {
  unknown: 'You have not chosen yet — only anonymous visit counts are collected.',
  accepted: 'You accepted — detailed analytics and on-device personalization are on.',
  declined: 'You declined — analytics capture is fully off.',
};

export function PrivacyChoices() {
  const [state, setState] = useState<ConsentState | null>(null);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    const sync = () => setState(getConsentStateNow());
    sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
  }, []);

  return (
    <div className={styles.choicesBox}>
      <p className={styles.choicesState} role="status">
        {state === null ? 'Reading your saved choice…' : STATE_LABEL[state]}
      </p>
      <div className={styles.choicesActions}>
        <button
          type="button"
          className={`${styles.consentButton} ${styles.consentButtonPrimary}`}
          onClick={() => {
            setDeleted(false);
            setState(applyConsentChoiceNow('accepted'));
          }}
        >
          Accept analytics
        </button>
        <button
          type="button"
          className={styles.consentButton}
          onClick={() => {
            setDeleted(false);
            setState(applyConsentChoiceNow('declined'));
          }}
        >
          Decline analytics
        </button>
        <button
          type="button"
          className={styles.consentButton}
          onClick={() => {
            withdrawAndDeleteNow();
            setDeleted(true);
            setState(getConsentStateNow());
          }}
        >
          Withdraw &amp; delete my data
        </button>
      </div>
      {deleted ? (
        <p className={styles.choicesState} role="status">
          Done — your on-device interest profile is deleted, analytics is
          opted out, and your consent choice has been reset.
        </p>
      ) : null}
    </div>
  );
}
