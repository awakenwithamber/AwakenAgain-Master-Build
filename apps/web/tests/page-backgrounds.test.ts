/**
 * Per-page background artwork (owner directive 2026-11-12): every
 * route configured in lib/page-backgrounds.ts must point at a real,
 * processed WebP under public/ — a config entry without its asset
 * would silently render an empty layer (or worse, a 404 texture).
 * Also pins the readability band: opacities stay within 0.10–0.18.
 */
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PAGE_BACKGROUNDS } from '../lib/page-backgrounds';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');

describe('page backgrounds — configured assets exist', () => {
  const specs = Object.values(PAGE_BACKGROUNDS);

  it('configures all sixteen assigned routes', () => {
    const routes = specs.map((s) => s.route);
    for (const route of [
      '/',
      '/grimoire',
      '/quiz',
      '/services',
      '/services/tarot',
      '/services/astrology',
      '/services/house-cleansing',
      '/services/aura-cleansing',
      '/services/spirit-resolution',
      '/services/past-life-regression',
      '/services/inner-renewal',
      '/about',
      '/herb-index',
      '/journal',
      '/network',
      '/links',
    ]) {
      expect(routes).toContain(route);
    }
  });

  it('wires the priestess replacement to the spiritual service slugs only', () => {
    for (const route of [
      '/services/astrology',
      '/services/house-cleansing',
      '/services/aura-cleansing',
      '/services/spirit-resolution',
      '/services/past-life-regression',
      '/services/inner-renewal',
    ]) {
      expect(PAGE_BACKGROUNDS[route]?.src).toBe(
        '/images/backgrounds/bg-priestess.webp',
      );
    }
    // Plain professional pages stay unadorned.
    expect(PAGE_BACKGROUNDS['/services/business-setup']).toBeUndefined();
    expect(PAGE_BACKGROUNDS['/services/web-development']).toBeUndefined();
  });

  it.each(specs.map((s) => [s.route, s.src] as const))(
    '%s → %s exists under public/ and is a non-trivial WebP',
    (_route, src) => {
      expect(src.startsWith('/images/backgrounds/')).toBe(true);
      expect(src.endsWith('.webp')).toBe(true);
      const file = join(webRoot, 'public', src);
      expect(existsSync(file)).toBe(true);
      const { size } = statSync(file);
      expect(size).toBeGreaterThan(1024);
      // Treatment target: each background stays ≤ ~300 KB.
      expect(size).toBeLessThanOrEqual(300_000);
    },
  );

  it.each(specs.map((s) => [s.route, s.opacity] as const))(
    '%s opacity %s stays inside the 0.10–0.18 readability band',
    (_route, opacity) => {
      expect(opacity).toBeGreaterThanOrEqual(0.1);
      expect(opacity).toBeLessThanOrEqual(0.18);
    },
  );
});
