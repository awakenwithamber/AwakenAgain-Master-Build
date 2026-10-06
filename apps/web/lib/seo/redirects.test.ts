/**
 * REGRESSION SUITE — §19: legacy → Next.js redirect map.
 *
 * Laws under test:
 * - Every rule is sourced (no invented legacy URLs — see the module docblock).
 * - The map is structurally valid: unique sources, no loops, no chains,
 *   no '#' fragment destinations (the legacy sitemap fragment defect).
 * - Destinations never reintroduce the legacy fragment pattern.
 */
import { describe, expect, it } from 'vitest';
import {
  LEGACY_ANCHORS_UNMAPPED,
  LEGACY_ANCHOR_MAP,
  REDIRECT_RULES,
  findRedirect,
  resolveLegacyAnchor,
  validateRedirectMap,
} from './redirects';

describe('redirect map structure', () => {
  it('validates clean: no problems', () => {
    expect(validateRedirectMap()).toEqual([]);
  });

  it('every rule has a source reference (nothing invented)', () => {
    for (const r of REDIRECT_RULES) {
      expect(r.sourceRef.trim().length).toBeGreaterThan(0);
    }
  });

  it('every destination is fragment-free', () => {
    for (const r of REDIRECT_RULES) {
      expect(r.destination).not.toContain('#');
    }
  });
});

describe('known legacy routes', () => {
  it('/grimior.html (misspelled alias) → /grimoire, permanent', () => {
    const r = findRedirect('/grimior.html');
    expect(r?.destination).toBe('/grimoire');
    expect(r?.status).toBe(301);
  });

  it('/dream-ease-capsules (SEO alias) → canonical product page, permanent', () => {
    const r = findRedirect('/dream-ease-capsules');
    expect(r?.destination).toBe('/shop/dreamease-capsules');
    expect(r?.status).toBe(301);
  });

  it('/contact.html → /contact, permanent', () => {
    const r = findRedirect('/contact.html');
    expect(r?.destination).toBe('/contact');
    expect(r?.status).toBe(301);
  });

  it('unknown paths do not redirect', () => {
    expect(findRedirect('/no-such-page')).toBeUndefined();
    expect(findRedirect('/soap-shop')).toBeUndefined();
  });

  it('dead legacy targets remap to real routes (CONVERSION_MAP §8 row 105)', () => {
    expect(findRedirect('/herbal-index.html')?.destination).toBe('/herb-index');
    expect(findRedirect('/create-remedy.html')?.destination).toBe('/custom-formula');
    expect(findRedirect('/articles.html')?.destination).toBe('/journal');
    for (const s of ['/herbal-index.html', '/create-remedy.html', '/articles.html']) {
      expect(findRedirect(s)?.status).toBe(301);
    }
  });

  it('/admin.html → /admin (standalone legacy page → Next.js admin)', () => {
    const r = findRedirect('/admin.html');
    expect(r?.destination).toBe('/admin');
    expect(r?.status).toBe(301);
  });

  it('map still validates clean after additions', () => {
    expect(validateRedirectMap()).toEqual([]);
  });
});

describe('legacy SPA anchors (client-side; fragments never reach the server)', () => {
  it('resolves mapped anchors to existing routes', () => {
    expect(resolveLegacyAnchor('#shop')).toBe('/shop');
    expect(resolveLegacyAnchor('#soaps')).toBe('/soap-shop');
    expect(resolveLegacyAnchor('#checkout')).toBe('/checkout');
    expect(resolveLegacyAnchor('#home')).toBe('/');
    expect(resolveLegacyAnchor('#about')).toBe('/about');
    expect(resolveLegacyAnchor('#bundle')).toBe('/soap-builder');
  });

  it('accepts hashes with or without the leading # and ignores case', () => {
    expect(resolveLegacyAnchor('shop')).toBe('/shop');
    expect(resolveLegacyAnchor('#SHOP')).toBe('/shop');
  });

  it('returns undefined for unmapped anchors (never invents a destination)', () => {
    expect(resolveLegacyAnchor('#herb-index')).toBeUndefined();
    expect(resolveLegacyAnchor('#quiz')).toBeUndefined();
    expect(resolveLegacyAnchor('#no-such-anchor')).toBeUndefined();
  });

  it('unmapped anchors are an explicit list (content routes not yet built)', () => {
    expect(LEGACY_ANCHORS_UNMAPPED).toContain('#herb-index');
    expect(LEGACY_ANCHORS_UNMAPPED).toContain('#quiz');
    for (const a of LEGACY_ANCHORS_UNMAPPED) {
      expect(LEGACY_ANCHOR_MAP[a]).toBeUndefined();
    }
  });

  it('anchor destinations are internal and fragment-free', () => {
    for (const dest of Object.values(LEGACY_ANCHOR_MAP)) {
      expect(dest.startsWith('/')).toBe(true);
      expect(dest).not.toContain('#');
    }
  });
});
