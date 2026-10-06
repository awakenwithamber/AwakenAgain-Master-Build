/**
 * Lunna — herbal concierge chat widget, UI shell (G11).
 *
 * Honest "concierge preview" labeling throughout: this is a UI shell over
 * the canned-preview provider until the owner picks a real AI provider
 * (NEEDS VERIFICATION). The component never claims to be a general AI and
 * renders the provider disclaimer with every exchange.
 *
 * Analytics: chat_opened once per mount; chat_message_sent per user message
 * (message LENGTH only — content never leaves this widget toward analytics).
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  trackPlatformEvent,
  trackPlatformEventOnce,
} from '../../lib/analytics/platform-events';
import { LUNNA_DISCLAIMER } from '../../lib/ai/chat-provider';

interface ChatBubble {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatApiResponse {
  ok: boolean;
  reply?: string;
  provider_id?: string;
  provider_binding_needs_verification?: boolean;
  disclaimer?: string;
  errors?: string[];
}

export function HerbalChat() {
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    trackPlatformEventOnce('lunna-widget-opened', 'chat_opened', { surface: 'widget' });
  }, []);

  async function send() {
    const content = input.trim();
    if (!content || typing) return;
    setInput('');
    setError(null);
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setTyping(true);
    trackPlatformEvent('chat_message_sent', {
      message_length: content.length,
      provider_id: 'canned-preview',
    });
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as ChatApiResponse;
      if (!res.ok || !data.ok || !data.reply) {
        setError(data.errors?.[0] ?? 'Lunna is unavailable right now — please try again later.');
      } else {
        setMessages([...next, { role: 'assistant', content: data.reply }]);
      }
    } catch {
      setError('Lunna is unavailable right now — please try again later.');
    } finally {
      setTyping(false);
    }
  }

  return (
    <section aria-label="Lunna — herbal concierge preview" className="herbal-chat">
      <header>
        <h2>Lunna</h2>
        <p>
          <strong>Concierge preview</strong> — herbal education and shop
          guidance. Not a general AI yet; provider choice pending.
        </p>
      </header>

      <div aria-live="polite" aria-label="Conversation" className="herbal-chat-messages">
        {messages.length === 0 && (
          <p className="herbal-chat-empty">
            Ask about botanicals, soaps, scents, shipping — anything about the
            apothecary.
          </p>
        )}
        <ol>
          {messages.map((m, i) => (
            <li key={i} className={m.role === 'user' ? 'chat-user' : 'chat-lunna'}>
              <strong>{m.role === 'user' ? 'You' : 'Lunna'}:</strong> {m.content}
            </li>
          ))}
        </ol>
        {typing && (
          <p className="chat-typing" role="status">
            Lunna is thinking…
          </p>
        )}
        {error && (
          <p className="chat-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <form
        aria-label="Message Lunna"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="lunna-input" className="visually-hidden">
          Your message
        </label>
        <input
          id="lunna-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about botanicals, soaps, scents…"
          maxLength={500}
          autoComplete="off"
          disabled={typing}
        />
        <button type="submit" disabled={typing || input.trim().length === 0}>
          Send
        </button>
      </form>

      <footer>
        <small>{LUNNA_DISCLAIMER}</small>
      </footer>
    </section>
  );
}
