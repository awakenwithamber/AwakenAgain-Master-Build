/**
 * Gated Grimoire page-asset route — GET /api/grimoire-assets/<work>/<file>
 * (reader security hardening, 2026-11-07).
 *
 * WHY THIS EXISTS: the book's page facsimiles and illustrations sit
 * in public/grimoire/ — 628 files the web server used to hand to
 * ANYONE who guessed a URL, no session, no entitlement. The files
 * stay on disk there, but they are no longer reachable directly:
 * the beforeFiles rewrites in next.config.mjs intercept EVERY
 * image request under /grimoire/<work>/ before the filesystem is
 * consulted and route it here, and this route — reading the files
 * from the public/ disk path itself — is the only way the bytes
 * are ever served:
 *
 * - The asset key must exist in the composed book's asset map
 *   (built from the same manifest + content the reader uses). An
 *   unmapped key — including every traversal attempt — is a 404.
 * - Assets whose earliest composed page is inside the free preview
 *   (pages 1–16) are served without a session: they are already
 *   public on /grimoire itself (covers + one sample page per work).
 * - Every later asset requires the reader's OTP session AND a live
 *   entitlement resolved per request (lib/grimoire/entitlement —
 *   the CURRENT, unmodified resolver: active subscriber,
 *   permanent-unlock holder, or keeper): no session → 401; signed
 *   in but not entitled (including a lapsed subscriber — past the
 *   3-day grace or cancelled — whose session is still valid) →
 *   403. Access is evaluated at request time, never cached from
 *   page render, so a lapse takes effect immediately.
 * - Responses are inline images only — no attachment disposition,
 *   no download route — with Cache-Control: private, no-store on
 *   gated assets so shared caches never retain them.
 *
 * Honest limit (owner-acknowledged): this stops bulk/direct
 * downloading and casual saving; it cannot stop a determined viewer
 * from capturing what their own screen legitimately shows them.
 * The per-viewer watermark in the reader is the traceability layer.
 *
 * SERVER-ONLY. Per-request auth + entitlement — never static.
 */
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { grimoireAssetPageMap } from '../../../../lib/grimoire/asset-map';
import {
  FREE_PREVIEW_LAST_PAGE,
  resolveGrimoireEntitlement,
} from '../../../../lib/grimoire/entitlement';
import {
  GRIMOIRE_SESSION_COOKIE,
  getSharedOtpStore,
  getValidSession,
} from '../../../../lib/grimoire/otp';

export const dynamic = 'force-dynamic';

const ASSET_ROOT = join(process.cwd(), 'public', 'grimoire');

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function notFound(): Response {
  return new Response('Not found.', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

/** The reader session token from the request's cookie header. */
function sessionTokenFrom(request: Request): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === GRIMOIRE_SESSION_COOKIE) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ asset: string[] }> },
): Promise<Response> {
  const { asset } = await params;
  const key = (asset ?? []).join('/');
  if (!key || key.includes('..') || key.includes('\\') || key.startsWith('/')) {
    return notFound();
  }
  const pageNumber = grimoireAssetPageMap().get(key);
  if (pageNumber === undefined) return notFound();

  const gated = pageNumber > FREE_PREVIEW_LAST_PAGE;
  if (gated) {
    const session = await getValidSession(
      getSharedOtpStore(),
      sessionTokenFrom(request),
    );
    if (!session?.email) {
      return new Response('Sign in to view this page.', {
        status: 401,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    const entitlement = await resolveGrimoireEntitlement(session.email);
    if (!entitlement.entitled) {
      return new Response('This page is members-only.', {
        status: 403,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
  }

  const contentType = CONTENT_TYPES[extname(key).toLowerCase()];
  if (!contentType) return notFound();
  let bytes: Buffer;
  try {
    bytes = await readFile(join(ASSET_ROOT, key));
  } catch {
    return notFound(); // mapped but missing on disk — fail closed
  }
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': gated
        ? 'private, no-store'
        : 'public, max-age=86400',
    },
  });
}
