/**
 * GUARD TEST — payment provider purity.
 * Cash App + Venmo are the ONLY payment methods (owner directive 2026-10-04).
 * This test fails the suite if "stripe", "shopify", "paypal", or "square"
 * appear anywhere in the app, lib, or component sources — including comments
 * suggesting them as alternatives.
 *
 * Scope: shipped source directories (app/, lib/, components/), excluding
 * test files themselves — a test asserting the absence of these providers
 * (even a skipped one) is documentation of the guard, not a violation.
 * Documentation in docs/ and the historical ledger may discuss the
 * superseded providers; this test guards shipped code, not the archive.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const SCAN_DIRS = ['app', 'lib', 'components'].map((d) => join(ROOT, d));
const SKIP = new Set(['node_modules', '.next', '.vitest']);

const FORBIDDEN = ['stripe', 'shopify', 'paypal', 'square'];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (
      /\.(ts|tsx|js|jsx|mjs|json)$/.test(entry) &&
      !/\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/.test(entry)
    )
      yield full;
  }
}

describe('payment provider purity', () => {
  it('no forbidden provider appears in app/lib/components sources', () => {
    const hits: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(dir)) {
        const content = readFileSync(file, 'utf8').toLowerCase();
        const found = FORBIDDEN.filter((word) =>
          new RegExp(`\\b${word}\\b`).test(content),
        );
        if (found.length > 0) {
          hits.push(`${file.slice(ROOT.length + 1)}: ${found.join(', ')}`);
        }
      }
    }
    expect(hits, 'forbidden payment provider references in shipped code').toEqual(
      [],
    );
  });

  it('checkout declares only Cash App + Venmo', async () => {
    const { CASH_APP_HANDLE, VENMO_HANDLE } = await import(
      '../lib/checkout/order'
    );
    expect(CASH_APP_HANDLE).toBe('$AmberPatten347');
    expect(VENMO_HANDLE).toBe('@AwakenwithAmber');
  });
});
