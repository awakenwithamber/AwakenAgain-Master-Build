/**
 * Server-side order validation + pricing — SERVER AUTHORITY.
 *
 * CLIENT = PREVIEW, SERVER = AUTHORITY: every total is recomputed here from
 * canonical data (lib/pricing + lib/cart/validation). Any client-supplied
 * total or unit price that mismatches the server computation is REJECTED.
 *
 * Lives in lib/ (not in a route module) because Next.js route files may only
 * export HTTP handlers and route config — this function is exported for the
 * regression tests and imported by app/api/checkout/route.ts.
 */
import { getProductByHandle } from '../catalog/products';
import { isSupersededProduct } from '../catalog/status';
import { BUNDLE_ID, formulaKindForHandle, getFormulaSize, toCents } from '../pricing/pricing';
import {
  sanitizeEmail,
  sanitizePhone,
  sanitizePlainText,
} from '../security/validation';
import {
  buildBundleConfiguration,
  priceCustomization,
  priceFormulaCustomization,
  validateCustomization,
  validateFormulaCustomization,
} from '../cart/validation';
import type { BundleSlot, Customization, FormulaCustomization } from '../../types';

/**
 * Product handle used by the "Create Your Own Alchemy Soap" builder for
 * fully custom soaps. It is intentionally NOT in the generated product
 * catalog (products.ts is GENERATED — do not hand-edit); it is recognized
 * here as a soap product by handle so the builder flow validates.
 */
export const CUSTOM_BUILDER_HANDLE = 'custom-alchemy-soap';

/** Customer-facing name for the custom-builder handle (ledger + UI). */
export const CUSTOM_BUILDER_TITLE = 'Custom Alchemy Soap (your creation)';

/**
 * Customizations (shape/base/scent/botanical/color) are priced from the
 * soap shape table — so they are only valid on soap products. Without this
 * gate, a valid customization could be attached to a non-soap product
 * (e.g. a $19.77 capsule variant priced at the $5.77 small-rose soap price),
 * producing an internally inconsistent order record. Mirrors the UI rule:
 * shop/[slug] renders SoapCustomizer only for category 'Soaps'.
 */
export function isSoapProduct(productHandle: string): boolean {
  if (productHandle === CUSTOM_BUILDER_HANDLE) return true;
  return getProductByHandle(productHandle)?.category === 'Soaps';
}

/**
 * Custom-formula products (G2 capsules, G10 tea): fully custom blends are
 * only valid on these two catalog handles. Without this gate, a formula
 * could be attached to any product (e.g. a standard capsule variant priced
 * without its herb add-ons), producing an internally inconsistent order
 * record. Mirrors the isSoapProduct gate above.
 */
export function isFormulaProduct(productHandle: string): boolean {
  return formulaKindForHandle(productHandle) !== null;
}

