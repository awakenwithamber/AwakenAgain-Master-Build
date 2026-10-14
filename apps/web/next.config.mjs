/**
 * Content-Security-Policy — built from EVIDENCE in this codebase (audit
 * remediation, Phase 2). Every non-'self' origin below names why it is
 * allowed; do not add an origin without the same evidence:
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
 *   that api_host for capture/flags traffic).
 * - frame-src https://player.vimeo.com — the welcome-video iframe in
 *   components/home/WelcomeVideo.tsx (the only embed in the app).
 * Deliberately NO 'unsafe-eval' anywhere. Inline script/style allowances
 * remain because Next.js injects inline bootstrap scripts and the app
 * uses inline style attributes throughout.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://us-assets.i.posthog.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://d2xsxph8kpxj0f.cloudfront.net https://files.manuscdn.com",
  "media-src 'self'",
  "connect-src 'self' https://us.posthog.com https://us.i.posthog.com",
  'frame-src https://player.vimeo.com',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Provider-portable: deployment target is NOT decided (owner directive 2026-10-05).
  // No provider adapters, no provider SDKs in app code. `standalone` output keeps
  // the app runnable on any Node host or container platform.
  output: 'standalone',
  reactStrictMode: true,
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
          { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
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
