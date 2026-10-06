/**
 * Scheduled review-reminder job — contract (G13).
 *
 * What this module defines: who is due (orders with fulfilled deliveries
 * older than the cadence and no review recorded), the reminder template,
 * and the cadence. It builds ReviewReminderJob contracts (shape:
 * { to, template: 'review_reminder', data }) for the email queue.
 *
 * TRIGGER BINDING LIVES IN /infrastructure — never in app code.
 * The scheduler (cron/trigger) that invokes runReviewReminderPass lives
 * under ~/workspace/awakenagain-migration/infrastructure/, not in the
 * Next.js app. This module is pure job logic: given fulfillment records
 * and "now", it returns the due set. No timers, no intervals, no setTimeout
 * anywhere in this file.
 *
 * Queueing: due jobs are handed to the email job queue (lib/jobs/email).
 * Sending still goes through the provider interface — logging-only until
 * a real provider is bound.
 */
import { buildEmailJob, type EmailJob } from './email';
import { sanitizeEmail } from '../security/validation';

/* ------------------------------------------------------------------ */
/* Cadence                                                              */
/* ------------------------------------------------------------------ */

/** Ask for a review 21 days after fulfillment — enough time to try it. */
export const REVIEW_REMINDER_CADENCE_DAYS = 21;
/** Never remind the same order more than once. */
export const REVIEW_REMINDER_MAX_PER_ORDER = 1;

/* ------------------------------------------------------------------ */
/* Contracts                                                              */
/* ------------------------------------------------------------------ */

/** Minimal fulfillment record the job needs — supplied by the trigger. */
export interface FulfilledOrder {
  order_id: string;
  customer_email: string;
  customer_name?: string;
  /** ISO date the order was fulfilled/delivered. */
  fulfilled_at: string;
  /** ISO date a review reminder was already sent, if any. */
  review_reminder_sent_at?: string | null;
  /** Product summary for the reminder copy, e.g. "Lavender Alchemy Soap". */
  product_summary: string;
}

export interface ReviewReminderJobInput extends FulfilledOrder {
  review_url: string;
}

export interface ReviewReminderPassResult {
  /** Jobs built and ready to queue. */
  due: EmailJob[];
  /** Orders skipped, with reasons (audit trail). */
  skipped: { order_id: string; reason: string }[];
}

function daysSince(iso: string, now: Date): number | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / (1000 * 60 * 60 * 24);
}

function isDue(order: FulfilledOrder, now: Date): string | null {
  if (order.review_reminder_sent_at) return 'already_reminded';
  const age = daysSince(order.fulfilled_at, now);
  if (age === null) return 'invalid_fulfilled_at';
  if (age < REVIEW_REMINDER_CADENCE_DAYS) return 'too_soon';
  if (!sanitizeEmail(order.customer_email)) return 'invalid_email';
  return null;
}

/**
 * One scheduler pass: for each fulfilled order, decide due vs skipped.
 * Pure function of (orders, reviewUrl, now) — fully deterministic and
 * testable. The /infrastructure trigger supplies the orders and the review
 * URL and queues the returned jobs.
 */
export function runReviewReminderPass(
  orders: FulfilledOrder[],
  reviewUrl: string,
  now: Date = new Date(),
): ReviewReminderPassResult {
  const due: EmailJob[] = [];
  const skipped: { order_id: string; reason: string }[] = [];
  for (const order of orders) {
    const reason = isDue(order, now);
    if (reason) {
      skipped.push({ order_id: order.order_id, reason });
      continue;
    }
    due.push(
      buildEmailJob({
        to: order.customer_email,
        template: 'review_reminder',
        data: {
          order_id: order.order_id,
          product_summary: order.product_summary,
          review_url: reviewUrl,
        },
      }),
    );
  }
  return { due, skipped };
}
