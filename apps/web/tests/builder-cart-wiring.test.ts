/**
 * REGRESSION — builder flows must write to THE single cart store.
 *
 * Legacy bug: two carts coexisted and localStorage-cart items never reached
 * checkout (real lost sales). A subtler form resurfaced in the Next.js
 * builder: the "Create Your Own Alchemy Soap" builder's "Add to Cart" and
 * the collection configurator's "Add Collection to Cart" built preview
 * payloads but never wrote them to the cart store — customers configured
 * products and clicked the button, and nothing reached checkout.
 *
 * This test enforces, by source scan, that both flows write through the
 * single cart module (components/checkout/cart-store): SoapBuilder calls
 * addItem, BundleConfigurator calls setBundle.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

function src(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

describe('builder flows write to the single cart store', () => {
  it('SoapBuilder "Add to Cart" calls the cart store addItem', () => {
    const code = src('components/builder/SoapBuilder.tsx');
    expect(code).toMatch(/from '\.\.\/checkout\/cart-store'/);
    expect(code).toMatch(/const \{ addItem \} = useCart\(\)/);
    expect(code).toMatch(/addItem\('custom-alchemy-soap', undefined, customization, qty\)/);
  });

  it('BundleConfigurator "Add Collection to Cart" calls the cart store setBundle', () => {
    const code = src('components/builder/BundleConfigurator.tsx');
    expect(code).toMatch(/from '\.\.\/checkout\/cart-store'/);
    expect(code).toMatch(/const \{ setBundle \} = useCart\(\)/);
    expect(code).toMatch(/setBundle\(\{ bundle_id: bundle\.bundle_id, slots: bundle\.slots \}\)/);
  });

  it('the collection configurator offers no bundle quantity (one collection per order)', () => {
    // The cart store and the server price exactly ONE collection per order
    // (no bundle quantity field). A qty input here would promise something
    // the money path cannot fulfill.
    const code = src('components/builder/BundleConfigurator.tsx');
    expect(code).not.toMatch(/Collection quantity/);
  });

  it('custom-builder cart lines render a customer-facing title, not a handle', () => {
    const store = src('components/checkout/cart-store.ts');
    expect(store).toMatch(/CUSTOM_BUILDER_TITLE/);
    const cart = src('components/checkout/CartView.tsx');
    expect(cart).toMatch(/cartItemTitle\(/);
    const form = src('components/checkout/CheckoutForm.tsx');
    expect(form).toMatch(/cartItemTitle\(/);
  });
});
