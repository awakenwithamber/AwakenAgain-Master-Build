/**
 * Grimoire facsimile asset map (reader hardening, 2026-11-07).
 *
 * Asset key → the EARLIEST composed page number that uses it,
 * derived from the composed book itself (the one source of truth):
 * a source page appears both as a free sample and inside the full
 * run, and the earliest placement decides its exposure — a sample
 * image is already public in the preview, so the file is too.
 * Cached per process; the book data is static per deploy.
 *
 * Lives in lib (not in the route file) because Next.js route
 * modules may only export handlers/config — the gated asset route
 * (app/api/grimoire-assets/[...asset]) and its tests both import
 * this. Server-only.
 */
import { buildGrimoirePages } from '../../components/grimoire/grimoireContent';
import { getBookContent } from './book-content';
import { getEditionManifest } from './manifest';

let assetPageMapCache: Map<string, number> | null = null;

export function grimoireAssetPageMap(): Map<string, number> {
  if (assetPageMapCache) return assetPageMapCache;
  const pages = buildGrimoirePages(getEditionManifest(), getBookContent());
  const map = new Map<string, number>();
  for (const page of pages) {
    if (page.kind !== 'collection-sample' && page.kind !== 'collection-page') {
      continue;
    }
    const paths = [
      ...(page.images ?? []),
      ...(page.pageImage ? [page.pageImage] : []),
    ];
    for (const raw of paths) {
      const key = raw
        .replace(/^\/?api\/grimoire-assets\//, '')
        .replace(/^\/?grimoire\//, '');
      if (!key || key.includes('..')) continue;
      const previous = map.get(key);
      if (previous === undefined || page.pageNumber < previous) {
        map.set(key, page.pageNumber);
      }
    }
  }
  assetPageMapCache = map;
  return map;
}
