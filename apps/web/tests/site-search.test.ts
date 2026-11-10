/**
 * Site-wide search — UI regression pins (owner directive 2026-11-10:
 * a search bar in the menu so people can find anything on the site,
 * with examples like tarot, hypnotherapy, free consultation).
 *
 * Source-level assertions, matching this repo's component-test style
 * (see components/layout/Header.test.ts for why: tsconfig "jsx":
 * "preserve" cannot be parsed by vitest's transform, so no test here
 * imports a JSX component). Behavioral ranking pins live in
 * lib/search/site-search.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const headerSrc = readFileSync(join(root, 'components/layout/Header.tsx'), 'utf8');
const searchSrc = readFileSync(join(root, 'components/ui/Search.tsx'), 'utf8');
const searchPageSrc = readFileSync(join(root, 'app/search/page.tsx'), 'utf8');
const siteSearchSrc = readFileSync(join(root, 'lib/search/site-search.ts'), 'utf8');
const globalsSrc = readFileSync(join(root, 'app/globals.css'), 'utf8');

describe('header search placement', () => {
  it('renders the search in the desktop actions AND in the mobile menu panel', () => {
    const occurrences = headerSrc.match(/<Search \/>/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
    // One instance lives after the mobile panel opens (the panel copy
    // is the only search reachable on small screens, where the
    // desktop copy is CSS-hidden).
    const panelStart = headerSrc.indexOf('id="mobile-nav"');
    expect(panelStart).toBeGreaterThan(-1);
    expect(headerSrc.indexOf('<Search />', panelStart)).toBeGreaterThan(panelStart);
    expect(headerSrc).toContain('mobile-search-row');
  });
});

describe('header search component (components/ui/Search.tsx)', () => {
  it('uses the owner’s example searches in the placeholder', () => {
    expect(searchSrc).toContain(
      'placeholder="Search — try tarot, hypnotherapy, free consultation…"',
    );
  });

  it('searches the whole site, not just the catalog', () => {
    expect(searchSrc).toContain("from '../../lib/search/site-search'");
    expect(searchSrc).toContain('searchSite(');
    expect(searchSrc).toContain('aria-label="Search the whole website"');
  });

  it('Enter submits to the full /search results page', () => {
    expect(searchSrc).toContain('onSubmit={submit}');
    expect(searchSrc).toContain('/search?q=${encodeURIComponent(trimmed)}');
  });

  it('Escape closes the dropdown', () => {
    expect(searchSrc).toContain("e.key === 'Escape'");
    expect(searchSrc).toContain('setOpen(false)');
  });

  it('the nothing-found state guides with the example searches — no dead end', () => {
    expect(searchSrc).toContain('Nothing found for');
    expect(searchSrc).toContain('Try tarot, hypnotherapy, or');
  });

  it('keeps the analytics privacy rule: lengths only, never the raw query', () => {
    expect(searchSrc).toContain("trackContent('search_performed'");
    expect(searchSrc).toContain('query_length: trimmed.length');
    // The event payload must not carry the raw query under any key —
    // only its length and the result count are sent.
    expect(searchSrc).toContain('result_count:');
    expect(searchSrc).not.toMatch(/query:\s*(trimmed|query)\b/);
  });
});

describe('/search results page (app/search/page.tsx)', () => {
  it('renders grouped results from the same site index', () => {
    expect(searchPageSrc).toContain("from '../../lib/search/site-search'");
    expect(searchPageSrc).toContain('searchSite(query, PAGE_LIMIT)');
    for (const heading of ['Products', 'Services', 'Pages', 'Journal']) {
      expect(searchPageSrc).toContain(`heading: '${heading}'`);
    }
  });

  it('is a noindex utility page (not an indexable content page)', () => {
    expect(searchPageSrc).toContain('robots: { index: false, follow: true }');
  });

  it('both empty states guide with the owner’s examples', () => {
    expect(searchPageSrc).toContain("'tarot'");
    expect(searchPageSrc).toContain("'hypnotherapy'");
    expect(searchPageSrc).toContain("'free consultation'");
    expect(searchPageSrc).toContain('Nothing found for');
  });

  it('the search form works without JavaScript (plain GET)', () => {
    expect(searchPageSrc).toContain('action="/search"');
    expect(searchPageSrc).toContain('method="get"');
    expect(searchPageSrc).toContain('name="q"');
  });
});

describe('styles + wording canon', () => {
  it('the dropdown and page styles actually exist (they never did before)', () => {
    expect(globalsSrc).toContain('.site-search-results {');
    expect(globalsSrc).toContain('.mobile-nav-panel .site-search-results {');
    expect(globalsSrc).toContain('.search-page {');
  });

  it('no banned wording in the new search UI copy', () => {
    for (const src of [searchSrc, searchPageSrc, siteSearchSrc]) {
      expect(src).not.toContain('Custom Remedy Builder');
    }
    // "remedy" appears in the new UI copy nowhere (a code comment in
    // site-search.ts names the canon rule itself; visible copy is
    // what this pins).
    expect(searchSrc.toLowerCase()).not.toContain('remedy');
    expect(searchPageSrc.toLowerCase()).not.toContain('remedy');
  });
});
