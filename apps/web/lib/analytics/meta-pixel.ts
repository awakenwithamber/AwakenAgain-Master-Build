/**
 * Meta (Facebook) pixel client — consent-first, env-gated, dark by default.
 * CLIENT-ONLY: never import this module from a Server Component or Route
 * Handler.
 *
 * Purpose (owner-approved 2026-10-30): build the website-visitor
 * remarketing audience for the planned Meta campaign. The pixel exists
 * ONLY to make that audience possible; it is not a general tracker.
 *
 * DARK BY DEFAULT (same discipline as CARD_PAYMENTS_ENABLED): the pixel
 * ID comes from NEXT_PUBLIC_META_PIXEL_ID. When it is unset or empty this
 * module renders nothing, loads nothing, and makes no network calls —
 * the fbevents.js script is never even requested. The ID is a public
 * identifier by design (it ships in page source wherever the pixel runs,
 * like the PostHog project token), so NEXT_PUBLIC_ is correct — but it
 * still lives in env, never hard-coded, so staging can stay dark while
 * production is lit.
 *
 * CONSENT (owner spec 2026-10-14, lib/personalization/consent.ts): the
 * pixel loads and fires ONLY in the 'accepted' consent state — stricter
 * than PostHog, which may count anonymous pageviews pre-choice; Meta's
 * pixel has no anonymous mode worth having, so nothing fires before a
 * grant. Consent changes are applied through applyMetaConsent(), wired
 * into the same choke point as PostHog (lib/personalization/client.ts):
 *   accepted → load (once) + fbq('consent', 'grant')
 *   declined → fbq('consent', 'revoke') if loaded; never load otherwise
 *   unknown (withdrawal reset) → revoke if loaded, exactly like PostHog's
 *              opt-out-until-a-fresh-choice posture.
 *
 * EVENTS (deliberately few):
 *   PageView    — route changes, via components/analytics/MetaPixelTracker.
 *   ViewContent — product pages, via components/shop/ProductViewTracker.
 *   Lead        — ONLY the quiz lead-capture success (the visitor handed
 *                 over contact details with server confirmation). The
 *                 contact form's success event is server-owned by design
 *                 (EVENT_OWNERSHIP) and is NOT mirrored here.
 *   NO Purchase — checkout completes off-site (Bluevine invoice flow;
 *                 Bookipi-era wording updated in the 2026-11-02 port),
 *                 so an on-site Purchase event would be false data.
 *                 There is no Purchase function in this module on
 *                 purpose (a test pins its absence).
 *
 * Analytics failures are never customer-facing: every entry point
 * swallows errors and drops silently when unconfigured.
 */
import {
  canCaptureDetails,
  readBrowserConsentState,
  type ConsentState,
} from '../personalization/consent';

/** The env var the pixel ID is read from (documented in .env.example). */
export const META_PIXEL_ID_ENV = 'NEXT_PUBLIC_META_PIXEL_ID';

const PIXEL_SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

/** Minimal fbq surface: the official stub accepts variadic arguments. */
export type FbqFunction = (...args: unknown[]) => void;

interface MetaPixelWindow {
  fbq?: FbqFunction & { queue?: unknown[][]; loaded?: boolean; version?: string };
  _fbq?: unknown;
}

/* ------------------------------------------------------------------ */
/* Pure rules (unit-tested without a browser)                          */
/* ------------------------------------------------------------------ */

/**
 * Resolve the pixel ID from an env record. Unset, empty, or
 * whitespace-only means NO pixel — returns null.
 */
