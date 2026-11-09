/**
 * Grimoire READER SECURITY — hardening suite (SECURITY-ONLY release,
 * owner-approved build 2026-11-07).
 *
 * This suite is the membership build's reader-security suite ADAPTED
 * to the CURRENT, unmodified entitlement code on main: entitlement
 * semantics here are exactly the live ones (active subscriber /
 * permanent-unlock holder / keeper; past_due inside the 3-day
 * grace; NO timed membership model). The persona matrix against the
 * route lives in tests/grimoire-asset-route-personas.test.ts.
 *
 * Deliberately NOT in this release (and not asserted): the
 * membership build's friction layer (context-menu suppression,
 * draggable={false}, CSS user-drag/user-select). Those are
 * deterrents, not protections, and they are a separate change.
 *
 * What is proven here, behaviorally where possible:
 * - Book page images are NOT publicly reachable anymore (REWRITE
 *   VARIANT of the security-only release): the files stay on disk
 *   under public/grimoire/, but next.config.mjs beforeFiles
 *   rewrites intercept EVERY image request under /grimoire/<work>/
 *   and force it through ONE gated route before the filesystem is
 *   ever consulted — and the route reads the files from the
 *   public/ disk path itself, so no response bypasses the gate.
 * - The gated route serves a free-preview asset to anyone (it is
 *   already public on /grimoire), a gated asset ONLY to a signed-in
 *   entitled viewer (200), refuses a logged-out visitor (401) and a
 *   signed-in viewer with no entitlement (403) — entitlement is
 *   re-resolved per request against the live resolver.
 * - Unknown assets and traversal attempts are 404; there is no
 *   download disposition — inline images only, gated responses are
 *   Cache-Control: private, no-store.
 * - Locked payloads reference NO gated asset URL; entitled payloads
 *   reference assets only through the gated route (never a raw
 *   /grimoire/ public path).
 * - Embedding is blocked site-wide: CSP frame-ancestors 'none' and
 *   X-Frame-Options: DENY (already on main; re-asserted because the
 *   reader depends on it).
 * - Print is blocked for the book stage (@media print) and the
 *   per-viewer watermark renders the entitled viewer's email on
 *   gated pages (both already on main; re-asserted).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GET } from '../app/api/grimoire-assets/[...asset]/route';
import { grimoireAssetPageMap } from '../lib/grimoire/asset-map';
import {
  buildGrimoirePages,
  displayPagesFor,
  grimoireAssetUrl,
} from '../components/grimoire/grimoireContent';
import { getBookContent } from '../lib/grimoire/book-content';
import { FREE_PREVIEW_LAST_PAGE } from '../lib/grimoire/entitlement';
import { getEditionManifest } from '../lib/grimoire/manifest';
import {
  GRIMOIRE_SESSION_COOKIE,
  getSharedOtpStore,
  requestOtp,
  verifyOtp,
} from '../lib/grimoire/otp';
import { grantUnlock } from '../lib/grimoire/unlock';
import { buildContentSecurityPolicy } from '../lib/security/csp';

const ROOT = resolve(__dirname, '..');

const ENV_KEYS = [
  'DATABASE_URL',
  'SUBSCRIPTIONS_LEDGER_PATH',
  'GRIMOIRE_UNLOCKS_LEDGER_PATH',
  'GRIMOIRE_KEEPER_EMAILS',
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  delete process.env.DATABASE_URL;
  delete process.env.GRIMOIRE_KEEPER_EMAILS;
  const dir = mkdtempSync(join(tmpdir(), 'grimoire-security-'));
  process.env.SUBSCRIPTIONS_LEDGER_PATH = join(dir, 'subs.jsonl');
  process.env.GRIMOIRE_UNLOCKS_LEDGER_PATH = join(dir, 'unlocks.jsonl');
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

/** All asset keys in the composed book, with their earliest page. */
const assetMap = grimoireAssetPageMap();
const freeKey = [...assetMap.entries()].find(([, p]) => p <= FREE_PREVIEW_LAST_PAGE)?.[0] as string;
const gatedEntry = [...assetMap.entries()].find(
  ([k, p]) => p > FREE_PREVIEW_LAST_PAGE && k.endsWith('.jpg'),
);
const gatedKey = gatedEntry?.[0] as string;

