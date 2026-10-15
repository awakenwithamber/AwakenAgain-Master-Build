/**
 * Partner / idea submission form for /partner (owner order 2026-10-15).
 *
 * Wired to POST /api/partner-idea (LeadStore kind 'partner_idea').
 * Consent is a hard gate server-side; the checkbox here mirrors it.
 * Honest by design: submissions are read by Amber personally, and the
 * copy promises neither a reply nor a timeline — if she sees a fit,
 * she follows up at the email given.
 */
'use client';

import { useState } from 'react';
import { CONTRIBUTION_TYPES } from '../../lib/content/partnerships';
import styles from './partner.module.css';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

export function PartnerIdeaForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contributionType, setContributionType] = useState('');
  const [idea, setIdea] = useState('');
  const [links, setLinks] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status.kind === 'sending') return;
    setStatus({ kind: 'sending' });
    try {
      const res = await fetch('/api/partner-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          consent,
          contributionType,
          idea: idea.trim(),
          links: links.trim() || undefined,
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
          ✦ Received — thank you. Amber reads every submission personally.
          If she sees a fit, she will follow up at the email you gave; no
          timeline is promised, and not every idea can be taken on.
        </p>
      </div>
    );
  }

  const sending = status.kind === 'sending';

  return (
    <form className={styles.formBox} onSubmit={submit}>
      <div className={styles.field}>
        <label htmlFor="partner-name">Your name</label>
        <input
          id="partner-name"
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
        <label htmlFor="partner-email">Email address</label>
        <input
          id="partner-email"
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
        <legend>How would you like to contribute?</legend>
        <ul className={styles.radioList}>
          {CONTRIBUTION_TYPES.map((t) => (
            <li key={t.id} className={styles.radioItem}>
              <label>
                <input
                  type="radio"
                  name="contribution-type"
                  value={t.id}
                  checked={contributionType === t.id}
                  onChange={(e) => setContributionType(e.target.value)}
                  disabled={sending}
                />
                <span>{t.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className={styles.field}>
        <label htmlFor="partner-idea">Your idea or offer</label>
        <textarea
          id="partner-idea"
          className={styles.textarea}
          required
          maxLength={4000}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          disabled={sending}
          placeholder="Tell it plainly — what it is, which project it touches, and what you'd bring to it."
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="partner-links">Links (optional)</label>
        <input
          id="partner-links"
          className={styles.input}
          type="text"
          maxLength={600}
          value={links}
          onChange={(e) => setLinks(e.target.value)}
          disabled={sending}
          placeholder="Website, portfolio, or social profile"
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
            I consent to Amber reading this submission and replying by
            email. Submitting promises nothing on either side.
          </span>
        </label>
      </div>
      <button type="submit" className={styles.submitBtn} disabled={sending}>
        {sending ? 'Sending…' : 'Send My Submission ✦'}
      </button>
      {status.kind === 'error' ? (
        <p className={styles.formError} role="alert">
          {status.message}
        </p>
      ) : null}
    </form>
  );
}
