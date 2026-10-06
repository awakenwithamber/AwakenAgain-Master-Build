/**
 * Subscription record building/validation — G1.
 *
 * Laws under test:
 * - The plan price always equals CANONICAL_PRICES.grimoireMonthlyCents
 *   ($7.77 = 777) — never hard-coded in the record builder.
 * - New records start in `pending_payment` with no confirmation.
 * - Client-supplied price fields are ignored, never trusted.
 * - Owner confirmation transitions pending_payment → active; nothing else
 *   can be confirmed. Cancellation is idempotent.
 * - Recurring-billing mechanics stay NEEDS VERIFICATION (stage gate).
 */
import { describe, expect, it } from 'vitest';
import { CANONICAL_PRICES, formatPrice } from '../pricing/pricing';
import {
  GRIMOIRE_PLAN,
  RECURRING_BILLING_MECHANIC_STATUS,
  cancelSubscription,
  confirmSubscription,
  grimoirePlanPriceLabel,
  validateAndBuildSubscription,
} from './subscriptions';

describe('grimoire plan', () => {
  it('price equals the canonical grimoire monthly price (777 cents)', () => {
    expect(GRIMOIRE_PLAN.priceCents).toBe(CANONICAL_PRICES.grimoireMonthlyCents);
    expect(GRIMOIRE_PLAN.priceCents).toBe(777);
    expect(grimoirePlanPriceLabel()).toBe(formatPrice(777) + '/month');
  });

  it('plan mentions the 10% subscriber discount', () => {
    expect(GRIMOIRE_PLAN.benefits.some((b) => b.includes('10%'))).toBe(true);
  });
});

describe('validateAndBuildSubscription', () => {
  it('builds a pending_payment record for valid input', () => {
    const record = validateAndBuildSubscription({
      name: 'Test Customer',
      email: 'customer@example.com',
      phone: '(801) 555-0100',
    });
    expect(record.subscription_id).toMatch(/^SUB-\d{8}-[A-Z0-9]{6}$/);
    expect(record.status).toBe('pending_payment');
    expect(record.computed_by).toBe('server');
    expect(record.price_cents).toBe(777);
    expect(record.interval).toBe('month');
    expect(record.confirmed_at).toBeNull();
    expect(record.confirmed_by).toBeNull();
    expect(record.customer.email).toBe('customer@example.com');
  });

  it('ignores any client-supplied price field', () => {
    const record = validateAndBuildSubscription({
      name: 'Test Customer',
      email: 'customer@example.com',
      price_cents: 1,
      plan_price: '0.01',
    });
    expect(record.price_cents).toBe(777);
  });

  it('rejects missing/invalid name and email', () => {
    expect(() => validateAndBuildSubscription({ name: 'A', email: 'x@y.com' })).toThrow();
    expect(() => validateAndBuildSubscription({ name: 'Test', email: 'not-an-email' })).toThrow();
    expect(() => validateAndBuildSubscription({})).toThrow();
    expect(() => validateAndBuildSubscription(null)).toThrow();
  });

  it('phone is optional; invalid phone is rejected', () => {
    const record = validateAndBuildSubscription({ name: 'Test Customer', email: 'x@y.com' });
    expect(record.customer.phone).toBeUndefined();
    expect(() =>
      validateAndBuildSubscription({ name: 'Test Customer', email: 'x@y.com', phone: 'abc' }),
    ).toThrow();
  });
});

describe('confirmSubscription', () => {
  it('owner confirmation moves pending_payment → active', () => {
    const record = validateAndBuildSubscription({ name: 'Test Customer', email: 'x@y.com' });
    const confirmed = confirmSubscription(record);
    expect(confirmed.status).toBe('active');
    expect(confirmed.confirmed_by).toBe('owner');
    expect(confirmed.confirmed_at).not.toBeNull();
  });

  it('refuses to confirm an already-active or cancelled record', () => {
    const record = validateAndBuildSubscription({ name: 'Test Customer', email: 'x@y.com' });
    const active = confirmSubscription(record);
    expect(() => confirmSubscription(active)).toThrow();
    expect(() => confirmSubscription(cancelSubscription(record))).toThrow();
  });
});

describe('cancelSubscription', () => {
  it('cancels from any status and is idempotent', () => {
    const record = validateAndBuildSubscription({ name: 'Test Customer', email: 'x@y.com' });
    const cancelled = cancelSubscription(record);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelSubscription(cancelled).status).toBe('cancelled');
  });
});

describe('recurring-billing mechanics stage gate', () => {
  it('remains NEEDS_VERIFICATION — no billing process may be invented', () => {
    // Owner decision required on Cash App/Venmo recurring mechanics.
    // Flip this only when Amber rules; the flip itself is the gate.
    expect(RECURRING_BILLING_MECHANIC_STATUS).toBe('NEEDS_VERIFICATION');
    const record = validateAndBuildSubscription({ name: 'Test Customer', email: 'x@y.com' });
    expect(record.recurring_mechanic).toBe('NEEDS_VERIFICATION');
  });
});
