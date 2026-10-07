/**
 * Contact form — client component (G5).
 *
 * Collects name / email / phone (optional) / topic / message, with a
 * honeypot field ("website") that real visitors never see. Client-side
 * validation mirrors the server rules in lib/contact/contact.ts for UX —
 * but the server always re-validates: CLIENT=PREVIEW, SERVER=AUTHORITY.
 * A honeypot trip is rejected server-side with a generic message, so the
 * trap is never revealed here or in the response.
 *
 * Brand: dark purple + gold, mystical/botanical/apothecary. Accessible:
 * every field is labeled, errors are announced via aria-live, the honeypot
 * is aria-hidden and unfocusable.
 */
'use client';

import { useState } from 'react';
import {
  CONTACT_HONEYPOT_FIELD,
  CONTACT_TOPICS,
} from '../../lib/contact/topics';

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.8rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--aa-gold)',
  background: 'var(--aa-purple-deep)',
  color: 'var(--aa-cream)',
  fontSize: '1rem',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  margin: '1rem 0 0.35rem',
  color: 'var(--aa-cream)',
  fontWeight: 600,
};

/** Visually hidden but present for bots — never shown to visitors. */
const honeypotStyle: React.CSSProperties = {
  position: 'absolute',
  left: '-9999px',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface ContactResponse {
  ok: boolean;
  message_id?: string;
  errors?: string[];
}

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [messageId, setMessageId] = useState<string | null>(null);

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
    setMessageId(null);
    if (problems.length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          topic,
          message: message.trim(),
          // Honeypot: always sent empty by this form.
          [CONTACT_HONEYPOT_FIELD]: '',
        }),
      });
      const data = (await res.json()) as ContactResponse;
      if (res.ok && data.ok) {
        setMessageId(data.message_id ?? null);
        setName('');
        setEmail('');
        setPhone('');
        setTopic('');
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
        'Could not reach the apothecary server. Please try again — or email awaken@consultant.com directly.',
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  if (messageId) {
    return (
      <section
        aria-label="Message sent"
        style={{
          border: '1px solid var(--aa-gold)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          background: 'var(--aa-purple)',
        }}
      >
        <h2 style={{ color: 'var(--aa-gold-bright)', marginTop: 0 }}>
          Your message is on its way ✨
        </h2>
        <p style={{ color: 'var(--aa-cream)' }}>
          Thank you — your message has been received and Amber will reply
          personally. Your reference is{' '}
          <strong style={{ color: 'var(--aa-gold-bright)' }}>
            {messageId}
          </strong>
          .
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Contact form">
      {errors.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            border: '1px solid #e0685c',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            color: 'var(--aa-cream)',
            background: 'rgba(224, 104, 92, 0.12)',
          }}
        >
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <label htmlFor="contact-name" style={labelStyle}>
        Your name
      </label>
      <input
        id="contact-name"
        name="name"
        type="text"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={fieldStyle}
        maxLength={120}
        required
      />

      <label htmlFor="contact-email" style={labelStyle}>
        Email
      </label>
      <input
        id="contact-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={fieldStyle}
        maxLength={254}
        required
      />

      <label htmlFor="contact-phone" style={labelStyle}>
        Phone <span style={{ fontWeight: 400 }}>(optional)</span>
      </label>
      <input
        id="contact-phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        style={fieldStyle}
      />

      <label htmlFor="contact-topic" style={labelStyle}>
        Topic
      </label>
      <select
        id="contact-topic"
        name="topic"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        style={fieldStyle}
        required
      >
        <option value="">Choose a topic…</option>
        {CONTACT_TOPICS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>

      <label htmlFor="contact-message" style={labelStyle}>
        Your message
      </label>
      <textarea
        id="contact-message"
        name="message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        style={{ ...fieldStyle, minHeight: '9rem', resize: 'vertical' }}
        maxLength={5000}
        required
      />

      {/* Honeypot: bots fill this; real visitors never see it. */}
      <div style={honeypotStyle} aria-hidden="true">
        <label htmlFor="contact-website">
          Leave this field empty
          <input
            id="contact-website"
            name={CONTACT_HONEYPOT_FIELD}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{
          marginTop: '1.5rem',
          padding: '0.8rem 2rem',
          borderRadius: '0.5rem',
          border: 'none',
          background: 'var(--aa-gold)',
          color: 'var(--aa-purple-deep)',
          fontSize: '1rem',
          fontWeight: 700,
          cursor: submitting ? 'wait' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {submitting ? 'Sending…' : 'Send Message ✦'}
      </button>
      <p
        style={{
          color: 'var(--aa-cream-dim)',
          fontSize: '0.85rem',
          marginTop: '0.75rem',
        }}
      >
        Your message goes straight to Amber — never to a mailing list, and
        never shared.
      </p>
    </form>
  );
}
