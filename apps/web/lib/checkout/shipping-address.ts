/**
 * Shipping addresses — Phase 2 (Workstream 1a + 2B checkout/profile
 * integration, owner directives 2026-10-30).
 *
 * ONE address shape and ONE validator, shared by:
 * - checkout (lib/checkout/order.ts — the server authority),
 * - registration + profile (lib/accounts — the customer's saved
 *   DEFAULT shipping address),
 * - the client forms (checkout + account), which mirror this
 *   validation for instant feedback. CLIENT = PREVIEW, SERVER =
 *   AUTHORITY: the server re-validates everything with this module.
 *
 * PURE + CLIENT-SAFE: no server imports. Country options come from
 * lib/accounts/phone.ts PHONE_COUNTRIES so the address country selector
 * and the phone country-code selector are the same list by
 * construction.
 */
import { PHONE_COUNTRIES, phoneCountryByIso2 } from '../accounts/phone';
import { sanitizePlainText } from '../security/validation';

export interface ShippingAddress {
  /** Recipient name (may differ from the account/customer name). */
  name: string;
  street: string;
  /** Apartment / suite / unit — optional. */
  street2?: string;
  city: string;
  /** US state code (US addresses); free-text region elsewhere. */
  state: string;
  /** ZIP (US: 5 digits, optional +4) or postal code. */
  postal_code: string;
  /** ISO 3166-1 alpha-2 country code. */
  country: string;
}

/** Address country options — the phone country list, by design. */
export const ADDRESS_COUNTRIES = PHONE_COUNTRIES;

/** US states + DC + the territories USPS serves with state codes. */
export const US_STATES: readonly { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' }, { code: 'AS', name: 'American Samoa' },
  { code: 'GU', name: 'Guam' }, { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'PR', name: 'Puerto Rico' }, { code: 'VI', name: 'U.S. Virgin Islands' },
];

const US_STATE_CODES: ReadonlySet<string> = new Set(US_STATES.map((s) => s.code));

export function isUsStateCode(code: unknown): boolean {
  return typeof code === 'string' && US_STATE_CODES.has(code.trim().toUpperCase());
}

export type ShippingAddressValidation =
  | { ok: true; address: ShippingAddress }
  | { ok: false; errors: string[] };

/**
 * Validate + normalize a raw address payload (same rules on client and
 * server). Every field is sanitized to plain text before it can enter
 * a record. US addresses require a real state code and a 5-digit ZIP
 * (optional +4). Other countries: state/region free text, postal code
 * 3–10 characters.
 */
export function validateShippingAddress(raw: unknown): ShippingAddressValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['A shipping address is required.'] };
  }
  const input = raw as Record<string, unknown>;
  const name = sanitizePlainText(input.name, 120);
  const street = sanitizePlainText(input.street, 160);
  const street2 = sanitizePlainText(input.street2, 120);
  const city = sanitizePlainText(input.city, 80);
  const countryRaw =
    typeof input.country === 'string' && input.country.trim()
      ? input.country.trim().toUpperCase()
      : 'US';
  const country = phoneCountryByIso2(countryRaw);
  const stateRaw = sanitizePlainText(input.state, 80);
  const postalRaw = sanitizePlainText(input.postal_code, 16);

  const errors: string[] = [];
  if (!name) errors.push('Please add the name for delivery.');
  if (!street) errors.push('Please add the street address.');
  if (!city) errors.push('Please add the city.');
  if (!country) {
    errors.push('Please choose the country.');
    return { ok: false, errors };
  }

  let state = stateRaw;
  let postal = postalRaw;
  if (country.iso2 === 'US') {
    const code = stateRaw.toUpperCase();
    if (!isUsStateCode(code)) {
      errors.push('Please choose the state.');
    } else {
      state = code;
    }
    if (!/^\d{5}(-\d{4})?$/.test(postalRaw)) {
      errors.push('Please enter a valid ZIP code (5 digits, or ZIP+4).');
    }
  } else {
    if (!stateRaw) errors.push('Please add the state, province, or region.');
    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/.test(postalRaw)) {
      errors.push('Please enter a valid postal code.');
    }
    postal = postalRaw.toUpperCase();
  }
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    address: {
      name,
      street,
      ...(street2 ? { street2 } : {}),
      city,
      state,
      postal_code: postal,
      country: country.iso2,
    },
  };
}

