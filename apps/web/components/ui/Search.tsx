/**
 * Client-side catalog search (G16).
 *
 * Searches the typed product modules in the browser — no network round
 * trip, instant results. Debounced; fires search_performed with lengths
 * only (never the raw query) so no customer input enters analytics.
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { searchProducts } from '../../lib/search/search';
import { trackContent } from '../../lib/analytics/content-posthog';
import { formatPrice, toCents } from '../../lib/pricing/pricing';

export default function Search() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const results = useMemo(() => searchProducts(query), [query]);

  // Debounced analytics — one event per settled search, lengths only.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) return;
    timer.current = setTimeout(() => {
      trackContent('search_performed', {
        query_length: q.length,
        result_count: searchProducts(q).length,
      });
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  return (
    <div className="site-search" role="search">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search soaps, capsules, balms, services…"
        aria-label="Search the apothecary catalog"
      />
      {open && query.trim().length >= 2 && (
        <div className="site-search-results">
          {results.length === 0 ? (
            <p className="site-search-empty">
              No matches for “{query.trim()}”. Try “lavender”, “soap”, or “capsules”.
            </p>
          ) : (
            <ul>
              {results.map((p) => (
                <li key={p.handle}>
                  <a
                    href={`/shop/${p.handle}`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="site-search-title">{p.title}</span>
                    {typeof p.price === 'number' && (
                      <span className="site-search-price">
                        {formatPrice(toCents(p.price))}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="site-search-close"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
