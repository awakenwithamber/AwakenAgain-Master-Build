/**
 * Provider-neutral Next.js middleware — legacy redirect map + CSP nonce.
 *
 * Target location in repo: apps/web/middleware.ts (replaces the current file)
 *
 * Two jobs:
 * 1. Legacy redirects. The typed redirect map lives in lib/seo/redirects.ts,
 *    where every rule is sourced from the production contract; the rules are
 *    unit-tested there. This middleware only applies them at request time.
 * 2. Content-Security-Policy with a per-request nonce (Aikido issue
 *    845087258). The nonce is generated here, passed to Next.js on the
 *    request headers (`x-nonce`, plus the CSP itself as a request header —
 *    that is what lets Next.js stamp the nonce onto its own inline
 *    bootstrap scripts), and the CSP is set on the response. This replaces
 *    the static CSP that used to live in next.config.mjs `headers()`,
 *    which had to allow 'unsafe-inline' and was flagged by Aikido.
 *
 * Standard Next.js middleware (NextRequest/NextResponse only — no provider
 * SDKs, no edge-only APIs).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { findRedirect } from './lib/seo/redirects';
import {
  buildContentSecurityPolicy,
  STRICT_TRANSPORT_SECURITY,
} from './lib/security/csp';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const rule = findRedirect(request.nextUrl.pathname);
  let response: NextResponse;
  if (!rule) {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    const url = request.nextUrl.clone();
    url.pathname = rule.destination;
    url.search = request.nextUrl.search;
    // Never carry legacy '#' fragments into the new app.
    url.hash = '';
    response = NextResponse.redirect(url, rule.status);
  }

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Strict-Transport-Security', STRICT_TRANSPORT_SECURITY);
  return response;
}

/**
 * Skip API routes, Next.js internals, the favicon, and real static assets.
 * Legacy '.html' aliases (/grimior.html, /contact.html) MUST still match,
 * so only known static-asset extensions are excluded.
 * NOTE: this matcher is unchanged from the current middleware. Because API
 * routes are excluded, they will not receive the middleware CSP; they keep
 * the static headers from next.config.mjs (which applies to /:path*).
 * Verify on preview whether Aikido's surface scan checks any API path.
 */
export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf|map|webmanifest|xml|txt)$).*)',
  ],
};
