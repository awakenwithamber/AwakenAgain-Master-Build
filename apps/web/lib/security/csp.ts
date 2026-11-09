/**
 * Content-Security-Policy builder — nonce-based (Aikido issue 845087258 fix).
 *
 * Target location in repo: apps/web/lib/security/csp.ts
 *
 * Built from EVIDENCE in this codebase (audit remediation, Phase 2). Every
 * non-'self' origin below names why it is allowed; do not add an origin
 * without the same evidence:
 * - script-src https://us-assets.i.posthog.com — posthog-js (installed SDK)
 *   lazy-loads its feature modules (surveys, web-vitals, etc.) from its
 *   assets host. The SDK core itself is bundled same-origin. Under
 *   'strict-dynamic', scripts inserted by a nonce-trusted script inherit
 *   trust; the host entry remains as a fallback for older browsers.
 * - style-src https://fonts.googleapis.com + font-src
 *   https://fonts.gstatic.com — Google Fonts stylesheets linked in
 *   app/layout.tsx and components/grimoire/GrimoireBook.tsx; the font
 *   files themselves are served from fonts.gstatic.com.
 * - img-src https://d2xsxph8kpxj0f.cloudfront.net +
 *   https://files.manuscdn.com — herb illustration images referenced by
 *   lib/herbs/illustrations.ts and rendered on the herb library pages.
 * - img-src https://upload.wikimedia.org +
 *   https://thumb.wikimedia.org (added 2026-11-08) — the Wikimedia
 *   Commons botanical illustrations in the same map: the entries the
 *   2026-10-29 correction pass verified as the correct species, with
 *   licenses and credits recorded in ILLUSTRATION_CREDITS. Rendered by
 *   the herb library pages and — via the verified-asset gate in
 *   lib/quiz/ally-illustrations.ts — on quiz results ally cards.
 *   Without these origins the Commons illustrations the codebase
 *   already references were silently CSP-blocked.
 * - connect-src https://us.posthog.com (the configured api_host —
 *   NEXT_PUBLIC_POSTHOG_HOST, lib/analytics/posthog.ts) +
 *   https://us.i.posthog.com (the ingestion host the SDK derives from
 *   that api_host for capture/flags traffic) +
 *   https://us-assets.i.posthog.com (the SDK fetches its remote config
 *   from the assets host via XHR/fetch — owner-directed fix, 2026-10-15).
 * - frame-src https://player.vimeo.com — the welcome-video iframe in
 *   components/home/WelcomeVideo.tsx.
 * - Authorize.net Accept Hosted (card checkout build 2026-11-09;
 *   lib/payments/authorizenet.ts + the AuthorizeNetCardContinue step
 *   in components/checkout/CheckoutForm.tsx): form-action
 *   https://accept.authorize.net (production hosted payment page)
 *   + https://test.authorize.net (sandbox hosted payment page).
 *   The ONLY cross-origin step in the hosted flow is the browser's
 *   form POST of a one-time token to the hosted page — card data is
 *   entered there, never here — so no script-src, connect-src, or
 *   frame-src entry is needed or added (evidence: the hosted-page
 *   request is built server-side in lib/payments/authorizenet.ts;
 *   the browser sends no fetch/XHR to the gateway and embeds no
 *   gateway iframe).
 * - REMOVED 2026-11-09 (card checkout build): the former Stripe
 *   origins (script-src https://js.stripe.com, connect-src
 *   https://api.stripe.com, frame-src https://js.stripe.com +
 *   https://hooks.stripe.com + https://checkout.stripe.com). The
 *   embedded checkout component that needed them
 *   (components/checkout/StripeEmbeddedCheckout.tsx) is dormant —
 *   verified 2026-11-09: it is imported by no page or component
 *   (the checkout payment-method test asserts the checkout form
 *   does not reference it), the checkout parser rejects its method
 *   for new orders, and Stripe is off the table by owner directive
 *   2026-11-07. Removing these origins therefore breaks no live or
 *   flag-off surface; the two live payment options (Bluevine
 *   invoice, Cash App/Venmo) use no cross-origin resources at all.
 *
 * 'upgrade-insecure-requests' is included so browsers auto-upgrade any
 * http:// subresource request to https:// (HTTPS-upgrade enforcement,
 * alongside the http→https 308 redirects and HSTS). The app references no
 * http:// subresources (verified in source and live HTML 2026-10-18), so
 * this is defence-in-depth with nothing to break.
 * Deliberately NO 'unsafe-eval' anywhere, and NO 'unsafe-inline' in
 * script-src: inline scripts are authorised per-request by nonce instead.
 * style-src keeps 'unsafe-inline' — it governs inline style *attributes*
 * (used throughout the app), which Aikido did not flag and which cannot
 * execute script.
 */
export function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://us-assets.i.posthog.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://d2xsxph8kpxj0f.cloudfront.net https://files.manuscdn.com https://upload.wikimedia.org https://thumb.wikimedia.org",
    "media-src 'self'",
    "connect-src 'self' https://us.posthog.com https://us.i.posthog.com https://us-assets.i.posthog.com",
    'frame-src https://player.vimeo.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accept.authorize.net https://test.authorize.net",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/** HSTS value — unchanged from the Phase 2 contract. No `preload` (owner decision only). */
export const STRICT_TRANSPORT_SECURITY = 'max-age=63072000; includeSubDomains';
