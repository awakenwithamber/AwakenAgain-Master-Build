/**
 * Sales tax calculation — provider-agnostic engine (staged build
 * 2026-10-28, owner decision: "Calculate sales tax by customer
 * address at checkout", matching the standing rule that tax is
 * calculated from the customer's address as the parked Stripe Tax
 * flow did).
 *
 * SHAPE: a TaxProvider takes a destination address + taxable lines
 * and returns the tax in cents plus a full breakdown (jurisdiction,
 * rate, and where both came from). The built-in provider below is
 * the verified Utah path (lib/tax/utah.ts). A future hosted tax
 * service can implement the same interface without touching the
 * checkout code — by owner canon, no Stripe-owned service may ever
 * be plugged in here (that excludes the Stripe-owned tax products
 * by construction, not just by configuration).
 *
 * WHAT IS IMPLEMENTED (verified from the Utah State Tax Commission,
 * Publication 25 + the quarterly combined rate chart — see
 * lib/tax/utah.ts for full provenance):
 * - Destination in Utah → the combined rate of the seller's fixed
 *   place of business (Salt Lake City, 8.45% effective 2026-10-01).
 *   Utah sources a retail sale of tangible personal property in
 *   Utah to the seller's fixed place of business whether or not the
 *   goods are delivered (Pub 25, Chart 1, "Point-of-Sale
 *   Sourcing"), so the customer's address decides THAT Utah tax
 *   applies, and Utah law fixes the rate jurisdiction. The
 *   destination is still recorded on every breakdown.
 * - Separately stated delivery charges are NOT taxed (Pub 25:
 *   purchase price "does not include delivery charges if stated
 *   separately"). Checkout states shipping as its own line, so the
 *   caller passes shipping separately and it never enters the base.
 * - Destination outside Utah → NO tax collected (0 cents). Posture,
 *   stated plainly: the seller has no physical presence outside
 *   Utah, and at the shop's current volume (~$100/month) it is far
 *   below the economic-nexus thresholds other states set (Utah's
 *   own threshold, per Pub 25, is more than $100,000 of in-state
 *   sales in the year or prior year; most states use a comparable
 *   $100,000 figure). This is an ASSUMPTION for the owner / her CPA
 *   to confirm, recorded on every out-of-state breakdown — it is
 *   NOT legal advice, and this module is a calculator, not a
 *   compliance opinion.
 *
 * WHAT IS NOT IMPLEMENTED (flagged, never guessed):
 * - Any non-Utah jurisdiction's rate (no rate is invented for
 *   another state; out-of-state orders collect 0 under the posture
 *   above until the owner/CPA direct otherwise).
 * - Utah's reduced grocery-food rate: whether any catalog product
 *   (e.g. an herbal tea sold for ingestion) is "grocery food" at the
 *   reduced combined rate is a product-classification question for
 *   the owner/CPA. Lines carry a taxable flag and a category label
 *   so a classification can be applied later; today every
 *   merchandise line is taxed at the general combined rate.
 * - Exemption certificates (entity/use-based) — no checkout surface
 *   collects them.
 *
 * SERVER-ONLY by convention (imported by server order building);
 * the module itself is pure and deterministic for tests.
 */
import {
  UTAH_RATE_EFFECTIVE_DATE,
  UTAH_RATE_SOURCE,
  UTAH_SALT_LAKE_CITY_COMBINED_RATE_BPS,
  UTAH_SALT_LAKE_CITY_COMBINED_RATE_PERCENT,
  UTAH_SELLER_JURISDICTION,
} from './utah';

/* ------------------------------------------------------------------ */
/* Interface (provider-agnostic)                                        */
/* ------------------------------------------------------------------ */

/** A US postal address used for tax determination. */
export interface TaxAddress {
  line1: string;
  line2?: string;
  city: string;
  /** Two-letter US state code, uppercased by the caller. */
  state: string;
  /** ZIP or ZIP+4. */
  postalCode: string;
  country: 'US';
}

/** One taxable (or explicitly non-taxable) amount in the base. */
export interface TaxableLine {
  /** Customer-meaningful label recorded on the breakdown. */
  description: string;
  /** Extended amount in cents; a discount line is negative. */
  amountCents: number;
  /** Whether this line enters the taxable base at all. */
  taxable: boolean;
  /** Classification label (provenance for a future CPA ruling). */
  category?: string;
}

export interface TaxCalculationInput {
  destination: TaxAddress;
  lines: TaxableLine[];
  /** Separately stated delivery charge in cents (never taxed here). */
  shippingCents: number;
}

export interface TaxBreakdownLine {
  description: string;
  amountCents: number;
  taxable: boolean;
  category: string | null;
  /** The amount this line contributed to the taxable base. */
  baseCents: number;
}

/**
 * The full, storable result. This is what the order record carries
 * (lib/checkout/order.ts) so any later reader — admin, webhook,
 * customer email — can see exactly what was charged and why.
 */