async function mintSession(email: string): Promise<string> {
  const store = getSharedOtpStore();
  const { request, code } = await requestOtp(store, email);
  const verified = await verifyOtp(store, request.request_id, code);
  if (!verified.ok) throw new Error('session mint failed');
  return verified.session.session_token;
}

function assetRequest(key: string, token?: string): Request {
  return new Request(`http://localhost/api/grimoire-assets/${key}`, {
    headers: token ? { cookie: `${GRIMOIRE_SESSION_COOKIE}=${token}` } : {},
  });
}

function callRoute(key: string, token?: string) {
  return GET(assetRequest(key, token), {
    params: Promise.resolve({ asset: key.split('/') }),
  });
}

/**
 * Compile a next.config rewrite source ('/grimoire/:assetPath(<re>)')
 * into the RegExp the router effectively applies, so the scoping of
 * the interception is asserted behaviorally, not by eyeballing the
 * config. (The config file TEXT carries the JS-escaped form of the
 * pattern — '.*\\.jpg' — which is unescaped here to the runtime
 * pattern '.*\.jpg'.)
 */
function rewriteMatcher(source: string): RegExp {
  const m = source.match(/^\/grimoire\/:assetPath\((.*)\)$/);
  if (!m) throw new Error(`unexpected rewrite source: ${source}`);
  return new RegExp(`^/grimoire/${m[1].replace(/\\\\/g, '\\')}$`);
}