/** Customer-facing title for a formula line: product + size. */
export function formulaLineTitle(
  productHandle: string,
  formula: FormulaCustomization,
): string {
  const product = getProductByHandle(productHandle);
  const base = product?.title ?? productHandle;
  const kind = formulaKindForHandle(productHandle);
  const size = kind ? getFormulaSize(kind, formula.size_id) : undefined;
  return size ? `${base} — ${size.name} (your formula)` : `${base} (your formula)`;
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface CheckoutItemInput {
  product_handle: string;
  variant_id?: string;
  quantity: number;
  customization?: Customization;
  /** Custom capsule/tea formula — mutually exclusive with customization. */
  formula?: FormulaCustomization;
  unit_price_cents: number;
}

export interface CheckoutBundleInput {
  bundle_id: string;
  slots: BundleSlot[];
}

export interface CheckoutRequestBody {
  items: CheckoutItemInput[];
  bundle?: CheckoutBundleInput | null;
  customer: { name: string; email: string; phone?: string; notes?: string };
  is_subscriber?: boolean;
  client_total_cents: number;
  /** Optional — defaults to 'cash_app_or_venmo' when absent. */
  payment_method?: PaymentMethod;
}

export interface OrderLine {
  product_handle: string;
  title: string;
  variant_id?: string;
  variant_name?: string;
  quantity: number;
  unit_price_cents: number;
  customization?: Customization;
  formula?: FormulaCustomization;
}

export interface OrderRecord {
  order_id: string;
  created_at: string;
  computed_by: 'server';
  ledger_version: 1;
  customer: { name: string; email: string; phone?: string; notes?: string };
  items: OrderLine[];
  bundle: {
    bundle_id: string;
    slots: BundleSlot[];
    price_cents: number;
    savings_cents: number;
  } | null;
  subtotal_cents: number;
  /** 10% Living Grimoire subscriber discount — VERIFIED subscribers only. */
  subscriber_discount_cents: number;
  shipping_cents: number;
  shipping_status: 'FREE' | 'TO_BE_CONFIRMED';
  free_shipping_threshold_cents: number;
  total_cents: number;
  /** The client claimed subscriber status (body.is_subscriber === true). */
  is_subscriber_asserted: boolean;
  /**
   * The claim was verified server-side against the subscription ledger
   * (lib/subscriptions/entitlement). Benefits (subscriber shipping
   * threshold + discount) apply ONLY when this is true — the asserted
   * boolean alone never grants them.
   */
  is_subscriber_verified: boolean;
  payment_method: PaymentMethod;
  /** Order lifecycle — 'pending_payment' until payment confirmed. */
  status?: 'pending_payment' | 'paid' | 'cancelled';
}

/* ------------------------------------------------------------------ */
/* Server-side pricing + validation                                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Payment identity — owner-confirmed 2026-10-04.                       */
/* ------------------------------------------------------------------ */

/**
 * Cash App + Venmo ONLY, per the owner's payment directive.
 * (Kept here — not in the route module — because Next.js route files may
 * only export handlers and route config.)
 */
export const CASH_APP_HANDLE = '$AmberPatten347';
export const VENMO_HANDLE = '@AwakenwithAmber';

/**
 * How an order is paid (owner decisions 2026-10-13 + 2026-10-19):
 * - 'cash_app_or_venmo' — the customer sends payment to the handles above
 *   after ordering (the default; existing clients unchanged).
 * - 'stripe_card_embedded' — card payment through the embedded Stripe
 *   checkout on this site (owner directive 2026-10-19: embedded checkout
 *   is the primary card path). The order is recorded FIRST, unpaid; a
 *   Checkout Session is then created from the server-computed totals,
 *   and the order is marked paid ONLY by the signature-verified Stripe
 *   webhook — never by a client-side return.
 * - 'bookipi_card_invoice' — the BACKUP card path (kept 2026-10-19):
 *   a Bookipi invoice the owner emails from her own Bookipi account
 *   after the order is placed. Bookipi has no public API or webhooks:
 *   nothing is charged at checkout, the order record carries the
 *   choice, and fulfillment waits for the paid invoice under the same
 *   owner-confirmation gate as every other order.
 * Any other value is rejected.
 */
export type PaymentMethod =
  | 'cash_app_or_venmo'
  | 'bookipi_card_invoice'
  | 'stripe_card_embedded';

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'cash_app_or_venmo';

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash_app_or_venmo',
  'bookipi_card_invoice',
  'stripe_card_embedded',
];

/** Validate the optional payment_method field; absent means the default. */
export function parsePaymentMethod(raw: unknown): PaymentMethod {
  if (raw === undefined || raw === null) return DEFAULT_PAYMENT_METHOD;
  if (
    raw === 'cash_app_or_venmo' ||
    raw === 'bookipi_card_invoice' ||
    raw === 'stripe_card_embedded'
  ) {
    return raw;
  }
  throw new Error(
    `Unknown payment method: ${String(raw)}. Choose Cash App or Venmo, card on this site, or card by emailed invoice.`,
  );
}

export const FREE_SHIPPING_GENERAL_CENTS = 4500;
export const FREE_SHIPPING_SUBSCRIBER_CENTS = 0;

/**
 * The advertised Living Grimoire subscriber discount: 10% off, storewide.
 * Rounding follows the codebase convention (lib/catalog/shapes.ts):
 * the discounted price is Math.round(cents * 0.9).
 *
 * The membership fee itself is exempt — the grimoire-subscription catalog
 * record states the 10% benefit "applies to storewide product purchases"
 * and there is "no subscriber discount on the membership fee".
 */
