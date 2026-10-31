/**
 * Unified-header regression suite (Phase 2, 2026-10-14).
 *
 * Guards the two defects this build fixed:
 *  1. DOUBLE NAV — pages used to render a second mini header
 *     (components/shop/SiteHeader) under the main header. Exactly one
 *     <header> may exist in the layout Header, and no source file may
 *     reference the deleted component.
 *  2. ORPHANED ROUTES — the grouped nav (lib/nav.ts) must link every
 *     registered route (lib/seo/routes.ts CANONICAL_ROUTES) plus the
 *     real non-registry pages the old header linked.
 *
 * Why source-level assertions instead of rendering Header: this
 * repo's tsconfig sets "jsx": "preserve", which vitest's transform
 * cannot parse — no test in this repo imports a JSX component
 * (component tests like JsonLd's use createElement-style sources).
 * Rendered behavior (menu open/close, group expand, widths) is
 * verified in a real browser by the Puppeteer nav pass.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_ENTRIES, navHrefs } from '../../lib/nav';
import { CANONICAL_ROUTES } from '../../lib/seo/routes';

const root = process.cwd();
const headerSrc = readFileSync(join(root, 'components/layout/Header.tsx'), 'utf8');
const layoutSrc = readFileSync(join(root, 'app/layout.tsx'), 'utf8');

describe('nav data (lib/nav.ts)', () => {
  it('covers every canonical route — no orphaned pages', () => {
    const hrefs = navHrefs();
    for (const route of CANONICAL_ROUTES) {
      expect(hrefs, `nav is missing ${route.path}`).toContain(route.path);
    }
  });

  it('covers the real non-registry pages the old header linked', () => {
    const hrefs = navHrefs();
    for (const path of ['/custom-formula', '/custom-formula/tea']) {
      expect(hrefs, `nav is missing ${path}`).toContain(path);
    }
  });

  it('never links the bare /herbal-library path — it has no index page (404)', () => {
    // Post-launch fix 2026-10-30: the header linked 'Articles & Guides'
    // to /herbal-library, which 404s (only /herbal-library/[herb]
    // exists). The library index lives at /herb-index — the same
    // destination the footer site map uses.
    const hrefs = navHrefs();
    expect(hrefs).not.toContain('/herbal-library');
    const herbLibrary = NAV_ENTRIES.find(
      (e) => e.kind === 'group' && e.id === 'herb-library',
    );
    if (!herbLibrary || herbLibrary.kind !== 'group') {
      throw new Error('herb-library group missing');
    }
    expect(
      herbLibrary.links.find((l) => l.label === 'Articles & Guides')?.href,
    ).toBe('/herb-index');
  });

  it('puts "Remedies" at the top of the Shop menu, exactly once (punch list)', () => {
    const shop = NAV_ENTRIES.find((e) => e.kind === 'group' && e.id === 'shop');
    if (!shop || shop.kind !== 'group') throw new Error('shop group missing');
    // The remedies page (/shop) is the FIRST item of the Shop menu,
    // labelled exactly "Remedies" — owner punch list 2026-10-10 line 8.
    expect(shop.links[0]).toEqual({ href: '/shop', label: 'Remedies' });
    // …and it is not duplicated anywhere else in the Shop menu.
    expect(shop.links.filter((l) => l.label === 'Remedies')).toHaveLength(1);
    expect(shop.links.filter((l) => l.href === '/shop')).toHaveLength(1);
  });

  it('has no duplicate hrefs and stays grouped (~7 top-level entries)', () => {
    const all: string[] = [];
    for (const entry of NAV_ENTRIES) {
      if (entry.kind === 'link') all.push(entry.href);
      else all.push(...entry.links.map((l) => l.href));
    }
    // Single documented exception (post-launch fix 2026-10-30): the
    // Herb Library group carries two labels for the one library index
    // — 'Herb Encyclopedia' and 'Articles & Guides' both land on
    // /herb-index, mirroring the footer's two labels for the same
    // page. Every other href must be unique.
    const counts = new Map<string, number>();
    for (const href of all) counts.set(href, (counts.get(href) ?? 0) + 1);
    const duplicated = [...counts.entries()].filter(([, n]) => n > 1);
    expect(duplicated).toEqual([['/herb-index', 2]]);
    expect(NAV_ENTRIES.length).toBeGreaterThanOrEqual(6);
    expect(NAV_ENTRIES.length).toBeLessThanOrEqual(9);
    expect(NAV_ENTRIES.filter((e) => e.kind === 'group').length).toBe(4);
  });
});

describe('Header structure (source level)', () => {
  it('is the only header the root layout renders', () => {
    expect((layoutSrc.match(/<Header\s*\/>/g) || []).length).toBe(1);
    expect((headerSrc.match(/<header/g) || []).length).toBe(1);
    expect(headerSrc).toContain('className="site-header"');
    expect(headerSrc).not.toContain('storefront');
  });

  it('renders BOTH navs from the single NAV_ENTRIES data set', () => {
    expect(headerSrc).toContain('NAV_ENTRIES.map(desktopEntry)');
    expect(headerSrc).toContain('NAV_ENTRIES.map(mobileEntry)');
    expect(headerSrc).toContain('aria-label="Primary"');
    expect(headerSrc).toContain('aria-label="Mobile"');
  });

  it('wires the hamburger and group toggles with aria state', () => {
    expect(headerSrc).toContain('aria-controls="mobile-nav"');
    expect(headerSrc).toContain('id="mobile-nav"');
    expect(headerSrc).toContain('aria-expanded={menuOpen}');
    expect(headerSrc).toContain('aria-haspopup="true"');
    expect(headerSrc).toContain('`nav-menu-${entry.id}`');
    expect(headerSrc).toContain('`mobile-nav-menu-${entry.id}`');
    // Menus are always in the DOM, visibility via the hidden attribute.
    expect(headerSrc).toContain('hidden={!open}');
  });

  it('closes menus on Escape and on navigation', () => {
    expect(headerSrc).toContain("e.key !== 'Escape'");
    expect(headerSrc).toContain('usePathname');
    expect(headerSrc).toContain('[pathname]');
  });

  it('keeps the header actions: quiz accent, music controls, cart, search', () => {
    expect(headerSrc).toContain('Find My Formula');
    expect(headerSrc).toContain('<MusicControls />');
    expect(headerSrc).toContain('<Search />');
    expect(headerSrc).toContain('nav-cart');
    expect(headerSrc).toContain('nav-accent-btn');
  });
});

describe('double-nav guard (source level)', () => {
  function* walk(dir: string): Generator<string> {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name);
      if (name.isDirectory()) yield* walk(p);
      else if (/\.tsx?$/.test(name.name) && !/\.test\.tsx?$/.test(name.name)) yield p;
    }
  }

  it('no source file imports or renders the deleted SiteHeader', () => {
    const offenders: string[] = [];
    for (const dir of ['app', 'components', 'lib']) {
      for (const file of walk(join(root, dir))) {
        const src = readFileSync(file, 'utf8');
        if (/from\s+['"][^'"]*SiteHeader['"]/.test(src) || src.includes('<SiteHeader')) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the SiteHeader component file itself is gone', () => {
    let exists = true;
    try {
      readFileSync(join(root, 'components/shop/SiteHeader.tsx'), 'utf8');
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });
});
