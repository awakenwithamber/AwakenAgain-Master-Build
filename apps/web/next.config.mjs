/**
 * TARGET: apps/web/next.config.mjs (replaces the current file)
 * Change vs current: the Content-Security-Policy is NO LONGER emitted here.
 * It moved to middleware (lib/security/csp.ts + middleware.ts) so it can
 * carry a per-request nonce instead of 'unsafe-inline' in script-src
 * (Aikido issue 845087258). Emitting it in both places would intersect the
 * two policies and keep the scanner flag. Every other header below —
 * including HSTS (Aikido issue 857156854) — is unchanged.
 *
 * The CSP origin evidence record lives in lib/security/csp.ts. Summary:
 * - script-src https://us-assets.i.posthog.com — posthog-js (installed
 *   SDK) lazy-loads its feature modules (surveys, web-vitals, etc.)
 *   from its assets host. The SDK core itself is bundled same-origin.
 * - style-src https://fonts.googleapis.com + font-src
 *   https://fonts.gstatic.com — Google Fonts stylesheets linked in
 *   app/layout.tsx and components/grimoire/GrimoireBook.tsx; the font
 *   files themselves are served from fonts.gstatic.com.
 * - img-src https://d2xsxph8kpxj0f.cloudfront.net +
 *   https://files.manuscdn.com — herb illustration images referenced by
 *   lib/herbs/illustrations.ts and rendered on the herb library pages.
 * - connect-src https://us.posthog.com (the configured api_host —
 *   NEXT_PUBLIC_POSTHOG_HOST, lib/analytics/posthog.ts) +
 *   https://us.i.posthog.com (the ingestion host the SDK derives from
 *   that api_host for capture/flags traffic) +
 *   https://us-assets.i.posthog.com (the SDK fetches its remote config
 *   from the assets host via XHR/fetch — observed during the Phase 2
 *   personalization work; without it the fetch is CSP-blocked and the
 *   SDK silently runs on defaults. Owner-directed fix, 2026-10-15,
 *   closing the Step 6 live-verify line item).
 * - frame-src https://player.vimeo.com — the welcome-video iframe in
 *   components/home/WelcomeVideo.tsx (the only embed in the app).
 * Deliberately NO 'unsafe-eval' anywhere.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Provider-portable: deployment target is NOT decided (owner directive 2026-10-05).
  // No provider adapters, no provider SDKs in app code. `standalone` output keeps
  // the app runnable on any Node host or container platform.
  output: 'standalone',
  reactStrictMode: true,
  // Do not advertise the framework: Next.js otherwise sends
  // `X-Powered-By: Next.js` on page responses (Aikido surface-monitoring
  // finding "Server leaks info via 'X-Powered-By' HTTP header", Medium).
  poweredByHeader: false,
  // Security headers — parity with the legacy production contract
  // (PRODUCTION_CONTRACT.md §2: Netlify served these on /*), extended by
  // the Phase 2 audit remediation (CSP + HSTS + Permissions-Policy;
  // X-Frame-Options tightened SAMEORIGIN → DENY to match
  // frame-ancestors 'none'). Standard Next.js headers():
  // provider-neutral, enforced at the app layer so they survive any
  // future provider change.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  // Site audit 2026-10-10: Herb Encyclopedia + Ingredient Library consolidated
  // into /herb-index per owner instruction.
  // Superseded-product protection 2026-10-13: the retired 9-bar collection
  // ($99.99) permanently redirects to its replacement, the Alchemy Soap
  // Collection — the record stays in the catalog for reference, but the
  // storefront URL lands on the current, purchasable collection.
  async redirects() {
    return [
      {
        source: '/shop/full-soap-collection',
        destination: '/shop/soap-style-collection-5',
        permanent: true,
      },
      {
        source: '/herbal-wisdom',
        destination: '/herb-index',
        permanent: true,
      },
      {
        source: '/herbal-wisdom/:path*',
        destination: '/herb-index',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