export function resolveMetaPixelId(
  env: Record<string, string | undefined>,
): string | null {
  const raw = env[META_PIXEL_ID_ENV];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * The pixel may load/fire only when an ID is configured AND the visitor
 * has accepted analytics consent. Any other combination is dark.
 */
export function shouldActivateMetaPixel(
  pixelId: string | null,
  state: ConsentState,
): boolean {
  return pixelId !== null && canCaptureDetails(state);
}

export interface MetaConsentPlan {
  /** Inject the script + init the pixel (first activation only). */
  load: boolean;
  /** Call fbq('consent', 'grant') — pixel booted and consent is on. */
  grant: boolean;
  /** Call fbq('consent', 'revoke') — pixel booted and consent is off. */
  revoke: boolean;
}

/**
 * Decision table for a consent state change, mirroring how
 * applyAnalyticsConsent reconciles PostHog: accepted turns capture on,
 * anything else turns it off (declined = explicit no; unknown after a
 * withdrawal = opted out until a fresh choice is made).
 */
export function planMetaConsentActions(
  state: ConsentState,
  booted: boolean,
): MetaConsentPlan {
  if (state === 'accepted') {
    return booted
      ? { load: false, grant: true, revoke: false }
      : { load: true, grant: false, revoke: false };
  }
  return booted
    ? { load: false, grant: false, revoke: true }
    : { load: false, grant: false, revoke: false };
}

export interface MetaViewContentInput {
  /** Catalog handle — Meta's content id for the product. */
  handle: string;
  title?: string;
  category?: string;
  /** Integer cents; converted to Meta's decimal `value` when present. */
  priceCents?: number;
}

export interface MetaViewContentParams {
  content_ids: string[];
  content_type: 'product';
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: 'USD';
}

/** Build the standard ViewContent payload. Pure. */
export function buildViewContentParams(
  input: MetaViewContentInput,
): MetaViewContentParams {
  const params: MetaViewContentParams = {
    content_ids: [input.handle],
    content_type: 'product',
  };
  if (input.title) params.content_name = input.title;
  if (input.category) params.content_category = input.category;
  if (typeof input.priceCents === 'number') {
    params.value = input.priceCents / 100;
    params.currency = 'USD';
  }
  return params;
}

export type MetaStandardEvent = 'PageView' | 'ViewContent' | 'Lead';

export interface MetaDispatchDeps {
  pixelId: string | null;
  consentState: ConsentState;
  fbq: FbqFunction | undefined;
}

/**
 * The single gate every Meta event passes through: configured ID +
 * accepted consent + an installed fbq. Returns true only when the event
 * was actually handed to fbq. Pure given its deps — the browser entry
 * points below delegate here with live deps.
 */
export function dispatchMetaEvent(
  deps: MetaDispatchDeps,
  event: MetaStandardEvent,
  params?: Record<string, unknown>,
): boolean {
  if (!shouldActivateMetaPixel(deps.pixelId, deps.consentState)) return false;
  if (typeof deps.fbq !== 'function') return false;
  try {
    if (params) deps.fbq('track', event, params);
    else deps.fbq('track', event);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Browser adapters (the only window-touching code in this module)     */
/* ------------------------------------------------------------------ */

const CONFIGURED_ID: string | null = resolveMetaPixelId({
  [META_PIXEL_ID_ENV]: process.env.NEXT_PUBLIC_META_PIXEL_ID,
});

/** The configured pixel ID for this build, or null when dark. */
export function getMetaPixelId(): string | null {
  return CONFIGURED_ID;
}

/** True when this build carries a pixel ID (consent is a separate gate). */
export function isMetaPixelConfigured(): boolean {
  return CONFIGURED_ID !== null;
}

function browserWindow(): MetaPixelWindow | null {
  try {
    if (typeof window === 'undefined') return null;
    return window as unknown as MetaPixelWindow;
  } catch {
    return null;
  }
}

let booted = false;

/**
 * Install the official fbq stub and request fbevents.js (the stub queues
 * calls until the real script lands — the standard Meta snippet,
 * reproduced faithfully). Idempotent; a no-op without an ID. Only ever
 * called after consent is accepted.
 */
function bootMetaPixel(): void {
  const pixelId = CONFIGURED_ID;
  const win = browserWindow();
  if (!pixelId || !win || booted) return;
  try {
    if (!win.fbq) {
      const fbq = function (...args: unknown[]) {
        const self = fbq as typeof fbq & {
          callMethod?: (...a: unknown[]) => void;
          queue?: unknown[][];
        };
        if (self.callMethod) self.callMethod(...args);
        else self.queue?.push(args);
      } as NonNullable<MetaPixelWindow['fbq']>;
      fbq.queue = [];
      fbq.loaded = true;
      fbq.version = '2.0';
      win.fbq = fbq;
      if (!win._fbq) win._fbq = fbq;
      const script = document.createElement('script');
      script.async = true;
      script.src = PIXEL_SCRIPT_SRC;
      const first = document.getElementsByTagName('script')[0];
      if (first?.parentNode) first.parentNode.insertBefore(script, first);
      else document.head.appendChild(script);
    }
    win.fbq('init', pixelId);
    booted = true;
  } catch {
    /* analytics failures are never customer-facing */
  }
}

/**
 * Reconcile the live pixel with a consent state (called by
 * lib/personalization/client.ts at the same choke point as PostHog).
 * accepted → boot once (or re-grant after a revoke); declined/unknown →
 * revoke when booted, and never boot.
 */
export function applyMetaConsent(state: ConsentState): void {
  const win = browserWindow();
  if (!win || !CONFIGURED_ID) return;
  const plan = planMetaConsentActions(state, booted);
  try {
    if (plan.load) bootMetaPixel();
    else if (plan.grant) win.fbq?.('consent', 'grant');
    else if (plan.revoke) win.fbq?.('consent', 'revoke');
  } catch {
    /* analytics failures are never customer-facing */
  }
}

/** Live deps for the dispatch gate, read fresh at every call. */
function liveDeps(): MetaDispatchDeps {
  return {
    pixelId: CONFIGURED_ID,
    consentState: readBrowserConsentState(),
    fbq: browserWindow()?.fbq,
  };
}

/**
 * Boot the pixel if consent was already accepted in a previous session
 * (returning visitor on page load). No-op once booted — grant/revoke
 * reconciliation for later consent changes lives in applyMetaConsent,
 * driven by lib/personalization/client.ts.
 */
export function ensureMetaPixelForConsent(): void {
  if (booted) return;
  applyMetaConsent(readBrowserConsentState());
}

/** PageView for the current route (route tracker component calls this). */
export function trackMetaPageView(): boolean {
  ensureMetaPixelForConsent();
  return dispatchMetaEvent(liveDeps(), 'PageView');
}

/** ViewContent for a product page (ProductViewTracker calls this). */
export function trackMetaViewContent(input: MetaViewContentInput): boolean {
  ensureMetaPixelForConsent();
  return dispatchMetaEvent(
    liveDeps(),
    'ViewContent',
    buildViewContentParams(input) as unknown as Record<string, unknown>,
  );
}

/**
 * Once-per-key ViewContent variant (mirrors posthog.ts trackOnce):
 * StrictMode double-effects and re-renders must not double-fire.
 */
const firedKeys = new Set<string>();
export function trackMetaViewContentOnce(
  key: string,
  input: MetaViewContentInput,
): boolean {
  if (firedKeys.has(key)) return false;
  firedKeys.add(key);
  return trackMetaViewContent(input);
}

/**
 * Lead — quiz lead-capture success ONLY (see header). Fired from the
 * confirmed-success branch of the quiz submit handler, after the server
 * accepted the lead.
 */
export function trackMetaLead(): boolean {
  ensureMetaPixelForConsent();
  return dispatchMetaEvent(liveDeps(), 'Lead');
}

/** Test hook: has the pixel booted in this page session? */
export function isMetaPixelBooted(): boolean {
  return booted;
}
