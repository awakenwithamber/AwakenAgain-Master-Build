/**
 * GUARD TEST — owner subscription confirmation page secret hygiene.
 *
 * The page at /admin/subscriptions/confirm is an owner-only bridge UI
 * whose ONLY credential is the owner key typed into the form. These
 * assertions keep that key from ever being persisted or broadcast from
 * the client: the page/form sources must not reference browser storage,
 * cookies, logging, or analytics tooling; the form must speak the
 * endpoint's exact contract (path + `x-owner-secret` header + a
 * password field with autocomplete off); and the page must stay
 * unlinked (no nav, footer, sitemap, or SEO-registry references) and
 * noindexed.
 *
 * Source-scanning style follows tests/no-forbidden-providers.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const PAGE = join(ROOT, 'app/admin/subscriptions/confirm/page.tsx');
const FORM = join(
  ROOT,
  'app/admin/subscriptions/confirm/ConfirmSubscriptionForm.tsx',
);

const FORBIDDEN_TOKENS = [
  'localStorage',
  'sessionStorage',
  'document.cookie',
  'posthog',
  'gtag',
  'AdminViewTracker',
  'console.',
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) yield full;
  }
}

describe('owner subscription confirmation page — secret hygiene', () => {
  it('page and form exist and never persist, log, or broadcast the key', () => {
    for (const file of [PAGE, FORM]) {
      expect(existsSync(file), `${file} should exist`).toBe(true);
      const src = readFileSync(file, 'utf8');
      for (const token of FORBIDDEN_TOKENS) {
        expect(
          src.includes(token),
          `${file.slice(ROOT.length + 1)} must not reference ${token}`,
        ).toBe(false);
      }
    }
  });

  it('the form speaks the endpoint contract exactly', () => {
    const src = readFileSync(FORM, 'utf8');
    expect(src).toContain('/api/admin/subscriptions/confirm');
    expect(src).toContain('x-owner-secret');
    expect(src).toContain('type="password"');
    expect(src).toContain('autoComplete="off"');
  });

  it('the page never imports the endpoint module and stays noindexed', () => {
    const src = readFileSync(PAGE, 'utf8');
    expect(src).not.toContain('api/admin/subscriptions/confirm/route');
    expect(src).toContain('index: false');
    expect(src).toContain('follow: false');
  });

  it('the page is not linked from nav, footer, sitemap, or SEO sources', () => {
    const scanFiles: string[] = [
      join(ROOT, 'app/sitemap.ts'),
      join(ROOT, 'app/robots.ts'),
      join(ROOT, 'app/layout.tsx'),
      join(ROOT, 'app/admin/page.tsx'),
      ...walk(join(ROOT, 'components')),
      ...walk(join(ROOT, 'lib/seo')),
    ];
    const hits = scanFiles.filter(
      (file) =>
        existsSync(file) &&
        readFileSync(file, 'utf8').includes('/admin/subscriptions/confirm'),
    );
    expect(
      hits.map((f) => f.slice(ROOT.length + 1)),
      'the owner confirmation page must not be referenced by nav/footer/sitemap sources',
    ).toEqual([]);
  });
});
