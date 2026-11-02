/**
 * Utah sales tax rate data — VERIFIED OFFICIAL SOURCE ONLY.
 *
 * Every figure in this file comes from the Utah State Tax Commission
 * (tax.utah.gov), retrieved 2026-10-28. Nothing here is estimated,
 * scraped from a third-party aggregator, or carried over from the
 * parked Stripe Tax configuration:
 *
 * - COMBINED RATE: "Combined Sales and Use Tax Rates" chart for the
 *   quarter effective October 1, 2026 (file 26q4combined.xlsx,
 *   files.tax.utah.gov/tax/salestax/rate/), row "Salt Lake City",
 *   location code 18-122: Combined Sales Rate 8.45%. Components as
 *   printed in the chart: state 4.85% + local option 1.00% + county
 *   option 0.25% + mass transit 0.30% + mass transit additional
 *   0.25% + county option transportation 0.25% + county option
 *   highways/public transit 0.25% + supplemental 0.20% + arts & zoo
 *   0.10% + correctional facility 0.50% + emergency services 0.50%
 *   = 8.45%. (The 4.85% state rate and the 1.00% / 0.25% local and
 *   county option rates are also stated in Publication 25, Chart 2.)
 * - SOURCING: Utah Publication 25 ("Sales and Use Tax General
 *   Information", tax.utah.gov/forms-pubs/pubs/pub-25/), "Determining
 *   Tax Rate (Point-of-Sale Sourcing)", Chart 1: a retail sale of
 *   tangible personal property in Utah is sourced to the SELLER'S
 *   FIXED PLACE OF BUSINESS "whether or not the goods or services
 *   are delivered" (the chart's footnote includes products
 *   transferred electronically in the marked rows). The seller's
 *   fixed place of business for this shop is Salt Lake City, Utah —
 *   so the Salt Lake City combined rate applies to every
 *   Utah-destination shop order, wherever in Utah it is delivered.
 * - DELIVERY CHARGES: Publication 25, Definitions (UCA §59-12-102):
 *   "Purchase price and sales price of tangible personal property do
 *   not include delivery charges if stated separately." Checkout
 *   states shipping as its own line, so shipping is NOT in the
 *   taxable base (the engine in lib/tax/tax.ts encodes this).
 * - RATES CHANGE QUARTERLY: Publication 25: "Tax rates and
 *   jurisdictional boundaries can change quarterly. The Tax
 *   Commission posts these changes 60 days before the effective
 *   date." The rate below is effective 2026-10-01; re-verify against
 *   the current quarter's combined chart before relying on it in a
 *   later quarter (see TAX ADDENDUM in BUILD-REPORT.md).
 *
 * This data is a calculation input, not tax advice.
 */

/** The seller's fixed place of business (Utah point-of-sale sourcing). */
export const UTAH_SELLER_JURISDICTION = {
  city: 'Salt Lake City',
  county: 'Salt Lake County',
  state: 'UT',
  /** Location code in the Tax Commission combined rate chart. */
  locationCode: '18-122',
} as const;

/**
 * Combined sales and use tax rate for Salt Lake City, in basis
 * points (845 = 8.45%), per the Tax Commission combined chart
 * effective 2026-10-01 (see header for provenance).
 */
export const UTAH_SALT_LAKE_CITY_COMBINED_RATE_BPS = 845;

/** The same rate as the chart prints it. */
export const UTAH_SALT_LAKE_CITY_COMBINED_RATE_PERCENT = '8.45%';

/** Quarter the rate in this file was verified for. */
export const UTAH_RATE_EFFECTIVE_DATE = '2026-10-01';

/** Provenance string recorded on every Utah tax breakdown. */
export const UTAH_RATE_SOURCE =
  'Utah State Tax Commission — Combined Sales and Use Tax Rates ' +
  'chart (26Q4, effective 2026-10-01), Salt Lake City (location ' +
  'code 18-122): combined rate 8.45%. Sourcing: Publication 25, ' +
  'Chart 1 (point-of-sale — seller\u2019s fixed place of business). ' +
  'Retrieved from tax.utah.gov on 2026-10-28.';
