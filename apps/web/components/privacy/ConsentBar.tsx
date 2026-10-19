/**
 * Analytics consent bar (owner spec 2026-10-14). A calm bar fixed to the
 * bottom of the viewport — NOT a modal, never blocking. It renders only
 * while the visitor has not chosen (consent state 'unknown'); Accept
 * enables full consented capture, Decline opts PostHog out entirely.
 * The choice persists in localStorage and can be changed anytime from
 * the footer "Privacy Choices" link / the privacy page.
 *
 * Renders nothing on the server and on first paint (state is read after
 * mount), so it can never cause a hydration mismatch.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CONSENT_CHANGED_EVENT,
  applyConsentChoiceNow,
  getConsentStateNow,
} from '../../lib/personalization/client';
import type { ConsentState } from '../../lib/personalization/consent';
import styles from './privacy.module.css';

export function ConsentBar() {
  const [state, setState] = useState<ConsentState | null>(null);

  useEffect(() => {
    const sync = () => setState(getConsentStateNow());
    sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
  }, []);

  if (state !== 'unknown') return null;

  return (
    <div className={styles.consentBar} role="region" aria-label="Privacy choices">
      <div className={styles.consentInner}>
        <p className={styles.consentText}>
          We count visits anonymously. With your permission, we also learn
          which corners of the apothecary you love — herbs, soaps, the
          Living Grimoire of Light & Magic — to shape this site around them.
          First-party only,
          never sold. <Link href="/privacy">How it works</Link>
        </p>
        <div className={styles.consentActions}>
          <button
            type="button"
            className={`${styles.consentButton} ${styles.consentButtonPrimary}`}
            onClick={() => setState(applyConsentChoiceNow('accepted'))}
          >
            Accept
          </button>
          <button
            type="button"
            className={styles.consentButton}
            onClick={() => setState(applyConsentChoiceNow('declined'))}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
