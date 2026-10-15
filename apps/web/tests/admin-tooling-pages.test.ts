/**
 * GUARD TESTS — Phase 2 admin tooling surfaces.
 *
 * Two honesty/hygiene laws, asserted at source level (the same style as
 * tests/admin-subscription-confirm-page.test.ts):
 *
 * 1. SECRET HYGIENE: every client component that handles the owner key
 *    (SubscriberManager, TrackingEntryForm, BroadcastComposer) keeps it
 *    in React state only — no browser storage, cookies, logging, or
 *    analytics references — and speaks its endpoint's contract exactly
 *    (path + `x-owner-secret` header + a password field with
 *    autocomplete off).
 *
 * 2. BROADCAST HONESTY: no broadcast surface may claim a send. The
 *    composer and page must carry the not-sent truth ('recorded_not_sent'
 *    / 'Recorded — not sent'), and neither may contain a "Send broadcast"
 *    control or a 'sent' success claim. Delivery does not exist in this
 *    app (no email provider — Phase 3), so any drift toward send
 *    language fails here first.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

const FORBIDDEN_TOKENS = [
  'localStorage',
  'sessionStorage',
  'document.cookie',
  'posthog',
  'gtag',
  'console.',
];

const KEY_COMPONENTS: Array<{ file: string; endpoint: string }> = [
  {
    file: 'app/admin/subscriptions/SubscriberManager.tsx',
    endpoint: '/api/admin/subscriptions/cancel',
  },
  {
    file: 'app/admin/orders/TrackingEntryForm.tsx',
    endpoint: '/api/admin/orders/tracking',
  },
  {
    file: 'app/admin/broadcast/BroadcastComposer.tsx',
    endpoint: '/api/admin/broadcast',
  },
];

describe('Phase 2 admin tooling — owner-key hygiene', () => {
  it('key-handling components exist and never persist, log, or broadcast the key', () => {
    for (const { file } of KEY_COMPONENTS) {
      const path = join(ROOT, file);
      expect(existsSync(path), `${file} should exist`).toBe(true);
      const src = readFileSync(path, 'utf8');
      for (const token of FORBIDDEN_TOKENS) {
        expect(
          src.includes(token),
          `${file} must not reference ${token}`,
        ).toBe(false);
      }
    }
  });

  it('each component speaks its endpoint contract exactly', () => {
    for (const { file, endpoint } of KEY_COMPONENTS) {
      const src = readFileSync(join(ROOT, file), 'utf8');
      expect(src, `${file} must call ${endpoint}`).toContain(endpoint);
      expect(src, `${file} must send the x-owner-secret header`).toContain(
        'x-owner-secret',
      );
      expect(src, `${file} must use a password field`).toContain(
        'type="password"',
      );
      expect(src, `${file} must disable autocomplete on the key`).toContain(
        'autoComplete="off"',
      );
    }
  });

  it('the subscriber manager wires BOTH the existing confirm endpoint and the new cancel endpoint', () => {
    const src = readFileSync(
      join(ROOT, 'app/admin/subscriptions/SubscriberManager.tsx'),
      'utf8',
    );
    expect(src).toContain('/api/admin/subscriptions/confirm');
    expect(src).toContain('/api/admin/subscriptions/cancel');
  });
});

describe('Phase 2 broadcast — no fake sends', () => {
  const composer = readFileSync(
    join(ROOT, 'app/admin/broadcast/BroadcastComposer.tsx'),
    'utf8',
  );
  const page = readFileSync(
    join(ROOT, 'app/admin/broadcast/page.tsx'),
    'utf8',
  );

  it('the composer records and says so — it never offers to send', () => {
    expect(composer).toContain('Record broadcast (does not send)');
    expect(composer).not.toContain('Send broadcast');
    expect(composer.toLowerCase()).toContain('not sent');
  });

  it('the page labels recorded drafts as not sent', () => {
    expect(page).toContain('Recorded — not sent');
    expect(page).toContain('recorded_not_sent');
    expect(page).not.toContain('Send broadcast');
  });

  it('no broadcast source claims a completed send', () => {
    for (const src of [composer, page]) {
      expect(src).not.toContain('Broadcast sent');
      expect(src).not.toContain('was sent to');
      expect(src).not.toContain('emails sent');
    }
  });
});

describe('Phase 2 customer order status — discoverability', () => {
  it('the checkout success page links the order-status lookup', () => {
    const src = readFileSync(
      join(ROOT, 'app/checkout/success/page.tsx'),
      'utf8',
    );
    expect(src).toContain('/order-status');
  });

  it('the order-status form speaks the lookup contract', () => {
    const src = readFileSync(
      join(ROOT, 'app/order-status/OrderStatusForm.tsx'),
      'utf8',
    );
    expect(src).toContain('/api/orders/status');
    // The form never renders a tracking link it invented — links come
    // from the server's tracking_url in the lookup response.
    expect(src).toContain('tracking.tracking_url');
  });
});
