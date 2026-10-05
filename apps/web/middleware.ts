/**
 * Provider-neutral Next.js middleware — legacy redirect map.
 *
 * Standard Next.js middleware (NextRequest/NextResponse only — no provider
 * SDKs, no edge-only APIs). The typed redirect map lives in
 * lib/seo/redirects.ts, where every rule is sourced from the production
 * contract; the rules are unit-tested there. This middleware only applies
 * them at request time.
 *
 * Part of the static→Next.js CONVERSION MAP: legacy OLD routes that have a
 * clear Next.js NEW destination are listed in lib/seo/redirects.ts. Legacy
 * routes with no clear destination are marked UNMAPPED in the migration
 * ledger for the conversion-map worker — they are NOT invented here.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { findRedirect } from './lib/seo/redirects';

export function middleware(request: NextRequest) {
  const rule = findRedirect(request.nextUrl.pathname);
  if (!rule) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = rule.destination;
  url.search = request.nextUrl.search;
  // Never carry legacy '#' fragments into the new app.
  url.hash = '';
  return NextResponse.redirect(url, rule.status);
}

/**
 * Skip API routes, Next.js internals, the favicon, and real static assets.
 * Legacy '.html' aliases (/grimior.html, /contact.html) MUST still match,
 * so only known static-asset extensions are excluded.
 */
export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf|map|webmanifest|xml|txt)$).*)',
  ],
};