export const SUBSCRIBER_DISCOUNT_EXEMPT_HANDLES: readonly string[] = [
  'grimoire-subscription',
];

/** Price after the 10% subscriber discount, rounded to the cent. */
export function subscriberDiscountedCents(cents: number): number {
  return Math.round(cents * 0.9);
}

export interface ValidateOrderOptions {
  /**
   * Server-verified subscriber entitlement for the order email. The
   * checkout route computes this from the subscription ledger
   * (lib/subscriptions/entitlement — latest record for the email must be
   * 'active', i.e. owner-confirmed). Defaults to false: an unverified
   * claim receives standard shipping pricing and no discount, without
   * blocking the order.
   */
  isSubscriberVerified?: boolean;
}

function generateOrderId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AWK-${date}-${rand}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function priceItem(input: CheckoutItemInput): OrderLine {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Order item must be an object.');
  }
  const { product_handle, variant_id, quantity, customization, formula } = input;

  if (!product_handle || typeof product_handle !== 'string') {
    throw new Error('Item is missing product_handle.');
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    throw new Error(`Invalid quantity for ${product_handle}: ${String(quantity)}.`);
  }
  if (!Number.isInteger(input.unit_price_cents) || input.unit_price_cents < 0) {
    throw new Error(`Invalid unit price claim for ${product_handle}.`);
  }

  // Superseded products are reference-only. The record stays in the
  // catalog (provenance, redirects, image registry) but the product can
  // never be ordered — at any price, subscriber or not. This guard sits
  // ABOVE the formula / customization / plain branch split below, so no
  // pricing path can bypass it (a customization or formula attached to a
  // superseded product is rejected here, not priced from the shape or
  // herb tables). The bundle path needs no equivalent check: priceBundle
  // accepts only BUNDLE_ID — the current Alchemy collection — and never
  // resolves a per-product record.
  const resolvedProduct = getProductByHandle(product_handle);
  if (resolvedProduct && isSupersededProduct(resolvedProduct)) {
    throw new Error(
      `Product ${product_handle} is no longer available — it has been superseded and cannot be ordered.`,
    );
  }

  let serverUnitCents: number;
  let variantName: string | undefined;
  let lineTitle: string | undefined;
  let cleanFormula: FormulaCustomization | undefined;

  if (formula !== undefined) {
    // Custom capsule/tea formula: exact herb IDs persisted; the server
    // reprices from canonical data (size base + per-herb add-ons).
    if (variant_id !== undefined || customization !== undefined) {
      throw new Error(
        `Item ${product_handle} has a formula plus a variant/customization — these are mutually exclusive.`,
      );
    }
    if (!isFormulaProduct(product_handle)) {
      throw new Error(
        `Item ${product_handle} is not a custom-formula product — formulas apply to custom capsules and custom teas only.`,
      );
    }
    const validation = validateFormulaCustomization(product_handle, formula);
    if (!validation.valid) {
      throw new Error(
        `Invalid formula for ${product_handle}: ${validation.errors.join('; ')}`,
      );
    }
    // Sanitize customer free-text before it enters the order record —
    // the ledger is the order system of record, no markup belongs in it.
    cleanFormula = {
      herb_ids: [...formula.herb_ids],
      size_id: formula.size_id,
      ...(formula.creation_name
        ? { creation_name: sanitizePlainText(formula.creation_name, 80) }
        : {}),
      ...(formula.intention
        ? { intention: sanitizePlainText(formula.intention, 120) }
        : {}),
      ...(formula.notes ? { notes: sanitizePlainText(formula.notes, 500) } : {}),
    };
    serverUnitCents = priceFormulaCustomization(product_handle, cleanFormula);
    lineTitle = formulaLineTitle(product_handle, cleanFormula);
  } else if (customization !== undefined) {
    if (variant_id !== undefined) {
      throw new Error(
        `Item ${product_handle} has both a variant and a customization — these are mutually exclusive.`,
      );
    }
    if (!isSoapProduct(product_handle)) {
      throw new Error(
        `Item ${product_handle} is not a soap product — customizations apply to soaps only.`,
      );
    }
    const validation = validateCustomization(customization);
    if (!validation.valid) {
      throw new Error(
        `Invalid customization for ${product_handle}: ${validation.errors.join('; ')}`,
      );
    }
    serverUnitCents = priceCustomization(customization);
  } else {
    const product = getProductByHandle(product_handle);
    if (!product) {
      throw new Error(`Unknown product: ${product_handle}.`);
    }
    if (variant_id !== undefined) {
      const variant = (product.variants ?? []).find(
        (v) =>
          v.variant_id === variant_id ||
          v.name === variant_id ||
          (typeof v.sku === 'string' && v.sku === variant_id),
      );
      if (!variant || typeof variant.price !== 'number') {
        throw new Error(
          `Unknown variant "${String(variant_id)}" for ${product_handle}.`,
        );
      }
      serverUnitCents = toCents(variant.price);
      variantName = String(variant.name ?? variant.size ?? variant_id);
    } else {
      if (typeof product.price !== 'number') {
        throw new Error(
          `Product ${product_handle} has no established price — cannot be ordered yet.`,
        );
      }
      serverUnitCents = toCents(product.price);
    }
  }

  if (input.unit_price_cents !== serverUnitCents) {
    throw new Error(
      `Price mismatch for ${product_handle}: client claimed ${input.unit_price_cents}, server computes ${serverUnitCents}.`,
    );
  }

  const product = getProductByHandle(product_handle);
  return {
    product_handle,
    title:
      lineTitle ??
      product?.title ??
      (product_handle === CUSTOM_BUILDER_HANDLE ? CUSTOM_BUILDER_TITLE : product_handle),
    quantity,
    unit_price_cents: serverUnitCents,
    ...(variant_id !== undefined ? { variant_id: String(variant_id) } : {}),
    ...(variantName !== undefined ? { variant_name: variantName } : {}),
    ...(customization !== undefined ? { customization } : {}),
    ...(cleanFormula !== undefined ? { formula: cleanFormula } : {}),
  };
}

