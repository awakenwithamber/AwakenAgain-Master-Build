/**
 * Account sign-in island for /account (Phase 3 Step 3).
 *
 * Email → 6-digit code → signed session cookie. NO password, ever.
 *
 * HONESTY (the quiz rule, audit BROKEN-1, applied here): the copy
 * never claims a code was emailed unless the server reports a real
 * send. While the preview mailer is bound, the response carries
 * delivery:'preview' and this form says plainly that the code cannot
 * reach an inbox yet. When sign-in is not configured on the server,
 * the page renders the not-yet-open notice instead of a form that
 * could only fail.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { syncDeviceToProfile } from '../../lib/accounts/client';
import styles from './account.module.css';

type Phase =
  | { step: 'email' }
  | { step: 'code'; requestId: string; email: string; delivery: string }
  | { step: 'done' };

export function SignInForm({ available }: { available: boolean }) {
  const [phase, setPhase] = useState<Phase>({ step: 'email' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  if (!available) {
    return (
      <div className={styles.card}>
        <h2>Profiles are opening soon</h2>
        <p>
          Accounts here run on a simple email code — no password. Sign-in
          switches on together with email delivery, which is the next
          step for the apothecary. Until then, nothing is lost: your
          likes, quiz results, and the rest of your journey stay saved on
          this device, and they will join your profile the first time you
          sign in.
        </p>
        <p>
          New here? <Link href="/quiz">Find your herbal allies</Link> or{' '}
          <Link href="/network">explore the Awaken Network</Link>.
        </p>
      </div>
    );
  }

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors([]);
    try {
      const res = await fetch('/api/account/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErrors(json.errors ?? ['Something went wrong — please try again.']);
        return;
      }
      setPhase({
        step: 'code',
        requestId: json.request_id,
        email: email.trim(),
        delivery: json.delivery === 'sent' ? 'sent' : 'preview',
      });
    } catch {
      setErrors(['Something went wrong — please try again.']);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || phase.step !== 'code') return;
    setBusy(true);
    setErrors([]);
    try {
      const res = await fetch('/api/account/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: phase.requestId, code: code.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErrors(json.errors ?? ['Something went wrong — please try again.']);
        return;
      }
      // First-sign-in device sync: this device's likes + progress join
      // the profile (merge — nothing already saved is lost).
      await syncDeviceToProfile();
      setPhase({ step: 'done' });
      window.location.assign('/account');
    } catch {
      setErrors(['Something went wrong — please try again.']);
    } finally {
      setBusy(false);
    }
  };

  if (phase.step === 'done') {
    return (
      <div className={styles.card}>
        <p className={styles.note}>✦ Signed in — bringing up your profile…</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2>Sign in or create your profile</h2>
      <p>
        One account for your herbal allies, likes, saved searches, and
        order history — keyed to your email, with a 6-digit code instead
        of a password. This is separate from Living Grimoire membership.
      </p>
      {phase.step === 'email' && (
        <form className={styles.form} onSubmit={requestCode}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              autoComplete="email"
              required
            />
          </label>
          {errors.length > 0 && (
            <ul className={styles.errors} role="alert">
              {errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a sign-in code'}
          </button>
        </form>
      )}
      {phase.step === 'code' && (
        <>
          {phase.delivery === 'sent' ? (
            <p className={styles.note}>
              Your code is on its way to {phase.email} — it lasts 10
              minutes. Enter it here to finish signing in.
            </p>
          ) : (
            <p className={styles.note}>
              Email delivery isn&apos;t switched on yet, so this code
              can&apos;t reach your inbox today — sign-in opens fully the
              moment delivery launches. Your likes and results stay saved
              on this device until then.
            </p>
          )}
          <form className={styles.form} onSubmit={verify}>
            <label>
              6-digit code
              <input
                className={styles.codeInput}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
              />
            </label>
            {errors.length > 0 && (
              <ul className={styles.errors} role="alert">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                setPhase({ step: 'email' });
                setCode('');
                setErrors([]);
              }}
            >
              Use a different email
            </button>
          </form>
        </>
      )}
    </div>
  );
}
