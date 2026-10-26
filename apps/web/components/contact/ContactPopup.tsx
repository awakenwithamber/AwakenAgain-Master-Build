/**
 * Contact popup (2026-10-25) — "Message Amber" as an on-screen modal.
 *
 * A visitor can ask a question from wherever they are (the form guide,
 * a Gaia nudge) without navigating away from what they were doing.
 * Posts to the existing POST /api/contact pipeline (validation,
 * persistence, relay — all server-side); this component is only the
 * front door.
 *
 * Open mechanism (two doors, one popup):
 *   - <ContactPopupTrigger> — a visible button that opens it.
 *   - window CustomEvent 'aa:open-contact' — any component can open it:
 *       window.dispatchEvent(new CustomEvent('aa:open-contact'))
 *     Optionally with detail { topic: '<contact topic id>' } to preselect.
 *
 * The popup announces 'aa:contact-open' / 'aa:contact-closed' so the
 * Gaia nudges can stay out of the way while it is open (overlay-events).
 *
 * A11y (mirrors components/herbs/BotanicalCard.tsx): role="dialog"
 * aria-modal, Escape closes, overlay click closes, focus moves in on
 * open, Tab cycles inside, focus returns to the opener on close, body
 * scroll locks while open. Copy: copy pack 2026-10-25 §4, verbatim —
 * including the reworded text line with the BUSINESS number
 * 801-819-6795.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CONTACT_HONEYPOT_FIELD,
  CONTACT_TOPICS,
} from '../../lib/contact/topics';
import {
  CONTACT_CLOSED_EVENT,
  CONTACT_OPEN_EVENT,
  OPEN_CONTACT_EVENT,
} from '../../lib/personalization/overlay-events';

/** Reworded faster-reply line (copy pack §4) — popup + success state. */
export const CONTACT_TEXT_LINE =
  "Need a faster reply? Text Amber at 801-819-6795 — a text usually reaches her sooner than email, and she'll answer as soon as she steps away from the apothecary bench.";

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1200,
  background: 'rgba(10, 6, 20, 0.72)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
};

const dialogStyle: React.CSSProperties = {
  width: 'min(30rem, 100%)',
  maxHeight: 'calc(100vh - 2rem)',
  overflowY: 'auto',
  background: 'linear-gradient(160deg, var(--plum-mid), var(--plum-deep))',
  border: '1px solid var(--aa-gold)',
  borderRadius: '1rem',
  boxShadow: 'var(--shadow)',
  padding: '1.5rem 1.6rem 1.4rem',
  color: 'var(--text-body)',
  position: 'relative',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--aa-gold)',
  background: 'var(--aa-purple-deep)',
  color: '#f3e9d2',
  fontSize: '1rem',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  margin: '0.9rem 0 0.3rem',
  color: 'var(--parchment)',
  fontWeight: 600,
};

const honeypotStyle: React.CSSProperties = {
  position: 'absolute',
  left: '-9999px',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function openContactPopup(detail?: { topic?: string }): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_CONTACT_EVENT, { detail }));
}

/** Visible trigger button — opens the popup from anywhere it is rendered. */
export function ContactPopupTrigger({
  label = 'Message Amber',
  topic,
  className,
  style,
}: {
  label?: string;
  topic?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => openContactPopup(topic ? { topic } : undefined)}
    >
      {label}
    </button>
  );
}

