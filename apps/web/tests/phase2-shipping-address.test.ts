/**
 * Phase 2, Workstream 1a + 2B address integration.
 *
 * Pins: the shared shipping-address validator (US ZIP/state rules,
 * non-US regions), the phone validator (country codes), the
 * physical/digital classification of the WHOLE catalog (survey pin —
 * a catalog change that flips a product's classification fails here
 * loudly), the checkout rule (physical carts require + store the
 * address; digital-only carts are never forced through it; totals are
 * untouched), and the checkout prefill merge.
 */
import { describe, expect, it } from 'vitest';
import {
  mergeAddressPrefill,
  productRequiresShipping,
  validateShippingAddress,
  type ShippingAddress,
} from '../lib/checkout/shipping-address';
import { validatePhoneNumber } from '../lib/accounts/phone';
import { PRODUCTS, getProductByHandle } from '../lib/catalog/products';
import { validateAndBuildOrder } from '../lib/checkout/order';

const US_ADDRESS = {
  name: 'Jamie Rivera',
  street: '239 S 1200 W',
  city: 'Salt Lake City',
  state: 'UT',
  postal_code: '84104',
  country: 'US',
};

describe('validateShippingAddress', () => {
  it('accepts a complete US address and normalizes the state code', () => {
    const v = validateShippingAddress({ ...US_ADDRESS, state: 'ut' });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.address.state).toBe('UT');
      expect(v.address.country).toBe('US');
    }
  });

  it('accepts ZIP+4 and keeps an optional street2', () => {
    const v = validateShippingAddress({
      ...US_ADDRESS,
      postal_code: '84104-1234',
      street2: 'Apt 5',
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.address.postal_code).toBe('84104-1234');
      expect(v.address.street2).toBe('Apt 5');
    }
  });

  it('rejects invalid US ZIP codes', () => {
    for (const postal_code of ['8410', '841041', 'ABCDE', '84104-123']) {
      const v = validateShippingAddress({ ...US_ADDRESS, postal_code });
      expect(v.ok, postal_code).toBe(false);
    }
  });

  it('rejects a non-state and missing fields, naming each problem', () => {
    const v = validateShippingAddress({
      name: '',
      street: '',
      city: '',
      state: 'XX',
      postal_code: '84104',
      country: 'US',
    });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors.join(' ')).toMatch(/name/i);
      expect(v.errors.join(' ')).toMatch(/street/i);
      expect(v.errors.join(' ')).toMatch(/city/i);
      expect(v.errors.join(' ')).toMatch(/state/i);
    }
  });

  it('accepts a non-US address with a free-text region and postal code', () => {
    const v = validateShippingAddress({
      name: 'Alex Smith',
      street: '10 Downing Street',
      city: 'London',
      state: 'Greater London',
      postal_code: 'SW1A 2AA',
      country: 'GB',
    });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.address.country).toBe('GB');
  });

  it('rejects a bad country and a too-short non-US postal code', () => {
    expect(
      validateShippingAddress({ ...US_ADDRESS, country: 'ZZ' }).ok,
    ).toBe(false);
    expect(
      validateShippingAddress({
        name: 'A',
        street: '1 Road',
        city: 'London',
        state: 'London',
        postal_code: 'S1',
        country: 'GB',
      }).ok,
    ).toBe(false);
  });

  it('rejects a missing address outright', () => {
    expect(validateShippingAddress(undefined).ok).toBe(false);
    expect(validateShippingAddress(null).ok).toBe(false);
  });
});

describe('validatePhoneNumber (country codes)', () => {
  it('accepts and normalizes a US number with punctuation', () => {
    const v = validatePhoneNumber('US', '(801) 555-0134');
    expect(v).toEqual({ ok: true, normalized: '+18015550134' });
  });

  it('tolerates a NANP trunk 1 and full international paste', () => {
    expect(validatePhoneNumber('US', '1-801-555-0134').ok).toBe(true);
    expect(validatePhoneNumber('US', '+1 801 555 0134')).toEqual({
      ok: true,
      normalized: '+18015550134',
    });
  });

  it('accepts a UK number under the GB country code', () => {
    const v = validatePhoneNumber('GB', '07123 456789');
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.normalized).toBe('+447123456789');
  });

  it('rejects short US numbers, missing country, and garbage', () => {
    expect(validatePhoneNumber('US', '555-0134').ok).toBe(false);
    expect(validatePhoneNumber('US', '801555013').ok).toBe(false);
    expect(validatePhoneNumber('', '8015550134').ok).toBe(false);
    expect(validatePhoneNumber(undefined, '8015550134').ok).toBe(false);
    expect(validatePhoneNumber('US', 'call me!').ok).toBe(false);
    expect(validatePhoneNumber('US', '').ok).toBe(false);
  });
});

describe('catalog physical/digital survey (pin)', () => {
  it('classifies every catalog record; the digital set is exactly the services + Grimoire records', () => {
    expect(PRODUCTS).toHaveLength(62);
    const digital = PRODUCTS.filter((p) => !productRequiresShipping(p))
      .map((p) => p.handle)
      .sort();
    expect(digital).toEqual(
      [
        // Renamed 2026-11-02 (owner wording directive):
        // custom-remedy-consultation → personalized-formula-consultation.
        'personalized-formula-consultation',
        'energy-work',
        'grimoire-subscription',
        'home-aura-space-cleansing',
        'hypnotherapy-guided-relaxation',
        'past-life-inspired-guided-exploration',
        'personalized-botanical-consultation',
        'personalized-herbal-protocols',
        'rune-readings',
        'tarot-readings',
        'tarot-rune-reading',
      ].sort(),
    );
    // Spot pins on the physical side.
    for (const handle of [
      'dreamease-herbal-tea',
      'radiance-support-capsules',
      'custom-botanical-balm',
      'gaias-rose-soap',
    ]) {
      expect(
        productRequiresShipping(getProductByHandle(handle)),
        handle,
      ).toBe(true);
    }
    // Unknown records fail safe to physical.
    expect(productRequiresShipping(undefined)).toBe(true);
    expect(productRequiresShipping(null)).toBe(true);
  });
});

