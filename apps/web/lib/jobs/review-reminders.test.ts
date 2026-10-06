/**
 * Review-reminder job contract — G13.
 *
 * Laws under test:
 * - runReviewReminderPass is pure: given (orders, reviewUrl, now) it
 *   deterministically returns { due, skipped }.
 * - An order becomes due at 21 days post-fulfillment, not before.
 * - Orders already reminded, with invalid emails, or bad dates are
 *   skipped with explicit reasons.
 * - No timers live in the job module — the trigger lives in
 *   /infrastructure, never in app code (asserted here as a structural
 *   invariant: this module exports no scheduler).
 */
import { describe, expect, it } from 'vitest';
import {
  REVIEW_REMINDER_CADENCE_DAYS,
  runReviewReminderPass,
  type FulfilledOrder,
} from './review-reminders';
import * as reviewReminders from './review-reminders';

const NOW = new Date('2026-10-05T12:00:00Z');
const isoDaysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

function order(overrides: Partial<FulfilledOrder> = {}): FulfilledOrder {
  return {
    order_id: 'AWK-20260901-ABC123',
    customer_email: 'customer@example.com',
    fulfilled_at: isoDaysAgo(22),
    product_summary: 'Lavender Alchemy Soap',
    ...overrides,
  };
}

describe('runReviewReminderPass', () => {
  it('marks a 22-day-old fulfilled order as due', () => {
    const { due, skipped } = runReviewReminderPass(
      [order()],
      'https://awakenagain.com/reviews',
      NOW,
    );
    expect(skipped).toHaveLength(0);
    expect(due).toHaveLength(1);
    expect(due[0].template).toBe('review_reminder');
    expect(due[0].to).toBe('customer@example.com');
    expect(due[0].data).toMatchObject({ order_id: 'AWK-20260901-ABC123' });
  });

  it('skips orders younger than the 21-day cadence', () => {
    expect(REVIEW_REMINDER_CADENCE_DAYS).toBe(21);
    const { due, skipped } = runReviewReminderPass(
      [order({ fulfilled_at: isoDaysAgo(10) })],
      'https://awakenagain.com/reviews',
      NOW,
    );
    expect(due).toHaveLength(0);
    expect(skipped[0].reason).toBe('too_soon');
  });

  it('never reminds the same order twice', () => {
    const { due, skipped } = runReviewReminderPass(
      [order({ fulfilled_at: isoDaysAgo(40), review_reminder_sent_at: isoDaysAgo(19) })],
      'https://awakenagain.com/reviews',
      NOW,
    );
    expect(due).toHaveLength(0);
    expect(skipped[0].reason).toBe('already_reminded');
  });

  it('skips invalid emails and bad dates with reasons', () => {
    const { due, skipped } = runReviewReminderPass(
      [
        order({ order_id: 'bad-email', customer_email: 'nope' }),
        order({ order_id: 'bad-date', fulfilled_at: 'not-a-date' }),
      ],
      'https://awakenagain.com/reviews',
      NOW,
    );
    expect(due).toHaveLength(0);
    expect(skipped.map((s) => s.reason).sort()).toEqual(['invalid_email', 'invalid_fulfilled_at']);
  });

  it('handles empty order lists', () => {
    const { due, skipped } = runReviewReminderPass([], 'https://awakenagain.com/reviews', NOW);
    expect(due).toEqual([]);
    expect(skipped).toEqual([]);
  });

  it('is deterministic across runs (pure function)', () => {
    const orders = [order(), order({ order_id: 'other', fulfilled_at: isoDaysAgo(30) })];
    const first = runReviewReminderPass(orders, 'https://awakenagain.com/reviews', NOW);
    const second = runReviewReminderPass(orders, 'https://awakenagain.com/reviews', NOW);
    expect(first.due.map((j) => j.to)).toEqual(second.due.map((j) => j.to));
    expect(first.skipped).toEqual(second.skipped);
  });

  it('exports no scheduler — trigger binding lives in /infrastructure', () => {
    const forbidden = ['setInterval', 'setTimeout', 'schedule', 'cron'];
    for (const key of forbidden) {
      expect(
        key in reviewReminders,
        `job module must not export a scheduler (${key})`,
      ).toBe(false);
    }
  });
});
