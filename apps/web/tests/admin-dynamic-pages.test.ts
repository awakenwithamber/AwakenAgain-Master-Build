/**
 * GUARD TESTS — admin pages that read live stores must render at
 * request time, never as static prerenders.
 *
 * An async server component that reads a ledger/store without opting
 * out of static generation gets baked at build time: the admin then
 * shows build-day counts and rows until the next deploy (the staleness
 * class fixed on /admin/orders in the Phase 2 tooling build, and on
 * /admin here). Every admin page whose render depends on live store
 * contents must carry `export const dynamic = 'force-dynamic';` —
 * asserted at source level, the same style as
 * tests/admin-tooling-pages.test.ts.
 *
 * Deliberately NOT covered: /admin/leads and /admin/reviews. Those
 * pages render only the PendingBinding* stores' binding() status — a
 * module-level constant string, no rows, no file reads — so a static
 * prerender cannot go stale. If either page ever starts listing real
 * records, add it to LIVE_STORE_PAGES below in the same change.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

const FORCE_DYNAMIC = "export const dynamic = 'force-dynamic';";

/** Admin pages that read live ledgers/stores while rendering. */
const LIVE_STORE_PAGES = [
  'app/admin/page.tsx', // overview — order counts from the JSONL ledger
  'app/admin/orders/page.tsx', // order ledger + tracking ledger
  'app/admin/subscriptions/page.tsx', // subscription ledger (latest-line)
  'app/admin/subscriptions/confirm/page.tsx', // confirm surface
  'app/admin/broadcast/page.tsx', // broadcast ledger + audience stores
];

describe('admin live-store pages — force-dynamic guard', () => {
  it('every live-store admin page opts out of static prerendering', () => {
    for (const file of LIVE_STORE_PAGES) {
      const src = readFileSync(join(ROOT, file), 'utf8');
      expect(
        src.includes(FORCE_DYNAMIC),
        `${file} reads live store data and must export dynamic = 'force-dynamic'`,
      ).toBe(true);
    }
  });

  it('the overview still reads the live order store (the reason it is guarded)', () => {
    const src = readFileSync(join(ROOT, 'app/admin/page.tsx'), 'utf8');
    expect(src).toContain('defaultOrderStore()');
    expect(src).toContain('listOrders');
  });
});
