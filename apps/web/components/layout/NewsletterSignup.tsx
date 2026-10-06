/**
 * Newsletter signup (G15) — footer component.
 *
 * Client form POSTing to /api/newsletter. Consent is a hard requirement —
 * the form cannot submit without it. Fires newsletter_form_viewed
 * (client) on first render; the server records newsletter_subscribed.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { trackContentOnce } from '../../lib/analytics/content-posthog';

export default function NewsletterSignup({ placement = 'footer' }: { placement?: string }) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackContentOnce(`newsletter-form-${placement}`, 'newsletter_form_viewed', { placement });
  }, [placement]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrors([]);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent, placement }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErrors(json.errors ?? ['Something went wrong — please try again.']);
        setStatus('error');
        return;
      }
      setStatus('done');
    } catch {
      setErrors(['Something went wrong — please try again.']);
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <p className="newsletter-done" role="status">
        ✨ Welcome to the apothecary circle — please check your inbox to confirm.
      </p>
    );
  }

  return (
    <form className="newsletter-form" onSubmit={submit} aria-label="Newsletter signup">
      <label>
        <span className="newsletter-label">
          Apothecary notes — new botanicals, rituals & early access
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          maxLength={254}
          autoComplete="email"
          required
          aria-label="Email address"
        />
      </label>
      <label className="newsletter-consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
        />
        Yes — send me apothecary notes. Unsubscribe anytime. We never sell or
        share your information.
      </label>
      {errors.length > 0 && (
        <ul className="form-errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <button className="btn-primary" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Joining…' : 'Join the Circle'}
      </button>
    </form>
  );
}
