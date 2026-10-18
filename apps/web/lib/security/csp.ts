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
 * - connect-src https://us.posthog.com (the configured api_host —
 *   NEXT_PUBLIC_POSTHOG_HOST, lib/analytics/posthog.ts) +
 *   https://us.i.posthog.com (the ingestion host the SDK derives from
 *   that api_host for capture/flags traffic) +
 *   https://us-assets.i.posthog.com (the SDK fetches its remote config
 *   from the assets host via XHR/fetch — owner-directed fix, 2026-10-15).
 * - frame-src https://player.vimeo.com — the welcome-video iframe in
 *   components/home/WelcomeVideo.tsx (the only embed in the app).
 *
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
    "img-src 'self' data: blob: https://d2xsxph8kpxj0f.cloudfront.net https://files.manuscdn.com",
    "media-src 'self'",
    "connect-src 'self' https://us.posthog.com https://us.i.posthog.com https://us-assets.i.posthog.com",
    'frame-src https://player.vimeo.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

/** HSTS value — unchanged from the Phase 2 contract. No `preload` (owner decision only). */
export const STRICT_TRANSPORT_SECURITY = 'max-age=63072000; includeSubDomains';
