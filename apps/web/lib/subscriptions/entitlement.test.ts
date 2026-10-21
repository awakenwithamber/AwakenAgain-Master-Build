/**
 * Subscriber entitlement lookup — unit tests.
 *
 * Law under test: benefits require a server-held subscription record for
 * the email whose LATEST status is 'active' (owner-confirmed). Pending
 * and cancelled records grant nothing; matching is case-insensitive and
 * trimmed; a missing/corrupt ledger fails closed.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SUBSCRIBER_ENTITLED_STATUSES,
  isEntitledSubscriber,
  normalizeSubscriptionEmail,
  readSubscriptionLedger,
} from './entitlement';

function ledgerWith(lines: unknown[]): string {
  const path = join(
    mkdtempSync(join(tmpdir(), 'subs-entitlement-')),
    'subscriptions.jsonl',
  );
  writeFileSync(
    path,
    lines
      .map((l) => (typeof l === 'string' ? l : JSON.stringify(l)))
      .join('\n') + '\n',
    'utf8',
  );
  return path;
}

function record(email: string, status: string) {
  return {
    subscription_id: 'SUB-TEST-0001',
    created_at: '2026-10-13T00:00:00.000Z',
    computed_by: 'server',
    plan_id: 'living-grimoire-monthly',
    plan_name: 'Living Grimoire',
    price_cents: 777,
    interval: 'month',
    status,
    customer: { name: 'Test Member', email },
    confirmed_at: status === 'active' ? '2026-10-13T01:00:00.000Z' : null,
    confirmed_by: status === 'active' ? 'owner' : null,
    recurring_mechanic: 'NEEDS_VERIFICATION',
    ledger_version: 1,
  };
}

describe('subscriber entitlement', () => {
  it('entitled-capable statuses are active + past_due (time-gated, Stage 3)', () => {
    // past_due entitles only inside the grace window — the full
    // time-aware walk lives in stripe-lifecycle.test.ts.
    expect(SUBSCRIBER_ENTITLED_STATUSES).toEqual(['active', 'past_due']);
  });

  it('grants for an active record; denies pending and cancelled', () => {
    expect(
      isEntitledSubscriber(
        'a@example.com',
        ledgerWith([record('a@example.com', 'active')]),
      ),
    ).toBe(true);
    expect(
      isEntitledSubscriber(
        'a@example.com',
        ledgerWith([record('a@example.com', 'pending_payment')]),
      ),
    ).toBe(false);
    expect(
      isEntitledSubscriber(
        'a@example.com',
        ledgerWith([record('a@example.com', 'cancelled')]),
      ),
    ).toBe(false);
  });

  it('the latest record for an email wins (append-only ledger)', () => {
    const activatedLater = ledgerWith([
      record('a@example.com', 'pending_payment'),
      record('a@example.com', 'active'),
    ]);
    expect(isEntitledSubscriber('a@example.com', activatedLater)).toBe(true);
    const cancelledLater = ledgerWith([
      record('a@example.com', 'active'),
      record('a@example.com', 'cancelled'),
    ]);
    expect(isEntitledSubscriber('a@example.com', cancelledLater)).toBe(false);
  });

  it('matches case-insensitively and trims, on both sides', () => {
    expect(normalizeSubscriptionEmail('  Member@Example.COM ')).toBe(
      'member@example.com',
    );
    const path = ledgerWith([record('Member@Example.com', 'active')]);
    expect(isEntitledSubscriber('member@example.com', path)).toBe(true);
    expect(isEntitledSubscriber('  MEMBER@EXAMPLE.COM ', path)).toBe(true);
    expect(isEntitledSubscriber('other@example.com', path)).toBe(false);
  });

  it('fails closed: missing ledger, malformed lines, empty email', () => {
    const missing = join(
      mkdtempSync(join(tmpdir(), 'subs-entitlement-')),
      'does-not-exist.jsonl',
    );
    expect(isEntitledSubscriber('a@example.com', missing)).toBe(false);

    const messy = ledgerWith([
      'this is not json',
      { nope: true },
      record('a@example.com', 'active'),
    ]);
    expect(readSubscriptionLedger(messy)).toHaveLength(1);
    expect(isEntitledSubscriber('a@example.com', messy)).toBe(true);
    expect(isEntitledSubscriber('', messy)).toBe(false);
    expect(isEntitledSubscriber(undefined, messy)).toBe(false);
  });
});