describe('asset storage + routing gate (rewrite variant)', () => {
  it('the book files stay on disk in public/grimoire — 309 files, exactly the mapped set', () => {
    // The variant does NOT move the files: no data/grimoire-assets
    // store exists, and public/grimoire carries exactly the book's
    // mapped assets — nothing lost, nothing unmapped smuggled in.
    // 309 after the 2026-11-08 removal: the four removed editions'
    // 319 files left the served tree for quarantine (owner
    // decision), so disk and map agree on the retained works only.
    expect(existsSync(join(ROOT, 'data', 'grimoire-assets'))).toBe(false);
    const assetRoot = join(ROOT, 'public', 'grimoire');
    expect(existsSync(assetRoot)).toBe(true);
    const onDisk = readdirSync(assetRoot, { recursive: true })
      .map((f) => String(f))
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    expect(onDisk).toHaveLength(309);
    expect(assetMap.size).toBe(309);
    for (const key of onDisk) expect(assetMap.has(key)).toBe(true);
  });

  it('the gated route reads the files from the public disk path', () => {
    const route = readFileSync(
      join(ROOT, 'app', 'api', 'grimoire-assets', '[...asset]', 'route.ts'),
      'utf8',
    );
    expect(route).toContain("join(process.cwd(), 'public', 'grimoire')");
    expect(route).not.toContain("join(process.cwd(), 'data'");
  });

  it('next.config traces the public files into the gated route bundle', () => {
    const config = readFileSync(join(ROOT, 'next.config.mjs'), 'utf8');
    expect(config).toContain(
      "'/api/grimoire-assets/**': ['./public/grimoire/**']",
    );
    expect(config).not.toContain('data/grimoire-assets');
  });

  it('beforeFiles rewrites intercept ONLY grimoire image requests, all sent to the gated route', () => {
    const config = readFileSync(join(ROOT, 'next.config.mjs'), 'utf8');
    const ruleRe =
      /source:\s*'(\/grimoire\/[^']+)',\s*destination:\s*'(\/api\/grimoire-assets\/[^']+)'/g;
    const rules = [...config.matchAll(ruleRe)].map((m) => ({
      source: m[1],
      destination: m[2],
    }));
    // One rule per image extension the route can serve.
    expect(rules).toHaveLength(5);
    for (const rule of rules) {
      expect(rule.destination).toBe('/api/grimoire-assets/:assetPath');
    }
    const matchers = rules.map((r) => rewriteMatcher(r.source));
    const matches = (url: string) => matchers.some((re) => re.test(url));
    // Image files under a work directory ARE intercepted…
    expect(matches('/grimoire/sepher-sephiroth/page-018.jpg')).toBe(true);
    expect(matches('/grimoire/sepher-sephiroth/page-017.jpg')).toBe(true);
    expect(matches('/grimoire/book-of-ceremonial-magic-waite-1913/cover.jpg')).toBe(true);
    expect(matches('/grimoire/sepher-sephiroth/cover.png')).toBe(true);
    expect(matches('/grimoire/some-work/figure.webp')).toBe(true);
    expect(matches('/grimoire/some-work/figure.gif')).toBe(true);
    // …and nothing else is: not the reader pages, not a bare work
    // path, not non-image files, not other directories.
    expect(matches('/grimoire')).toBe(false);
    expect(matches('/grimoire/subscribe')).toBe(false);
    expect(matches('/grimoire/sepher-sephiroth')).toBe(false);
    expect(matches('/grimoire/sepher-sephiroth/notes.txt')).toBe(false);
    expect(matches('/images/grimoire/sepher-sephiroth/page-018.jpg')).toBe(false);
  });

  it('the asset map covers the book and splits free vs gated at the preview boundary', () => {
    // STEP 0 boundary (verified against the live code): the gate is
    // COMPOSED page 16. Exactly 3 assets are preview assets (their
    // earliest composed page is ≤16) — the sample-page images and
    // covers the free preview shows every visitor. (Before the
    // 2026-11-08 removal there were 8; the other five belonged to
    // the removed editions or their samples.)
    const free = [...assetMap.values()].filter((p) => p <= FREE_PREVIEW_LAST_PAGE);
    const gated = [...assetMap.values()].filter((p) => p > FREE_PREVIEW_LAST_PAGE);
    expect(free).toHaveLength(3);
    expect(gated).toHaveLength(306);
    expect(freeKey).toBeTruthy();
    expect(gatedKey).toBeTruthy();
    expect(assetMap.get(gatedKey)).toBeGreaterThan(FREE_PREVIEW_LAST_PAGE);
    // The file named in the owner's check: a SOURCE-book page used
    // as a free-preview sample (Sepher Sephiroth p.17 → composed
    // p.9) — public because the preview is public, NOT because the
    // gate moved.
    expect(assetMap.get('sepher-sephiroth/page-017.jpg')).toBe(9);
    // The removed editions are not in the map at all — the route
    // 404s their keys for every persona (see the persona matrix).
    expect(assetMap.has('book-of-raziel/page-01.jpg')).toBe(false);
    expect(assetMap.has('albertus-magnus-egyptian-secrets/page-001.jpg')).toBe(false);
  });

  it('display pages reference assets ONLY through the gated route', () => {
    const pages = buildGrimoirePages(getEditionManifest(), getBookContent());
    const entitled = JSON.stringify(displayPagesFor(pages, true));
    expect(entitled).not.toContain('"/grimoire/');
    expect(entitled).toContain('/api/grimoire-assets/');
    // Every asset URL in the entitled payload is a mapped asset.
    const urls = [...entitled.matchAll(/\/api\/grimoire-assets\/([^"\\]+)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(300);
    for (const key of urls) expect(assetMap.has(key)).toBe(true);
  });

  it('locked payloads reference NO gated asset (direct-URL attempts start from nothing)', () => {
    const pages = buildGrimoirePages(getEditionManifest(), getBookContent());
    const locked = JSON.stringify(displayPagesFor(pages, false));
    const urls = [...locked.matchAll(/\/api\/grimoire-assets\/([^"\\]+)/g)].map((m) => m[1]);
    for (const key of urls) {
      expect(assetMap.get(key)).toBeLessThanOrEqual(FREE_PREVIEW_LAST_PAGE);
    }
    expect(locked).not.toContain(grimoireAssetUrl('/grimoire/' + gatedKey));
  });
});

describe('gated asset route', () => {
  it('serves a free-preview asset to a logged-out visitor', async () => {
    const res = await callRoute(freeKey);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^image\//);
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it('refuses a gated asset to a logged-out visitor (401)', async () => {
    const res = await callRoute(gatedKey);
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('serves a gated asset to an entitled member (200, inline, private no-store)', async () => {
    await grantUnlock({
      email: 'reader@example.com',
      transaction_ref: 'UNLOCK-SEC-1',
      source: 'owner_manual',
    });
    const token = await mintSession('reader@example.com');
    const res = await callRoute(gatedKey, token);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('content-disposition')).toBe('inline');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });

  it('refuses a gated asset to a signed-in viewer with NO entitlement (403)', async () => {
    // Session mints fine (possession of the email is proven); the
    // ROUTE re-resolves entitlement per request and a viewer with
    // no subscription, no unlock, and no keeper status gets
    // nothing beyond the free pages.
    const token = await mintSession('nobody@example.com');
    const res = await callRoute(gatedKey, token);
    expect(res.status).toBe(403);
  });

  it('unknown assets and traversal attempts are 404, session or not', async () => {
    const token = await mintSession('reader@example.com');
    for (const key of [
      'albertus-magnus-egyptian-secrets/page-999.jpg',
      'no-such-work/page-001.jpg',
      '../data/grimoire/family-edition.json',
      '..%2f..%2fpackage.json',
    ]) {
      const res = await callRoute(key, token);
      expect(res.status, key).toBe(404);
    }
  });
});

describe('embedding, print, watermark (pre-existing protections, re-asserted)', () => {
  it("embedding is blocked: CSP frame-ancestors 'none' + X-Frame-Options DENY", () => {
    expect(buildContentSecurityPolicy('test-nonce')).toContain("frame-ancestors 'none'");
    const config = readFileSync(join(ROOT, 'next.config.mjs'), 'utf8');
    expect(config).toContain("key: 'X-Frame-Options', value: 'DENY'");
  });

  it('print yields no book content (the stage is display:none in print)', () => {
    const css = readFileSync(
      join(ROOT, 'components', 'grimoire', 'grimoire.module.css'),
      'utf8',
    );
    const printBlock = css.slice(css.indexOf('@media print'));
    expect(printBlock).toContain('.stage');
    expect(printBlock).toContain('display: none !important');
  });

  it('the per-viewer watermark is wired in the reader', () => {
    const book = readFileSync(
      join(ROOT, 'components', 'grimoire', 'GrimoireBook.tsx'),
      'utf8',
    );
    // Watermark: the entitled viewer's own email, rendered on gated
    // pages only (pages beyond the free preview), from the
    // server-supplied viewerEmail.
    expect(book).toContain('styles.watermark');
    expect(book).toContain('watermarkEmail');
    expect(book).toContain('page.pageNumber > FREE_PREVIEW_LAST_PAGE');
    const css = readFileSync(
      join(ROOT, 'components', 'grimoire', 'grimoire.module.css'),
      'utf8',
    );
    expect(css).toContain('.watermark');
  });

  it('the watermark data-flow: the viewer email reaches gated pages only from an entitled resolution', () => {
    // /grimoire computes the email ONLY from the entitled path —
    // signed-in AND entitled — and hands it to the book; everyone
    // else renders with null (no watermark, no gated pages at all).
    const page = readFileSync(join(ROOT, 'app', 'grimoire', 'page.tsx'), 'utf8');
    expect(page).toContain(
      'viewerEmail={entitlement.entitled ? entitlement.email : null}',
    );
    const book = readFileSync(
      join(ROOT, 'components', 'grimoire', 'GrimoireBook.tsx'),
      'utf8',
    );
    expect(book).toContain('const watermarkEmail =');
    expect(book).toContain('page.pageNumber > FREE_PREVIEW_LAST_PAGE');
    expect(book).toContain('{watermarkEmail}');
    expect(book).toContain('<WatermarkContext.Provider value={viewerEmail}>');
  });
});
