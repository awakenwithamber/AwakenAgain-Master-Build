/**
 * /search — full site-search results (owner directive 2026-11-10).
 *
 * The destination of the header search bar's Enter / "See all
 * results". A plain GET form (works without JavaScript) over the
 * registry-built index in lib/search/site-search.ts — products,
 * services, pages, and journal articles, grouped by kind.
 *
 * Deliberately NOT registered in lib/seo/routes CANONICAL_ROUTES:
 * a results page is a utility view, not indexable content, so it
 * carries robots noindex and stays out of the sitemap. The registry's
 * own rule covers indexable pages; this is not one.
 *
 * Empty states guide instead of dead-ending (visible-notices rule):
 * no query yet → what can be searched, with the owner's example
 * searches; no matches → plain words, the same examples, and the
 * main sections to browse instead.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  searchSite,
  type SiteSearchKind,
  type SiteSearchResult,
} from '../../lib/search/site-search';
import { formatPrice, toCents } from '../../lib/pricing/pricing';

export const metadata: Metadata = {
  title: 'Search',
  description:
    'Search everything at Amber’s Alchemy Apothecary — products, services, pages, and journal articles.',
  robots: { index: false, follow: true },
};

/** The owner's example searches (2026-11-10 directive) plus two staples. */
const EXAMPLE_SEARCHES = [
  'tarot',
  'hypnotherapy',
  'free consultation',
  'lavender',
  'soap',
] as const;

const GROUPS: { kind: SiteSearchKind; heading: string }[] = [
  { kind: 'product', heading: 'Products' },
  { kind: 'service', heading: 'Services' },
  { kind: 'page', heading: 'Pages' },
  { kind: 'article', heading: 'Journal' },
];

const PAGE_LIMIT = 60;

function ExampleSearches() {
  return (
    <div className="search-examples" aria-label="Example searches">
      {EXAMPLE_SEARCHES.map((term) => (
        <Link key={term} href={`/search?q=${encodeURIComponent(term)}`}>
          {term}
        </Link>
      ))}
    </div>
  );
}

function ResultRow({ result }: { result: SiteSearchResult }) {
  return (
    <li className="search-result-row">
      <Link href={result.href}>
        <span className="search-result-title">{result.title}</span>
        {typeof result.price === 'number' && (
          <span className="search-result-price">
            {formatPrice(toCents(result.price))}
          </span>
        )}
        {result.blurb && <p className="search-result-blurb">{result.blurb}</p>}
      </Link>
    </li>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const searched = query.length >= 2;
  const results = searched ? searchSite(query, PAGE_LIMIT) : [];

  return (
    <main id="main-content" className="search-page">
      <p className="section-ornament" aria-hidden="true">
        ✦
      </p>
      <h1>Search the Apothecary</h1>
      <p>
        Find anything on the website — a product, a service, a page, or a
        journal article.
      </p>

      <form className="search-page-form" action="/search" method="get" role="search">
        <label className="visually-hidden" htmlFor="site-search-page-input">
          Search the whole website
        </label>
        <input
          id="site-search-page-input"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search — try tarot, hypnotherapy, free consultation…"
          enterKeyHint="search"
        />
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      {!searched && (
        <section aria-label="What can I search for?">
          <h2>Start with a word or two</h2>
          <p>
            Type what you are looking for above — people often search for:
          </p>
          <ExampleSearches />
        </section>
      )}

      {searched && results.length === 0 && (
        <section aria-label="No results">
          <h2>Nothing found for “{query}”</h2>
          <p>
            Check the spelling, or try a shorter word — a scent, an herb,
            or a service name. These searches always find something:
          </p>
          <ExampleSearches />
          <p>
            Or browse the main sections instead:{' '}
            <Link href="/shop">Shop</Link> · <Link href="/services">Services</Link>{' '}
            · <Link href="/grimoire">The Living Grimoire</Link> ·{' '}
            <Link href="/contact">Contact Amber</Link>
          </p>
        </section>
      )}

      {searched &&
        results.length > 0 &&
        GROUPS.map(({ kind, heading }) => {
          const group = results.filter((r) => r.kind === kind);
          if (group.length === 0) return null;
          return (
            <section key={kind} className="search-group" aria-label={heading}>
              <h2>{heading}</h2>
              <ul>
                {group.map((r) => (
                  <ResultRow key={`${r.kind}-${r.href}`} result={r} />
                ))}
              </ul>
            </section>
          );
        })}
    </main>
  );
}
