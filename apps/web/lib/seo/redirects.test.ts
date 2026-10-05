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
import { REDIRECT_RULES, findRedirect, validateRedirectMap } from './redirects';

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
});
