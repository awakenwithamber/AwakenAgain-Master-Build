/**
 * Contact auto-response laws (2026-10-25):
 * - With a real provider bound, exactly one contact_received job is sent
 *   to the sender, rendered with the copy-pack §5 subject/body.
 * - With NO provider configured (logging preview), the send is skipped
 *   silently — nothing enters the preview outbox, no claim is made.
 * - A provider that returns an error or throws never rejects: the
 *   result is { sent: false } and the caller (the contact route) is
 *   unaffected.
 */
import { describe, expect, it } from 'vitest';
import { sendContactAutoResponse } from './contact-auto-response';
import {
  LoggingEmailProvider,
  renderEmailMessage,
  type EmailJob,
  type EmailProvider,
} from './email';

function recordingProvider() {
  const jobs: EmailJob[] = [];
  const provider: EmailProvider = {
    name: 'fake-resend',
    async send(job: EmailJob) {
      jobs.push(job);
      return { ok: true, provider_message_id: 'fake-1' };
    },
  };
  return { provider, jobs };
}

describe('sendContactAutoResponse', () => {
  it('sends exactly one contact_received job to the sender', async () => {
    const { provider, jobs } = recordingProvider();
    const result = await sendContactAutoResponse(
      { name: 'Test Customer', email: 'test@example.com' },
      provider,
    );
    expect(result).toEqual({ sent: true });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].template).toBe('contact_received');
    expect(jobs[0].to).toBe('test@example.com');
  });

  it('renders the copy-pack subject and body (business number only)', async () => {
    const { provider, jobs } = recordingProvider();
    await sendContactAutoResponse(
      { name: 'Test Customer', email: 'test@example.com' },
      provider,
    );
    const rendered = renderEmailMessage(jobs[0]);
    expect(rendered.subject).toBe(
      "We've received your message ✦ Amber's Alchemy Apothecary",
    );
    expect(rendered.text).toContain('Hello Test Customer,');
    expect(rendered.text).toContain(
      'your confirmation that your message has been received',
    );
    expect(rendered.text).toContain(
      'Amber reads every message personally — no call center, no robots reading your words. She will respond just as soon as she is able.',
    );
    expect(rendered.text).toContain('Text Amber at 801-819-6795');
    expect(rendered.text).toContain(
      "Amber's Alchemy Apothecary — Awaken With Amber LLC",
    );
    expect(rendered.text).toContain('awakenagain.com');
    // The personal number must never appear in customer email.
    expect(rendered.text).not.toContain('801-414-8984');
    expect(rendered.text).not.toContain('414-8984');
  });

  it('skips silently when no provider is configured (logging preview)', async () => {
    const logging = new LoggingEmailProvider();
    const result = await sendContactAutoResponse(
      { name: 'Test Customer', email: 'test@example.com' },
      logging,
    );
    expect(result).toEqual({ sent: false, reason: 'provider_unconfigured' });
    expect(logging.sentJobs()).toHaveLength(0);
  });

  it('resolves { sent: false } when the provider returns an error', async () => {
    const provider: EmailProvider = {
      name: 'fake-resend',
      async send() {
        return { ok: false, error: 'resend API error (HTTP 500)' };
      },
    };
    const result = await sendContactAutoResponse(
      { name: 'Test Customer', email: 'test@example.com' },
      provider,
    );
    expect(result).toEqual({ sent: false, reason: 'provider_error' });
  });

  it('never rejects when the provider throws', async () => {
    const provider: EmailProvider = {
      name: 'fake-resend',
      async send() {
        throw new Error('network down');
      },
    };
    await expect(
      sendContactAutoResponse(
        { name: 'Test Customer', email: 'test@example.com' },
        provider,
      ),
    ).resolves.toEqual({ sent: false, reason: 'send_failed' });
  });
});
