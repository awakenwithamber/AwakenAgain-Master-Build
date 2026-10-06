/**
 * Email job contracts — G9.
 *
 * Laws under test:
 * - buildEmailJob validates recipient and produces a queued job with a
 *   stable id shape and template/data intact.
 * - The bound provider is logging-only: it never throws, never sends
 *   anything real, and records jobs for inspection.
 * - handleUnsubscribe validates the address, suppresses it, and returns a
 *   confirmation job.
 * - Weekly promos and review reminders refuse suppressed addresses.
 */
import { describe, expect, it } from 'vitest';
import {
  InMemorySuppressionList,
  LoggingEmailProvider,
  buildEmailJob,
  buildPurchaseConfirmationJob,
  buildReviewReminderJob,
  buildWeeklyPromoJob,
  createEmailProvider,
  handleUnsubscribe,
} from './email';

describe('buildEmailJob', () => {
  it('builds a queued job with a valid recipient', () => {
    const job = buildEmailJob({
      to: 'customer@example.com',
      template: 'purchase_confirmation',
      data: {
        order_id: 'AWK-20261005-ABC123',
        total_cents: 3577,
        item_summary: 'The Alchemy Soap Collection',
        cash_app_handle: '$AmberPatten347',
        venmo_handle: '@AwakenwithAmber',
      },
    });
    expect(job.id).toMatch(/^EMAIL-\d{8}-[A-Z0-9]{6}$/);
    expect(job.to).toBe('customer@example.com');
    expect(job.status).toBe('queued');
    expect(job.attempts).toBe(0);
    expect(job.last_error).toBeNull();
  });

  it('rejects invalid recipients and non-object data', () => {
    expect(() =>
      buildEmailJob({
        to: 'not-an-email',
        template: 'purchase_confirmation',
        data: {
          order_id: 'x',
          total_cents: 1,
          item_summary: 'y',
          cash_app_handle: '$AmberPatten347',
          venmo_handle: '@AwakenwithAmber',
        },
      }),
    ).toThrow();
    expect(() =>
      buildEmailJob({ to: 'x@y.com', template: 'weekly_promo', data: 'nope' as never }),
    ).toThrow();
  });
});

describe('LoggingEmailProvider', () => {
  it('is the bound provider and performs no real sends', async () => {
    const provider = createEmailProvider();
    expect(provider.name).toBe('logging');
    const job = buildPurchaseConfirmationJob('customer@example.com', {
      order_id: 'AWK-20261005-ABC123',
      total_cents: 3577,
      item_summary: 'The Alchemy Soap Collection',
      cash_app_handle: '$AmberPatten347',
      venmo_handle: '@AwakenwithAmber',
    });
    const result = await provider.send(job);
    expect(result.ok).toBe(true);
    expect(result.provider_message_id).toMatch(/^preview-/);
    expect((provider as LoggingEmailProvider).sentJobs()).toHaveLength(1);
  });

  it('refuses to re-send a job that is not queued', async () => {
    const provider = new LoggingEmailProvider();
    const job = buildEmailJob({
      to: 'x@y.com',
      template: 'weekly_promo',
      data: { subject: 's', headline: 'h', body: 'b', cta_url: 'https://example.com' },
    });
    const done = { ...job, status: 'sent' as const };
    const result = await provider.send(done);
    expect(result.ok).toBe(false);
  });
});

describe('unsubscribe handling', () => {
  it('suppresses the address and returns a confirmation job', () => {
    const list = new InMemorySuppressionList();
    const job = handleUnsubscribe(list, 'customer@example.com');
    expect(job.template).toBe('unsubscribe_confirmation');
    expect(list.has('customer@example.com')).toBe(true);
  });

  it('rejects invalid addresses', () => {
    expect(() => handleUnsubscribe(new InMemorySuppressionList(), 'nope')).toThrow();
  });

  it('weekly promos refuse suppressed addresses', () => {
    const list = new InMemorySuppressionList();
    list.add('customer@example.com');
    expect(() =>
      buildWeeklyPromoJob(list, 'customer@example.com', {
        subject: 's',
        headline: 'h',
        body: 'b',
        cta_url: 'https://example.com',
      }),
    ).toThrow(/unsubscribed/);
  });

  it('review reminders refuse suppressed addresses', () => {
    const list = new InMemorySuppressionList();
    list.add('customer@example.com');
    expect(() =>
      buildReviewReminderJob(list, 'customer@example.com', {
        order_id: 'AWK-1',
        product_summary: 'Lavender Alchemy Soap',
        review_url: 'https://awakenagain.com/reviews',
      }),
    ).toThrow(/unsubscribed/);
  });

  it('non-suppressed addresses queue normally', () => {
    const list = new InMemorySuppressionList();
    const job = buildWeeklyPromoJob(list, 'customer@example.com', {
      subject: 's',
      headline: 'h',
      body: 'b',
      cta_url: 'https://example.com',
    });
    expect(job.status).toBe('queued');
  });
});
