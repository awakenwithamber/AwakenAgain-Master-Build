/**
 * REGRESSION SUITE — §19: brand identity + pending migration areas.
 *
 * Brand law: the exact business name "Amber's Alchemy Apothecary" is used
 * in customer-facing UI, headings, metadata, structured data, docs, and
 * analytics naming — never shortened to "Amber's Alchemy".
 *
 * The skipped suites below are NOT faked coverage: they document the
 * regression areas from §19 that have no scaffolded module yet, so the
 * gate rule ("no SAFE TO REMOVE without these passing") stays visible
 * until each area is implemented and its tests are un-skipped.
 * (redirects, canonical URLs, and sitemap were un-skipped 2026-10-05 —
 * modules implemented; remaining skips: Wave Rectangle preview module
 * and full checkout flow.)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sitemap from '../../app/sitemap';
import { CANONICAL_ROUTES, canonicalUrl } from '../seo/routes';
import { REDIRECT_RULES, findRedirect, validateRedirectMap } from '../seo/redirects';
import { siteUrl } from '../seo/config';

const BRAND = "Amber's Alchemy Apothecary";

describe('canonical brand name', () => {
  it('app metadata uses the exact business name (literal or BRAND_NAME constant)', () => {
    const layout = readFileSync(new URL('../../app/layout.tsx', import.meta.url), 'utf8');
    // The constant is the compliant pattern: single source of truth in lib/seo/config.ts.
    const config = readFileSync(new URL('../seo/config.ts', import.meta.url), 'utf8');
    expect(config).toContain(`BRAND_NAME = "${BRAND}"`);
    expect(layout.includes(BRAND) || layout.includes('BRAND_NAME')).toBe(true);
  });

  it('no scaffolded source shortens the name to "Amber\'s Alchemy" alone', () => {
    // Files that may legitimately mention the brand. If the name is ever
    // shortened (missing "Apothecary"), this fails loudly.
    const files = [
      '../../app/layout.tsx',
      '../../app/soap-shop/page.tsx',
      '../../components/seo/JsonLd.tsx',
      '../seo/config.ts',
      './events.ts',
      '../pricing/pricing.ts',
    ];
    for (const f of files) {
      let src: string;
      try {
        src = readFileSync(new URL(f, import.meta.url), 'utf8');
      } catch {
        continue;
      }
      const shortUses = (src.match(/Amber's Alchemy(?! Apothecary)/g) ?? []).length;
      expect(shortUses, `shortened brand in ${f}`).toBe(0);
    }
  });
});

describe.skip('Wave Rectangle layer rules (pending preview module)', () => {
  it('double-layer boundary is hard — never blended, swirled, faded, or gradient', () => {
    // Covers the live-preview canvas (Large Wave Rectangle) once the
    // React preview island exists: layer boundary position, opacity
    // separation, and the rule that preview rendering never feeds back
    // into catalog/business logic.
  });
});

describe('redirects — legacy → new URL map (IMPLEMENTED 2026-10-05)', () => {
  it('every redirect rule is sourced and structurally valid', () => {
    // Full coverage lives in lib/seo/redirects.test.ts; this is the §19 gate.
    expect(validateRedirectMap()).toEqual([]);
    for (const r of REDIRECT_RULES) {
      expect(r.sourceRef.trim().length).toBeGreaterThan(0);
      expect(r.destination).not.toContain('#');
    }
  });

  it('every legacy route has exactly one canonical successor', () => {
    const sources = REDIRECT_RULES.map((r) => r.source);
    expect(new Set(sources).size).toBe(sources.length);
    for (const r of REDIRECT_RULES) {
      expect(findRedirect(r.source)?.destination).toBe(r.destination);
    }
  });
});

describe('canonical URLs (IMPLEMENTED 2026-10-05)', () => {
  it('one canonical URL per registered route; no trailing-slash or case variants', () => {
    const paths = CANONICAL_ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) {
      expect(p).toBe(p.toLowerCase());
      if (p !== '/') expect(p.endsWith('/')).toBe(false);
      expect(canonicalUrl(p, siteUrl())).toBe(`${siteUrl()}${p}`);
    }
  });
});

describe('sitemap output (IMPLEMENTED 2026-10-05)', () => {
  it('sitemap contains no # fragment URLs and covers all registered routes', () => {
    // Full coverage lives in app/sitemap.test.ts; this is the §19 gate.
    // The sitemap intentionally also emits catalog product pages beyond the
    // static registry, so the count is >= the registry length.
    const entries = sitemap();
    expect(entries.length).toBeGreaterThanOrEqual(CANONICAL_ROUTES.length);
    for (const e of entries) {
      expect(e.url).not.toContain('#');
    }
  });
});

describe.skip('full checkout flow (pending API routes)', () => {
  it('Cash App + Venmo only — no superseded payment-method paths', () => {
    // The checkout flow must never offer a superseded payment method.
  });

  it('server emits cart_configuration_accepted / pricing_validation_* (pending)', () => {
    // Remaining server-owned PostHog events from §6, emitted exactly once
    // per authoritative transition — never duplicating client events.
    // order_created is already WIRED (POST /api/checkout via
    // lib/analytics/posthog-server.ts, inert until the phc_ key exists).
  });
});
