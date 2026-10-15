/**
 * Subscription member list — unit tests (Phase 2).
 *
 * Laws under test:
 * - One row per email, resolved from the LATEST ledger line (the same
 *   latest-line semantics entitlement uses): a later activation or
 *   cancellation supersedes the signup line.
 * - Cancellation stamps (cancelled_at) recorded by the cancel route
 *   surface on the member row.
 * - Ordering is triage order: pending_payment, then active, then
 *   cancelled; alphabetical within a group.
 * - Reads are tolerant: missing file → no members; malformed lines and
 *   lines without a usable email are skipped, never thrown.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listSubscriptionMembers } from './members';

const DIR = mkdtempSync(join(tmpdir(), 'members-lib-'));
const LEDGER = join(DIR, 'subscriptions.jsonl');

function record(
  email: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
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
    ...extra,
  };
}

function setSubscriptions(lines: unknown[]): void {
  const content = lines.length
    ? lines
        .map((l) => (typeof l === 'string' ? l : JSON.stringify(l)))
        .join('\n') + '\n'
    : '';
  writeFileSync(LEDGER, content, 'utf8');
}

describe('listSubscriptionMembers', () => {
  it('missing ledger → no members', () => {
    expect(listSubscriptionMembers(join(DIR, 'nope.jsonl'))).toEqual([]);
  });

  it('resolves latest line per email and sorts for triage', () => {
    setSubscriptions([
      record('zoe@example.com', 'pending_payment'),
      record('amy@example.com', 'active'),
      record('kim@example.com', 'pending_payment'),
      record('kim@example.com', 'active'), // later line supersedes signup
      record('max@example.com', 'active'),
      record('max@example.com', 'cancelled', {
        cancelled_at: '2026-10-14T09:30:00.000Z',
        cancelled_by: 'owner',
      }),
      'not json at all',
      { status: 'active', customer: {} }, // no usable email — skipped
    ]);

    const members = listSubscriptionMembers(LEDGER);
    expect(members.map((m) => m.email)).toEqual([
      'zoe@example.com', // pending first
      'amy@example.com', // then active, alphabetical
      'kim@example.com',
      'max@example.com', // cancelled last
    ]);

    const kim = members.find((m) => m.email === 'kim@example.com');
    expect(kim?.status).toBe('active');
    expect(kim?.confirmed_at).toBe('2026-10-13T01:00:00.000Z');

    const max = members.find((m) => m.email === 'max@example.com');
    expect(max?.status).toBe('cancelled');
    expect(max?.cancelled_at).toBe('2026-10-14T09:30:00.000Z');

    const zoe = members.find((m) => m.email === 'zoe@example.com');
    expect(zoe?.status).toBe('pending_payment');
    expect(zoe?.price_cents).toBe(777);
    expect(zoe?.plan_name).toBe('Living Grimoire');
  });

  it('normalizes mixed-case ledger emails to one member row', () => {
    setSubscriptions([
      record('Member@Example.com', 'pending_payment'),
      record('member@example.com', 'active'),
    ]);
    const members = listSubscriptionMembers(LEDGER);
    expect(members).toHaveLength(1);
    expect(members[0].email).toBe('member@example.com');
    expect(members[0].status).toBe('active');
  });
});