/** Display lines for emails, admin views, and the profile page. */
export function formatShippingAddressLines(
  address: ShippingAddress | null | undefined,
): string[] {
  if (!address) return [];
  const lines = [
    address.name,
    address.street,
    ...(address.street2 ? [address.street2] : []),
    `${address.city}, ${address.state} ${address.postal_code}`,
    address.country,
  ];
  return lines.filter((line) => typeof line === 'string' && line.trim() !== '');
}

export function formatShippingAddressOneLine(
  address: ShippingAddress | null | undefined,
): string {
  return formatShippingAddressLines(address).join(' · ');
}

/* ------------------------------------------------------------------ */
/* Physical vs digital (the codebase's distinction, made explicit)     */
/* ------------------------------------------------------------------ */

/**
 * The minimal product-record shape the physical/digital rule reads.
 * Structurally compatible with the catalog Product type.
 */
export interface FulfillmentSignals {
  category?: string;
  requires_shipping?: unknown;
  fulfillment_type?: unknown;
  delivery?: unknown;
  variants?: readonly Record<string, unknown>[] | null;
}

/** Categories that are services/digital by nature in this catalog. */
export const DIGITAL_CATEGORIES: ReadonlySet<string> = new Set([
  'Grimoire & Digital',
  'Services',
]);

function variantDeclaresDigital(variant: Record<string, unknown>): boolean {
  const fulfillment = variant.fulfillment;
  const delivery = variant.delivery;
  const kind = variant.kind;
  for (const value of [fulfillment, delivery, kind]) {
    if (typeof value === 'string' && value.toLowerCase().includes('digital')) {
      return true;
    }
  }
  return variant.requires_shipping === false;
}

/**
 * Does this catalog record describe something that must be SHIPPED?
 *
 * The catalog's physical/digital signals are sparse (surveyed
 * 2026-10-30: only some records carry explicit flags), so the rule is
 * fail-safe toward PHYSICAL — a line counts as digital ONLY when it is
 * positively identified as digital:
 * 1. an explicit record flag (requires_shipping === false, or a
 *    fulfillment_type/delivery that says digital);
 * 2. every variant on the record declaring digital fulfillment;
 * 3. the category being a digital/service category.
 * Anything else — including a record with no signals at all — ships.
 */
export function productRequiresShipping(
  product: FulfillmentSignals | null | undefined,
): boolean {
  if (!product) return true; // unknown record — treat as shippable goods
  if (product.requires_shipping === false) return false;
  if (product.requires_shipping === true) return true;
  for (const value of [product.fulfillment_type, product.delivery]) {
    if (typeof value === 'string') {
      const v = value.toLowerCase();
      if (v.startsWith('digital')) return false;
      if (v.includes('physical') || v.includes('ship')) return true;
    }
  }
  const variants = product.variants ?? [];
  if (
    variants.length > 0 &&
    variants.every((v) => variantDeclaresDigital(v as Record<string, unknown>))
  ) {
    return false;
  }
  if (product.category && DIGITAL_CATEGORIES.has(product.category)) {
    return false;
  }
  return true;
}

/**
 * Prefill merge for checkout (Phase 2B): the profile's saved address is
 * the starting point for a signed-in customer's checkout form; any
 * field the customer has already typed wins. Pure — unit-tested.
 */
export function mergeAddressPrefill<T extends Record<string, string>>(
  current: T,
  saved: ShippingAddress | null | undefined,
): T {
  if (!saved) return current;
  const next = { ...current };
  const fields: (keyof ShippingAddress)[] = [
    'name',
    'street',
    'street2',
    'city',
    'state',
    'postal_code',
    'country',
  ];
  for (const field of fields) {
    const key = field as keyof T;
    const existing = current[key];
    if (typeof existing === 'string' && existing.trim() !== '') continue;
    const value = saved[field];
    if (typeof value === 'string' && value) {
      next[key] = value as T[keyof T];
    }
  }
  return next;
}