/* Checkout-level: address requirement follows the cart, totals don't move. */

const SOAP_ITEM = {
  product_handle: 'gaias-rose-soap',
  quantity: 1,
  customization: {
    base: 'glycerin-castor',
    shape: 'wave-rectangle',
    scent: { type: 'signature', recipe_id: 'SCENT_RECIPE_01' },
    botanical: 'lavender',
    color: 'amber-gold',
  },
  unit_price_cents: 1177,
};

const DIGITAL_ITEM = {
  product_handle: 'grimoire-subscription',
  variant_id: 'Monthly membership',
  quantity: 1,
  unit_price_cents: 777,
};

const CUSTOMER = { name: 'Jamie Rivera', email: 'jamie@example.com' };

function totalsOf(body: Record<string, unknown>) {
  const record = validateAndBuildOrder(body);
  return {
    record,
    subtotal: record.subtotal_cents,
    shipping: record.shipping_cents,
    total: record.total_cents,
  };
}

describe('validateAndBuildOrder — shipping address', () => {
  it('rejects a physical cart with no address', () => {
    expect(() =>
      validateAndBuildOrder({
        items: [SOAP_ITEM],
        customer: CUSTOMER,
        client_total_cents: 1177 + 595,
      }),
    ).toThrow(/Shipping address/);
  });

  it('rejects a physical cart with an invalid ZIP', () => {
    expect(() =>
      validateAndBuildOrder({
        items: [SOAP_ITEM],
        customer: CUSTOMER,
        shipping_address: { ...US_ADDRESS, postal_code: '8410' },
        client_total_cents: 1177 + 595,
      }),
    ).toThrow(/ZIP/);
  });

  it('stores the validated address on the record; totals match the no-address computation', () => {
    const { record, total } = totalsOf({
      items: [SOAP_ITEM],
      customer: CUSTOMER,
      shipping_address: US_ADDRESS,
      client_total_cents: 1177 + 595,
    });
    expect(total).toBe(1177 + 595);
    expect(record.shipping_address).toEqual({
      name: 'Jamie Rivera',
      street: '239 S 1200 W',
      city: 'Salt Lake City',
      state: 'UT',
      postal_code: '84104',
      country: 'US',
    } satisfies ShippingAddress);
  });

  it('a bundle always requires an address (physical soaps)', () => {
    expect(() =>
      validateAndBuildOrder({
        items: [],
        bundle: {
          bundle_id: 'soap-style-collection-5',
          slots: [
            'small-rose',
            'medium-rose',
            'plain-rectangle',
            'wave-rectangle',
            'floral-round',
          ].map((shape, i) => ({
            slot_index: i,
            shape,
            base: 'double-layer',
            scent: { type: 'custom_blend', oils: ['lavender'] },
            botanical: null,
            color: 'amber-gold',
          })),
        },
        customer: CUSTOMER,
        client_total_cents: 3577,
      }),
    ).toThrow(/Shipping address/);
  });

  it('a digital-only cart needs no address, and an address sent anyway is not stored', () => {
    const plain = totalsOf({
      items: [DIGITAL_ITEM],
      customer: CUSTOMER,
      client_total_cents: 777 + 595,
    });
    expect(plain.record.shipping_address).toBeUndefined();

    const withAddress = totalsOf({
      items: [DIGITAL_ITEM],
      customer: CUSTOMER,
      shipping_address: US_ADDRESS,
      client_total_cents: 777 + 595,
    });
    expect(withAddress.record.shipping_address).toBeUndefined();
    expect(withAddress.total).toBe(plain.total);
  });

  it('a mixed cart (digital + physical) requires the address', () => {
    expect(() =>
      validateAndBuildOrder({
        items: [DIGITAL_ITEM, SOAP_ITEM],
        customer: CUSTOMER,
        client_total_cents: 777 + 1177 + 595,
      }),
    ).toThrow(/Shipping address/);
  });
});

describe('mergeAddressPrefill (checkout prefill from profile)', () => {
  const saved: ShippingAddress = {
    name: 'Jamie Rivera',
    street: '239 S 1200 W',
    city: 'Salt Lake City',
    state: 'UT',
    postal_code: '84104',
    country: 'US',
  };
  const blank = {
    name: '',
    street: '',
    street2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
  };

  it('fills blanks from the saved address', () => {
    const merged = mergeAddressPrefill({ ...blank }, saved);
    expect(merged.street).toBe('239 S 1200 W');
    expect(merged.postal_code).toBe('84104');
    expect(merged.state).toBe('UT');
  });

  it('never overwrites what the customer already typed', () => {
    const merged = mergeAddressPrefill(
      { ...blank, street: '1 Other Way', city: 'Provo' },
      saved,
    );
    expect(merged.street).toBe('1 Other Way');
    expect(merged.city).toBe('Provo');
    expect(merged.state).toBe('UT');
  });

  it('a null saved address changes nothing', () => {
    expect(mergeAddressPrefill({ ...blank }, null)).toEqual(blank);
    expect(mergeAddressPrefill({ ...blank }, undefined)).toEqual(blank);
  });
});