export function ContactPopup() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  // Global open event (trigger button, form-guide cards, Gaia nudges).
  useEffect(() => {
    const onOpenRequest = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { topic?: string }
        | undefined;
      if (
        detail?.topic &&
        CONTACT_TOPICS.some((t) => t.id === detail.topic)
      ) {
        setTopic(detail.topic);
      }
      setSent(false);
      setErrors([]);
      setOpen(true);
    };
    window.addEventListener(OPEN_CONTACT_EVENT, onOpenRequest);
    return () => window.removeEventListener(OPEN_CONTACT_EVENT, onOpenRequest);
  }, []);

  // Lifecycle: focus in, scroll lock, announce open/closed, Esc close,
  // lightweight focus trap (BotanicalCard pattern).
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    window.dispatchEvent(new CustomEvent(CONTACT_OPEN_EVENT));
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => firstFieldRef.current?.focus(), 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', onKeyDown, true);
      window.dispatchEvent(new CustomEvent(CONTACT_CLOSED_EVENT));
      previouslyFocused.current?.focus?.();
    };
  }, [open, close]);

  if (!open) return null;

  const validate = (): string[] => {
    const problems: string[] = [];
    if (!name.trim()) problems.push('Please tell us your name.');
    if (!EMAIL_RE.test(email.trim()))
      problems.push('Please provide a valid email address.');
    if (!topic) problems.push('Please choose a topic for your message.');
    if (message.trim().length < 10)
      problems.push(
        'Your message is a little short — please add a bit more detail.',
      );
    return problems;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problems = validate();
    setErrors(problems);
    if (problems.length > 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          topic,
          message: message.trim(),
          [CONTACT_HONEYPOT_FIELD]: '',
        }),
      });
      const data = (await res.json()) as { ok?: boolean; errors?: string[] };
      if (res.ok && data.ok) {
        setSent(true);
        setName('');
        setEmail('');
        setMessage('');
        setErrors([]);
      } else {
        setErrors(
          data.errors ?? [
            'Something went wrong sending your message. Please try again.',
          ],
        );
      }
    } catch {
      setErrors([
        'Something went wrong sending your message. Please try again.',
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="aa-contact-popup-title"
        style={dialogStyle}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close message form"
          style={{
            position: 'absolute',
            top: '0.7rem',
            right: '0.7rem',
            background: 'transparent',
            border: '1px solid var(--aa-gold)',
            borderRadius: '999px',
            color: 'var(--parchment)',
            width: '2rem',
            height: '2rem',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>

        {sent ? (
          <div>
            <h2
              id="aa-contact-popup-title"
              style={{
                fontFamily: 'var(--font-display, "Cinzel Decorative", serif)',
                color: 'var(--parchment)',
                margin: '0 2rem 0.6rem 0',
              }}
            >
              Message received ✦
            </h2>
            <p style={{ lineHeight: 1.6 }}>
              Thank you — your message is on its way to Amber&apos;s inbox, and a
              confirmation is on its way to yours. She reads every message personally
              and will reply just as soon as she is able.
            </p>
            <p style={{ lineHeight: 1.6 }}>{CONTACT_TEXT_LINE}</p>
            <button
              type="button"
              onClick={close}
              style={{
                marginTop: '0.6rem',
                padding: '0.6rem 1.3rem',
                borderRadius: '999px',
                border: 'none',
                background:
                  'linear-gradient(135deg, var(--brass), var(--brass-lt))',
                color: 'var(--plum-dark)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate={false}>
            <h2
              id="aa-contact-popup-title"
              style={{
                fontFamily: 'var(--font-display, "Cinzel Decorative", serif)',
                color: 'var(--parchment)',
                margin: '0 2rem 0.4rem 0',
              }}
            >
              Message Amber
            </h2>
            <p style={{ lineHeight: 1.55, margin: '0 0 0.4rem' }}>
              Ask anything — an herb, an order, or where to even start. Every
              message is read personally by Amber.
            </p>

            {errors.length > 0 && (
              <div role="alert" aria-live="polite" style={{ color: '#ffb3b3' }}>
                {errors.map((err) => (
                  <p key={err} style={{ margin: '0.4rem 0' }}>
                    {err}
                  </p>
                ))}
              </div>
            )}

            <label style={labelStyle} htmlFor="aa-contact-name">
              Name
            </label>
            <input
              id="aa-contact-name"
              ref={firstFieldRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={fieldStyle}
            />

            <label style={labelStyle} htmlFor="aa-contact-email">
              Email
            </label>
            <input
              id="aa-contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={fieldStyle}
            />

            <label style={labelStyle} htmlFor="aa-contact-topic">
              Topic
            </label>
            <select
              id="aa-contact-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              style={fieldStyle}
            >
              <option value="">Choose a topic…</option>
              {CONTACT_TOPICS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>

            <label style={labelStyle} htmlFor="aa-contact-message">
              Message
            </label>
            <textarea
              id="aa-contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={4}
              style={fieldStyle}
            />

            {/* Honeypot — humans never see it; bots fill it and the
                server rejects with a generic error. */}
            <div style={honeypotStyle} aria-hidden="true">
              <label>
                Website
                <input
                  type="text"
                  name={CONTACT_HONEYPOT_FIELD}
                  tabIndex={-1}
                  autoComplete="off"
                  onChange={() => undefined}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: '1.1rem',
                padding: '0.65rem 1.5rem',
                borderRadius: '999px',
                border: 'none',
                background:
                  'linear-gradient(135deg, var(--brass), var(--brass-lt))',
                color: 'var(--plum-dark)',
                fontWeight: 700,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              {submitting ? 'Sending…' : 'Send Message'}
            </button>
            <p style={{ lineHeight: 1.55, fontSize: '0.92rem' }}>
              {CONTACT_TEXT_LINE}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
