/**
 * Sales tax engine — tests (staged build 2026-10-28).
 *
 * The Utah expectations are computed BY HAND from the verified
 * official figure: Utah State Tax Commission, Combined Sales and
 * Use Tax Rates chart effective 2026-10-01, Salt Lake City
 * (location code 18-122), combined rate 8.45% (see lib/tax/utah.ts
 * for the full citation). $19.77 × 8.45% = $1.670565 → 167 cents;
 * $100.00 × 8.45% = 845 cents exactly.
 */
import { describe, expect, it } from 'vitest';
import {
  calculateSalesTax,
  utahTaxProvider,
  type TaxAddress,
} from './tax';

const SLC_HOME: TaxAddress = {
  line1: '239 S 1200 W',
  city: 'Salt Lake City',
  state: 'UT',
  postalCode: '84104',
  country: 'US',
};

const PROVO: TaxAddress = {
  line1: '100 N University Ave',
  city: 'Provo',
  state: 'UT',
  postalCode: '84601',
  country: 'US',
};

const DENVER: TaxAddress = {
  line1: '1600 Broadway',
  city: 'Denver',
  state: 'CO',
  postalCode: '80202',
  country: 'US',
};

describe('utah path — destination in Utah', () => {
  it('applies the verified Salt Lake City combined rate of 8.45%', () => {
    const result = calculateSalesTax({
      destination: SLC_HOME,
      lines: [{ description: 'Capsules', amountCents: 1977, taxable: true }],
      shippingCents: 595,
    });
    expect(result.taxableBaseCents).toBe(1977);
    expect(result.taxCents).toBe(167); // 1977 × 0.0845 = 167.0565 → 167
    expect(result.rateBps).toBe(845);
    expect(result.ratePercent).toBe('8.45%');
    expect(result.collected).toBe(true);
    expect(result.providerId).toBe(utahTaxProvider.id);
    expect(result.provenance).toContain('Utah State Tax Commission');
    expect(result.provenance).toContain('8.45%');
  });

  it('computes an exact-dollar base exactly ($100.00 → 845 cents)', () => {
    const result = calculateSalesTax({
      destination: SLC_HOME,
      lines: [{ description: 'Bundle', amountCents: 10000, taxable: true }],
      shippingCents: 0,
    });
    expect(result.taxCents).toBe(845);
  });

  it('rounds half up to the nearest cent', () => {
    const result = calculateSalesTax({
      destination: SLC_HOME,
      lines: [{ description: 'Soap', amountCents: 150, taxable: true }],
      shippingCents: 0,
    });
    expect(result.taxCents).toBe(13); // 150 × 0.0845 = 12.675 → 13
  });

  it('excludes separately stated shipping from the taxable base', () => {
    const result = calculateSalesTax({
      destination: SLC_HOME,
      lines: [{ description: 'Capsules', amountCents: 1977, taxable: true }],
      shippingCents: 595,
    });
    expect(result.shippingCents).toBe(595);
    expect(result.shippingTaxed).toBe(false);
    // Tax is on 1977, NOT on 1977 + 595 = 2572 (which would be 217).
    expect(result.taxCents).toBe(167);
    expect(result.notes.join(' ')).toContain('delivery charges');
  });

  it('a Utah destination outside Salt Lake City still uses the seller\u2019s rate (point-of-sale sourcing)', () => {
    const result = calculateSalesTax({
      destination: PROVO,
      lines: [{ description: 'Tea', amountCents: 1977, taxable: true }],
      shippingCents: 595,
    });
    expect(result.taxCents).toBe(167);
    expect(result.jurisdiction).toContain('Salt Lake City');
    expect(result.jurisdiction).toContain('point-of-sale');
    expect(result.destination.city).toBe('Provo');
  });

  it('non-taxable lines stay out of the base; discount lines reduce it', () => {
    const result = calculateSalesTax({
      destination: SLC_HOME,
      lines: [
        { description: 'Capsules', amountCents: 2000, taxable: true },
        { description: 'Gift wrap sample', amountCents: 500, taxable: false },
        {
          description: 'Subscriber discount',
          amountCents: -200,
          taxable: true,
        },
      ],
      shippingCents: 0,
    });
    expect(result.taxableBaseCents).toBe(1800);
    expect(result.taxCents).toBe(152); // 1800 × 0.0845 = 152.1 → 152
    expect(result.lines[1].baseCents).toBe(0);
    expect(result.lines[2].baseCents).toBe(-200);
  });

  it('a fully discounted order has a zero base and zero tax', () => {
    const result = calculateSalesTax({
      destination: SLC_HOME,
      lines: [
        { description: 'Capsules', amountCents: 2000, taxable: true },
        { description: 'Discount', amountCents: -2000, taxable: true },
      ],
      shippingCents: 0,
    });
    expect(result.taxableBaseCents).toBe(0);
    expect(result.taxCents).toBe(0);
    expect(result.collected).toBe(true);
  });
});

describe('out-of-state posture', () => {
  it('collects nothing and names the nexus assumption on the breakdown', () => {
    const result = calculateSalesTax({
      destination: DENVER,
      lines: [{ description: 'Capsules', amountCents: 1977, taxable: true }],
      shippingCents: 595,
    });
    expect(result.taxCents).toBe(0);
    expect(result.collected).toBe(false);
    expect(result.rateBps).toBe(0);
    expect(result.jurisdiction).toContain('CO');
    const notes = result.notes.join(' ');
    expect(notes).toContain('ASSUMPTION');
    expect(notes).toContain('not legal advice');
    expect(notes).toContain('$100,000');
  });
});
