/**
 * REGRESSION — the single-cart invariant.
 * Legacy bug: two carts coexisted and localStorage-cart items never reached
 * checkout (real lost sales). This test enforces, by filesystem scan, that
 * exactly ONE module owns cart state:
 *   components/checkout/cart-store.ts
 * Every other file in app/, components/, and lib/ must not touch the cart
 * storage key or read/write cart state from localStorage.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const SCAN_DIRS = ['app', 'components', 'lib'].map((d) => join(ROOT, d));
const SKIP = new Set(['node_modules', '.next', '.vitest']);

const OWNER = 'components/checkout/cart-store.ts';

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) yield full;
  }
}

describe('single cart source', () => {
  it('only one module owns the cart storage key', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(dir)) {
        const rel = file.slice(ROOT.length + 1);
        if (rel === OWNER) continue;
        const content = readFileSync(file, 'utf8');
        if (content.includes('aaa-cart-v1')) offenders.push(rel);
      }
    }
    expect(offenders, 'cart storage key used outside its owner module').toEqual([]);
  });

  it('no other module touches localStorage for cart state', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(dir)) {
        const rel = file.slice(ROOT.length + 1);
        if (rel === OWNER) continue;
        const content = readFileSync(file, 'utf8');
        const mentionsCart =
          /cart/i.test(content) && /localStorage/.test(content);
        if (mentionsCart) offenders.push(rel);
      }
    }
    expect(
      offenders,
      'cart-related localStorage access outside the owner module',
    ).toEqual([]);
  });

  it('the owner module exposes the single cart hook', async () => {
    const store = await import('../components/checkout/cart-store');
    expect(store.CART_STORAGE_KEY).toBe('aaa-cart-v1');
    expect(typeof store.useCart).toBe('function');
    expect(typeof store.previewUnitPriceCents).toBe('function');
  });
});
