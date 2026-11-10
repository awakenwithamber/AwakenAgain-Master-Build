/**
 * Site-wide search (owner directive 2026-11-10: a search bar in the
 * menu so people can find anything on the website).
 *
 * Searches the whole site in the browser — products, services, pages,
 * and journal articles — over the registry-built index in
 * lib/search/site-search.ts. No network round trip, instant results.
 * Enter (or "See all results") goes to the full /search results page.
 * Escape closes the dropdown; a click outside closes it too.
 *
 * Rendered twice by the header: in the desktop actions row and at the
 * top of the mobile menu panel (the desktop copy is CSS-hidden on
 * small screens, where the panel copy is the reachable one).
 *
 * Analytics: debounced search_performed with lengths only (never the
 * raw query), so no customer input enters analytics.
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  searchSite,
  SITE_SEARCH_KIND_LABELS,
} from '../../lib/search/site-search';
import { trackContent } from '../../lib/analytics/content-posthog';
import { formatPrice, toCents } from '../../lib/pricing/pricing';
import { SaveSearchButton } from '../account/SaveSearchButton';

const DROPDOWN_LIMIT = 8;

export default function Search() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLFormElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = query.trim();
  const results = useMemo(
    () => (trimmed.length >= 2 ? searchSite(trimmed, DROPDOWN_LIMIT) : []),
    [trimmed],
  );

  // Debounced analytics — one event per settled search, lengths only.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (trimmed.length < 2) return;
    timer.current = setTimeout(() => {
      trackContent('search_performed', {
        query_length: trimmed.length,
        result_count: searchSite(trimmed).length,
      });
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [trimmed]);

  // A click anywhere outside this search closes its dropdown.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open ]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setOpen(false);
    router.push(
      trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search',
    );
  };

  return (
    <form
      ref={rootRef}
      className="site-search"
      role="search"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          // Just the dropdown closes — never the menu around it.
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search — try tarot, hypnotherapy, free consultation…"
        aria-label="Search the whole website"
        enterKeyHint="search"
      />
      {open && trimmed.length >= 2 && (
        <div className="site-search-results">
          {results.length === 0 ? (
            <p className="site-search-empty">
              Nothing found for “{trimmed}”. Try tarot, hypnotherapy, or
              free consultation — or see all results for more ideas.
            </p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={`${r.kind}-${r.href}`}>
                  <Link href={r.href} onClick={() => setOpen(false)}>
                    <span className="site-search-main">
                      <span className="site-search-title">{r.title}</span>
                      <span className="site-search-kind">
                        {SITE_SEARCH_KIND_LABELS[r.kind]}
                      </span>
                    </span>
                    {typeof r.price === 'number' && (
                      <span className="site-search-price">
                        {formatPrice(toCents(r.price))}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="site-search-foot">
            <button type="submit" className="site-search-all">
              See all results
            </button>
            {/* Explicit save (Phase 3 Step 3): searching records nothing
                server-side; only this tap saves, to the signed-in profile. */}
            <SaveSearchButton query={trimmed} surface="catalog" />
            <button
              type="button"
              className="site-search-close"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
