/**
 * REGRESSION SUITE — G2 custom capsule builder + G10 tea builder.
 *
 * Business laws under test (mirroring tests/builder/builder.test.ts):
 * - Shared builder primitives: SoapBuilder imports BUILDER_CSS from the
 *   shared module (no CSS duplication across builders).
 * - No superseded payment paths (Stripe/Shopify/PayPal/Square) anywhere
 *   in the formula builder surface.
 * - Brand identity: exact "Amber's Alchemy Apothecary", never shortened.
 * - Analytics: only builder-contract event names are emitted (no string
 *   literals); prices come from lib/pricing, never hard-coded.
 * - Money path: the formula builders write through THE single cart store
 *   (addItem with the validated formula), and the checkout form forwards
 *   the formula to the server.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILDER_ANALYTICS_EVENT_NAMES } from '../../lib/analytics/builders-events';

const ROOT = resolve(__dirname, '..', '..');

const FORMULA_FILES = [
  'components/builder/FormulaBuilder.tsx',
  'components/builder/shared/builder-styles.ts',
  'components/builder/shared/ProgressNav.tsx',
  'components/builder/shared/SummaryList.tsx',
  'components/builder/shared/HerbGrid.tsx',
  'components/builder/shared/SafetyPanel.tsx',
  'lib/custom-formula/formula.ts',
  'lib/custom-formula/safety.ts',
  'lib/catalog/herbs.ts',
];

const FORMULA_PAGES = [
  'app/custom-formula/page.tsx',
  'app/custom-formula/tea/page.tsx',
];

function src(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

describe('shared builder primitives', () => {
  it('SoapBuilder imports BUILDER_CSS from the shared module (no duplication)', () => {
    const soap = src('components/builder/SoapBuilder.tsx');
    expect(soap).toMatch(
      /import \{ BUILDER_CSS \} from '\.\/shared\/builder-styles'/,
    );
    expect(soap).not.toMatch(/const BUILDER_CSS = `/);
  });

  it('the shared styles module exports the base CSS plus formula extensions', () => {
    const styles = src('components/builder/shared/builder-styles.ts');
    expect(styles).toMatch(/export const BUILDER_CSS = `/);
    expect(styles).toMatch(/export const FORMULA_BUILDER_CSS = BUILDER_CSS \+/);
    expect(styles).toContain('.herb-grid');
    expect(styles).toContain('.safety-flag');
  });

  it('FormulaBuilder uses the shared stylesheet', () => {
    const code = src('components/builder/FormulaBuilder.tsx');
    expect(code).toMatch(/FORMULA_BUILDER_CSS/);
    expect(code).not.toMatch(/const BUILDER_CSS = `/);
  });
});

describe('no superseded payment paths in the formula builder surface', () => {
  it('no Stripe/Shopify/PayPal/Square references in builder files, lib, or pages', () => {
    for (const f of [...FORMULA_FILES, ...FORMULA_PAGES]) {
      expect(src(f), `payment path in ${f}`).not.toMatch(/stripe|shopify|paypal|square/i);
    }
  });
});

describe('brand identity on the formula builder routes', () => {
  it('pages + island use the exact business name', () => {
    for (const f of FORMULA_PAGES) {
      expect(src(f), `brand in ${f}`).toContain("Amber's Alchemy Apothecary");
    }
    expect(src('components/builder/FormulaBuilder.tsx')).toContain(
      "Amber's Alchemy Apothecary",
    );
  });

  it('the builder never shortens the name to "Amber\'s Alchemy" alone', () => {
    for (const f of [...FORMULA_FILES, ...FORMULA_PAGES]) {
      const shortUses = (src(f).match(/Amber's Alchemy(?! Apothecary)/g) ?? []).length;
      expect(shortUses, `shortened brand in ${f}`).toBe(0);
    }
  });
});

describe('formula builder analytics contract', () => {
  it('every trackBuilderEvent call uses BUILDER_ANALYTICS_EVENT_NAMES — no string literals', () => {
    const names = new Set(Object.keys(BUILDER_ANALYTICS_EVENT_NAMES));
    for (const f of ['components/builder/FormulaBuilder.tsx']) {
      const code = src(f);
      const literalCalls =
        code.match(/trackBuilderEvent(?:Once)?\(\s*['"][^'"]+['"]/g) ?? [];
      expect(literalCalls, `string-literal event in ${f}`).toEqual([]);
    }
  });

  it('all referenced builder event keys exist in the contract', () => {
    const names = new Set(Object.keys(BUILDER_ANALYTICS_EVENT_NAMES));
    const code = src('components/builder/FormulaBuilder.tsx');
    // EVENTS map references like B.formulaBuilderStarted
    const used = [...code.matchAll(/(?:B|BUILDER_ANALYTICS_EVENT_NAMES)\.(\w+)/g)].map(
      (m) => m[1] as string,
    );
    expect(used.length).toBeGreaterThan(0);
    for (const u of used) {
      expect(names.has(u), `unknown builder event ${u}`).toBe(true);
    }
  });
});

describe('formula pricing — derived, never hard-coded in components', () => {
  it('no hard-coded formula price literals in the builder components', () => {
    for (const f of [
      'components/builder/FormulaBuilder.tsx',
      'components/builder/shared/HerbGrid.tsx',
    ]) {
      const code = src(f);
      for (const lit of ['3333', '6000', '1333', '1199']) {
        expect(code, `hard-coded ${lit} in ${f}`).not.toMatch(new RegExp(`\\b${lit}\\b`));
      }
    }
  });

  it('the builder previews via lib/pricing, not inline math', () => {
    const code = src('components/builder/FormulaBuilder.tsx');
    expect(code).toMatch(/customFormulaPriceCents/);
    expect(code).toMatch(/from '\.\.\/\.\.\/lib\/pricing\/pricing'/);
  });
});

describe('formula money path — single cart store, server recompute', () => {
  it('FormulaBuilder validates via buildFormulaCartItem then writes via the cart store addItem', () => {
    const code = src('components/builder/FormulaBuilder.tsx');
    expect(code).toMatch(/from '\.\.\/checkout\/cart-store'/);
    expect(code).toMatch(/const \{ addItem \} = useCart\(\)/);
    const validateIdx = code.indexOf('buildFormulaCartItem(handle, formula, qty)');
    const persistIdx = code.indexOf('addItem(handle, undefined, undefined, qty, formula)');
    expect(validateIdx).toBeGreaterThan(-1);
    expect(persistIdx).toBeGreaterThan(-1);
    expect(validateIdx).toBeLessThan(persistIdx);
    expect(code).toMatch(/buildOrderConfiguration\(\[item\], undefined, 0\)/);
  });

  it('the checkout form forwards the formula to the server', () => {
    const form = src('components/checkout/CheckoutForm.tsx');
    expect(form).toMatch(/formula: item\.formula/);
  });

  it('the server prices formula lines from canonical data (order.ts)', () => {
    const order = src('lib/checkout/order.ts');
    expect(order).toMatch(/priceFormulaCustomization/);
    expect(order).toMatch(/isFormulaProduct/);
  });

  it('both builder pages render the FormulaBuilder island with the right kind', () => {
    expect(src('app/custom-formula/page.tsx')).toMatch(/<FormulaBuilder kind="capsule" \/>/);
    expect(src('app/custom-formula/tea/page.tsx')).toMatch(/<FormulaBuilder kind="tea" \/>/);
  });
});
