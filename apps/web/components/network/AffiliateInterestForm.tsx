/**
 * Affiliate-interest signup for /network (owner order 2026-10-15).
 *
 * Wired to POST /api/affiliate-interest (LeadStore kind
 * 'affiliate_interest'). Consent is a hard gate server-side; the
 * checkbox here mirrors it. The program is still forming, so the copy
 * promises nothing: registering interest only puts the visitor on the
 * list to hear more as it takes shape.
 */
'use client';

import { useState } from 'react';
import { NETWORK_PROJECTS } from '../../lib/content/network';
import styles from './network.module.css';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

export function AffiliateInterestForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [projects, setProjects] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const toggleProject = (slug: string, checked: boolean) => {
    setProjects((prev) =>
      checked ? [...prev, slug] : prev.filter((s) => s !== slug),
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status.kind === 'sending') return;
    setStatus({ kind: 'sending' });
    try {
      const res = await fetch('/api/affiliate-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          consent,
          projects,
          note: note.trim() || undefined,
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

  if (status.kind === 'done') {
    return (
      <div className={styles.formBox}>
        <p className={styles.formStatus} role="status">
          ✦ Thank you — your interest is saved. The affiliate program is
          still forming; registering simply puts you on the list to hear
          more as it takes shape.
        </p>
      </div>
    );
  }

  const sending = status.kind === 'sending';

  return (
    <form className={styles.formBox} onSubmit={submit}>
      <div className={styles.field}>
        <label htmlFor="affiliate-name">Your name</label>
        <input
          id="affiliate-name"
          className={styles.input}
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={sending}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="affiliate-email">Email address</label>
        <input
          id="affiliate-email"
          className={styles.input}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={sending}
        />
      </div>
      <fieldset className={styles.field}>
        <legend>Which projects interest you?</legend>
        <ul className={styles.checkList}>
          {NETWORK_PROJECTS.map((p) => (
            <li key={p.slug} className={styles.checkItem}>
              <label>
                <input
                  type="checkbox"
                  checked={projects.includes(p.slug)}
                  onChange={(e) => toggleProject(p.slug, e.target.checked)}
                  disabled={sending}
                />
                <span>
                  {p.name} — {p.statusLabel.toLowerCase()}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className={styles.field}>
        <label htmlFor="affiliate-note">Anything we should know? (optional)</label>
        <textarea
          id="affiliate-note"
          className={styles.textarea}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={sending}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.consent}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={sending}
          />
          <span>
            I consent to be contacted by email about the affiliate program
            as it forms. Registering interest promises nothing on either
            side, and I can ask to be removed at any time.
          </span>
        </label>
      </div>
      <button type="submit" className={styles.submitBtn} disabled={sending}>
        {sending ? 'Saving…' : 'Register My Interest ✦'}
      </button>
      {status.kind === 'error' ? (
        <p className={styles.formError} role="alert">
          {status.message}
        </p>
      ) : null}
    </form>
  );
}
