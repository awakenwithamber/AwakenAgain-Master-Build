/** @type {import('next').NextConfig} */
const nextConfig = {
  // Provider-portable: deployment target is NOT decided (owner directive 2026-10-05).
  // No provider adapters, no provider SDKs in app code. `standalone` output keeps
  // the app runnable on any Node host or container platform.
  output: 'standalone',
  reactStrictMode: true,
  // Security headers — parity with the legacy production contract
  // (PRODUCTION_CONTRACT.md §2: Netlify served these on /*). Standard
  // Next.js headers(): provider-neutral, enforced at the app layer so they
  // survive any future provider change.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  // Site audit 2026-10-10: Herb Encyclopedia + Ingredient Library consolidated
  // into /herb-index per owner instruction.
  async redirects() {
    return [
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
