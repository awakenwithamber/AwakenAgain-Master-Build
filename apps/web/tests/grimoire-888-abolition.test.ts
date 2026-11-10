/**
 * $8.88 ABOLITION (owner decision 2026-11-09) — surface pins.
 *
 * The permanent unlock was eliminated as a purchase option:
 * - the subscribe page renders NO "$8.88", no "activation fee", and
 *   no UnlockPurchase panel — the component file itself is gone;
 * - the dormant Stripe unlock checkout route + classifier module
 *   are deleted, and the Stripe webhook carries no grant/revoke arm;
 * - privacy, returns, and the account profile carry no "$8.88";
 * - the owner's model stands in their place: full access comes with
 *   the $7.77/month subscription while it is active, and if a
 *   month's payment is not made the book locks again with the first
 *   17 pages free;
 * - NOTHING in the copy implies paying permanent-unlock customers
 *   exist (the owner's ruling: she is the only permanent holder).
 *
 * Comments are stripped before scanning rendered-copy files —
 * engineering notes documenting the abolition are not customer copy.
 * Route-level behavior (intake 410, grant 410, legacy records,
 * subscribers) is pinned in tests/phase2-unlock.test.ts; resolver
 * behavior is pinned in lib/grimoire/entitlement.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const PAGE = stripComments(read('app/grimoire/subscribe/page.tsx'));
const FORM = stripComments(read('components/grimoire/SubscribeForm.tsx'));
const PRIVACY = stripComments(read('app/privacy/page.tsx'));
const RETURNS = stripComments(read('app/returns/page.tsx'));
const ACCOUNT = stripComments(read('components/account/AccountProfile.tsx'));
const WEBHOOK = read('app/api/stripe/webhook/route.ts');

describe('$8.88 abolition — surfaces', () => {
  it('the subscribe page renders no $8.88, no activation fee, no unlock panel', () => {
    expect(PAGE).not.toContain('$8.88');
    expect(PAGE.toLowerCase()).not.toContain('activation fee');
    expect(PAGE).not.toContain('UnlockPurchase');
    expect(PAGE).not.toContain('Permanent unlock —');
    // The old holder-protection lines are gone (owner ruling
    // 2026-11-09: no paying permanent-unlock customers exist).
    expect(PAGE).not.toContain('Already hold the permanent unlock');
    expect(PAGE).not.toContain('What you bought stays yours');
    expect(PAGE).not.toContain('never removed by subscribing or cancelling');
  });

  it('the subscribe page states the owner model and keeps the $7.77 manual rail truth', () => {
    expect(PAGE).toContain('the book locks again');
    expect(PAGE).toContain('first 17');
    expect(PAGE).toContain('pages always remain free to read');
    expect(PAGE).toContain('$7.77/month');
    expect(PAGE).toContain('no automatic card charge');
    expect(PAGE).toContain('Amber confirms');
    expect(PAGE).toContain('Venmo');
    expect(PAGE).toContain('Cash App');
  });

  it('the signup form states the lock rule price-free and drops the unlock line', () => {
    expect(FORM).not.toContain('$8.88');
    expect(FORM).not.toContain('permanent unlock');
    expect(FORM).toContain('the book locks');
    expect(FORM).toContain('first 17 pages always stay free');
  });

  it('privacy, returns, and account carry no $8.88 offer or holder framing', () => {
    for (const [name, src] of [
      ['privacy', PRIVACY],
      ['returns', RETURNS],
      ['account', ACCOUNT],
    ] as const) {
      expect(src, name).not.toContain('$8.88');
    }
    expect(PRIVACY).toContain('permanent unlock is no longer sold');
    expect(RETURNS).toContain('permanent unlock is');
    expect(RETURNS).toContain('no longer offered');
    expect(RETURNS).toContain('the book locks again');
    expect(ACCOUNT).not.toContain('permanent unlock');
  });

  it('the offer machinery is deleted, not just hidden', () => {
    expect(existsSync(join(ROOT, 'components/grimoire/UnlockPurchase.tsx'))).toBe(false);
    expect(
      existsSync(join(ROOT, 'app/api/grimoire-unlock/checkout/route.ts')),
    ).toBe(false);
    expect(existsSync(join(ROOT, 'lib/grimoire/unlock-checkout.ts'))).toBe(false);
  });

  it('the Stripe webhook has no unlock grant or revoke arm left', () => {
    expect(WEBHOOK).not.toContain('grantUnlock');
    expect(WEBHOOK).not.toContain('revokeUnlockByTransactionRef');
    expect(WEBHOOK).not.toContain('isUnlockSessionMetadata');
    expect(WEBHOOK).not.toContain('unlock_granted');
  });

  it('the preserved entitlement core is untouched in shape', () => {
    const edition = read('lib/grimoire/edition.ts');
    expect(edition).toContain("GRIMOIRE_EDITION_ID = 'living-grimoire-333'");
    const entitlement = read('lib/grimoire/entitlement.ts');
    expect(entitlement).toContain('has_permanent_unlock');
    expect(entitlement).toContain('isUnlockEntitled');
  });
});