export interface TaxCalculation {
  /** Tax to add to the charge, in cents. */
  taxCents: number;
  /** Sum of taxable line amounts the rate was applied to. */
  taxableBaseCents: number;
  /** True when tax was actually collected (Utah path). */
  collected: boolean;
  /** Human-readable jurisdiction the rate belongs to. */
  jurisdiction: string;
  /** Rate applied, in basis points (0 when nothing collected). */
  rateBps: number;
  /** Rate as printed (e.g. '8.45%'), or '0%' when none. */
  ratePercent: string;
  /** Which provider produced this calculation. */
  providerId: string;
  /** Where the rate/sourcing came from (source + date). */
  provenance: string;
  /** The destination the calculation was made for. */
  destination: TaxAddress;
  lines: TaxBreakdownLine[];
  /** Separately stated shipping, recorded as excluded from the base. */
  shippingCents: number;
  shippingTaxed: false;
  /** Assumptions and exclusions, in plain language. */
  notes: string[];
}

export interface TaxProvider {
  readonly id: string;
  calculateTax(input: TaxCalculationInput): TaxCalculation;
}

/* ------------------------------------------------------------------ */
/* Built-in provider — verified Utah path                               */
/* ------------------------------------------------------------------ */

export const UTAH_TAX_PROVIDER_ID = 'builtin-utah-tax-commission-rates';

const OUT_OF_STATE_NOTE =
  'No sales tax collected on this out-of-state order. ASSUMPTION ' +
  '(for the owner/CPA to confirm, not legal advice): the seller ' +
  'has no physical presence outside Utah and its sales volume is ' +
  'far below other states\u2019 economic-nexus thresholds (Utah\u2019s own ' +
  'threshold is more than $100,000 of in-state sales per Pub 25).';

const SHIPPING_NOTE =
  'Separately stated delivery charges are excluded from the ' +
  'taxable base (Utah Publication 25: purchase price does not ' +
  'include delivery charges if stated separately).';

function roundHalfUp(numerator: number, denominator: number): number {
  // Non-negative amounts only in this engine (the taxable base is
  // clamped at 0 before this is called).
  return Math.floor((numerator + denominator / 2) / denominator);
}

export const utahTaxProvider: TaxProvider = {
  id: UTAH_TAX_PROVIDER_ID,

  calculateTax(input: TaxCalculationInput): TaxCalculation {
    const lines: TaxBreakdownLine[] = input.lines.map((line) => ({
      description: line.description,
      amountCents: line.amountCents,
      taxable: line.taxable,
      category: line.category ?? null,
      baseCents: line.taxable ? line.amountCents : 0,
    }));
    const taxableBaseCents = Math.max(
      0,
      lines.reduce((sum, line) => sum + line.baseCents, 0),
    );
    const base = {
      taxableBaseCents,
      providerId: UTAH_TAX_PROVIDER_ID,
      destination: input.destination,
      lines,
      shippingCents: input.shippingCents,
      shippingTaxed: false as const,
    };

    if (input.destination.state !== UTAH_SELLER_JURISDICTION.state) {
      return {
        ...base,
        taxCents: 0,
        collected: false,
        jurisdiction:
          `${input.destination.city}, ${input.destination.state} ` +
          '(outside Utah — no tax collected)',
        rateBps: 0,
        ratePercent: '0%',
        provenance:
          'No rate applied. Out-of-state posture recorded in the ' +
          'notes; no non-Utah rate is implemented or invented.',
        notes: [OUT_OF_STATE_NOTE, SHIPPING_NOTE],
      };
    }

    const taxCents = roundHalfUp(
      taxableBaseCents * UTAH_SALT_LAKE_CITY_COMBINED_RATE_BPS,
      10_000,
    );
    return {
      ...base,
      taxCents,
      collected: true,
      jurisdiction:
        `${UTAH_SELLER_JURISDICTION.city}, ${UTAH_SELLER_JURISDICTION.county}, ` +
        'UT — seller\u2019s fixed place of business (Utah point-of-sale ' +
        'sourcing)',
      rateBps: UTAH_SALT_LAKE_CITY_COMBINED_RATE_BPS,
      ratePercent: UTAH_SALT_LAKE_CITY_COMBINED_RATE_PERCENT,
      provenance: UTAH_RATE_SOURCE,
      notes: [
        'Utah sources a retail sale of tangible personal property ' +
          'in Utah to the seller\u2019s fixed place of business whether ' +
          'or not the goods are delivered (Publication 25, Chart 1), ' +
          'so the Salt Lake City combined rate applies to this ' +
          `Utah-destination order. Rate effective ${UTAH_RATE_EFFECTIVE_DATE}; ` +
          'Utah rates can change quarterly — re-verify before a new ' +
          'quarter (see BUILD-REPORT.md, TAX ADDENDUM).',
        SHIPPING_NOTE,
      ],
    };
  },
};

/** The default provider used by checkout today. */
export function getDefaultTaxProvider(): TaxProvider {
  return utahTaxProvider;
}

/** Convenience wrapper over the default provider. */
export function calculateSalesTax(
  input: TaxCalculationInput,
): TaxCalculation {
  return getDefaultTaxProvider().calculateTax(input);
}
