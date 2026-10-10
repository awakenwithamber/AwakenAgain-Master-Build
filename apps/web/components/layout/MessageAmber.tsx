'use client';
/**
 * Message Amber — compact contact form for the site footer.
 * Appears on every page (owner directive 2026-10-10).
 * Fields: name, phone, email, brief message.
 */
import { useState } from 'react';

export function MessageAmber() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, message, topic: 'something-else' }),
      });
      if (res.ok) {
        setSent(true);
        setName('');
        setPhone('');
        setEmail('');
        setMessage('');
      }
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="message-amber-sent">
        <p>✦ Thank you! Amber reads every message personally and will reply soon. ✦</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="message-amber-form" aria-label="Send Amber a message">
      <h3>Send Amber a Message</h3>
      <p>Every message is read personally by Amber.</p>
      <label>
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Your name"
        />
      </label>
      <label>
        Phone
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
        />
      </label>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
        />
      </label>
      <label>
        Message
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          placeholder="What can Amber help you with?"
          rows={3}
        />
      </label>
      <button type="submit" disabled={sending}>
        {sending ? 'Sending…' : '✦ Send Message'}
      </button>
    </form>
  );
}