function priceBundle(input: CheckoutBundleInput): OrderRecord['bundle'] {
  if (input.bundle_id !== BUNDLE_ID) {
    throw new Error(`Unknown bundle: ${String(input.bundle_id)}.`);
  }
  const bundle = buildBundleConfiguration(input.slots);
  return {
    bundle_id: bundle.bundle_id,
    slots: bundle.slots,
    price_cents: bundle.price_cents,
    savings_cents: bundle.savings_cents,
  };
}

/**
 * Validate + price an entire checkout payload. Throws on any problem.
 * Exported for the regression tests (no HTTP needed).
 *
 * Subscriber benefits: body.is_subscriber is a CLAIM, never proof. The
 * subscriber shipping threshold and the 10% discount apply only when the
 * caller passes options.isSubscriberVerified (computed server-side from
 * the subscription ledger). An unverified claim is priced standard —
 * never an error — because the client preview legitimately shows the
 * claimed benefits and the server recomputes authoritatively.
 */
export function validateAndBuildOrder(
  body: unknown,
  options: ValidateOrderOptions = {},
): OrderRecord {
  if (!isRecord(body)) throw new Error('Request body must be a JSON object.');

  const items = body.items;
  if (!Array.isArray(items)) throw new Error('items must be an array.');
  if (items.length > 100) throw new Error('Too many items.');

  const customer = body.customer;
  if (!isRecord(customer)) throw new Error('customer is required.');
  // Sanitize customer fields before they enter the order record: strip
  // HTML/control chars, normalize the email, validate the phone. The
  // ledger is the order system of record — no markup belongs in it.
  const name = sanitizePlainText(customer.name, 120);
  const email = sanitizeEmail(customer.email);
  if (!name) throw new Error('Customer name is required.');
  if (!email) throw new Error('A valid customer email is required.');
  const phoneRaw =
    typeof customer.phone === 'string' ? customer.phone.trim() : '';
  let phone: string | undefined;
  if (phoneRaw) {
    const normalized = sanitizePhone(phoneRaw);
    if (!normalized) {
      throw new Error(
        'Please provide a valid phone number, or leave it blank.',
      );
    }
    phone = normalized;
  }
  const notes = sanitizePlainText(customer.notes, 1000);

  // Payment method: the client's choice, validated against the two
  // supported rails; absent means the Cash App / Venmo default. The
  // choice never affects pricing — subscriber benefits compute
  // identically for both methods.
  const paymentMethod = parsePaymentMethod(body.payment_method);

  // The checkbox is a claim the server verifies (see header note). The
  // bare boolean by itself grants NOTHING.
  const isSubscriberAsserted = body.is_subscriber === true;
  const isSubscriberVerified =
    isSubscriberAsserted && options.isSubscriberVerified === true;

  const lines: OrderLine[] = items.map((item) =>
    priceItem(item as CheckoutItemInput),
  );

  if (lines.length === 0 && (body.bundle === undefined || body.bundle === null)) {
    throw new Error('Order has no items.');
  }

  let bundle: OrderRecord['bundle'] = null;
  if (body.bundle !== undefined && body.bundle !== null) {
    bundle = priceBundle(body.bundle as CheckoutBundleInput);
  }

  const subtotal = lines.reduce(
    (sum, line) => sum + line.unit_price_cents * line.quantity,
    0,
  );
  const bundleTotal = bundle ? bundle.price_cents : 0;
  const subtotalCents = subtotal + bundleTotal;

  // Subscriber discount — VERIFIED subscribers only. The discountable
  // base excludes the membership fee itself (see the exempt-handles note
  // above); the bundle is a storewide product purchase and is included.
  const discountableCents =
    lines.reduce(
      (sum, line) =>
        sum +
        (SUBSCRIBER_DISCOUNT_EXEMPT_HANDLES.includes(line.product_handle)
          ? 0
          : line.unit_price_cents * line.quantity),
      0,
    ) + bundleTotal;
  const claimedDiscountCents =
    discountableCents - subscriberDiscountedCents(discountableCents);
  const subscriberDiscountCents = isSubscriberVerified
    ? claimedDiscountCents
    : 0;

  const threshold = isSubscriberVerified
    ? FREE_SHIPPING_SUBSCRIBER_CENTS
    : FREE_SHIPPING_GENERAL_CENTS;
  const shippingStatus = subtotalCents >= threshold ? 'FREE' : 'TO_BE_CONFIRMED';
  // Shipping is never added to the total — see shipping rule. The total
  // is the subtotal minus any VERIFIED subscriber discount.
  const totalCents = subtotalCents - subscriberDiscountCents;

  // Total check. Without a subscriber claim the client total must equal
  // the server total exactly (tamper rejection, unchanged). With a claim,
  // the client preview legitimately shows one of two server-computable
  // figures — the standard total or the claimed-subscriber total — so both
  // are accepted; the RECORDED total is always the server's own figure for
  // the verification outcome. Any other client total is still rejected.
  const standardTotalCents = subtotalCents;
  const claimedSubscriberTotalCents = subtotalCents - claimedDiscountCents;
  const totalMatches = isSubscriberAsserted
    ? body.client_total_cents === standardTotalCents ||
      body.client_total_cents === claimedSubscriberTotalCents
    : body.client_total_cents === standardTotalCents;
  if (!totalMatches) {
    throw new Error(
      `Total mismatch: client claimed ${String(body.client_total_cents)}, server computes ${totalCents}.`,
    );
  }

  return {
    order_id: generateOrderId(),
    created_at: new Date().toISOString(),
    computed_by: 'server',
    ledger_version: 1,
    customer: {
      name,
      email,
      ...(phone ? { phone } : {}),
      ...(notes ? { notes } : {}),
    },
    items: lines,
    bundle,
    subtotal_cents: subtotalCents,
    subscriber_discount_cents: subscriberDiscountCents,
    shipping_cents: 0,
    shipping_status: shippingStatus,
    free_shipping_threshold_cents: threshold,
    total_cents: totalCents,
    is_subscriber_asserted: isSubscriberAsserted,
    is_subscriber_verified: isSubscriberVerified,
    payment_method: paymentMethod,
  };
}
