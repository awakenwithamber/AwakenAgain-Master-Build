/**
 * "Free Herbal Healing Guide" — lead capture wired to the existing
 * newsletter endpoint (POST /api/newsletter). Consent is a hard gate:
 * nothing is stored without the explicit checkbox.
 */
'use client';

import { useState } from 'react';
import styles from './home.module.css';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

export function GuideSignup() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status.kind === 'sending') return;
    setStatus({ kind: 'sending' });
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          consent,
          placement: 'home-guide',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        const message =
          Array.isArray(json.errors) && json.errors.length > 0
            ? json.errors.join(' ')
            : 'Something went wrong — please try again.';
        setStatus({ kind: 'error', message });
        return;
      }
      setStatus({ kind: 'done' });
    } catch {
      setStatus({
        kind: 'error',
        message: 'Something went wrong — please try again.',
      });
    }
  };

  return (
    <section
      className={`${styles.section} ${styles.paneBg}`}
      aria-labelledby="guide-heading"
    >
      <div className={`${styles.paneInner} ${styles.container}`}>
        <div className={styles.guideBox}>
          <div className={styles.guideEmoji} aria-hidden="true">
            🌿
          </div>
          <h2 id="guide-heading" className={styles.guideTitle}>
            Free Herbal Healing Guide
          </h2>
          <p className={styles.guideCopy}>
            Subscribe for Amber&apos;s Beginner&apos;s Guide to Herbal Healing —
            20 herbs and how to use them.
          </p>
          {status.kind === 'done' ? (
            <p className={`${styles.guideStatus} ${styles.guideSuccess}`} role="status">
              ✦ Welcome in — your guide is on its way. Check your inbox for a
              note from Amber.
            </p>
          ) : (
            <form className={styles.guideForm} onSubmit={submit}>
              <span
                id="guide-email-label"
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  overflow: 'hidden',
                  clip: 'rect(0 0 0 0)',
                  whiteSpace: 'nowrap',
                }}
              >
                Email address
              </span>
              <input
                aria-labelledby="guide-email-label"
                type="email"
                required
                autoComplete="email"
                className={styles.guideInput}
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status.kind === 'sending'}
              />
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={status.kind === 'sending'}
              >
                {status.kind === 'sending' ? 'Sending…' : 'Send Me the Guide ✦'}
              </button>
            </form>
          )}
          {status.kind !== 'done' ? (
            <label className={styles.guideConsent}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={status.kind === 'sending'}
              />
              <span>
                I consent to receive the free guide and occasional emails from
                Amber&apos;s Alchemy Apothecary. Unsubscribe anytime.
              </span>
            </label>
          ) : null}
          {status.kind === 'error' ? (
            <p className={`${styles.guideStatus} ${styles.guideError}`} role="alert">
              {status.message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
