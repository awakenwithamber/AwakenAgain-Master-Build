#!/usr/bin/env node
/**
 * generate-herb-search-data.mjs — compact herb data for site search
 * (owner directive 2026-11-10: "Yes add every herb" to the site-wide
 * search, with herb-name queries ranking the herb's own page first).
 *
 * WHY A GENERATED FILE: lib/search/site-search.ts runs in the browser
 * (the header search is a client component on every page). Importing
 * the full herbal registries there would drag the catalog records,
 * the sourced references overlay, and the illustration maps into the
 * shared first-load bundle of EVERY page. This script instead emits
 * lib/search/herb-search-data.ts — one compact record per herb page
 * route carrying ONLY what search needs: route slug, name, Latin
 * name, category labels, up to 5 recorded properties (verbatim), and
 * the canonical index name when it differs from the record name.
 *
 * SOURCE OF TRUTH: the exact modules the herb pages render from —
 * lib/herbal-index/cards.ts (herbalRouteParams + getHerbalCard, the
 * same functions app/herbal-library/[herb] uses for
 * generateStaticParams and its card) and lib/content/herbs.ts
 * (HERB_INDEX). Nothing is hand-listed and nothing is invented: a
 * field the source record does not carry stays absent.
 *
 * The output is guarded by lib/search/herb-search-data.test.ts, which
 * re-derives every record from the source registries and fails if
 * this file has drifted — regenerate instead of hand-editing:
 *
 *   cd apps/web && node scripts/generate-herb-search-data.mjs
 *
 * (Uses Vite's SSR module loader — Vite is already a dev dependency
 * via Vitest — so the TypeScript registries load exactly as the app
 * itself resolves them.)
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(WEB_ROOT, 'lib', 'search', 'herb-search-data.ts');

const server = await createServer({
  root: WEB_ROOT,
  logLevel: 'silent',
  server: { middlewareMode: true },
  appType: 'custom',
});
try {
  const cards = await server.ssrLoadModule('/lib/herbal-index/cards.ts');
  const content = await server.ssrLoadModule('/lib/content/herbs.ts');

  const indexBySlug = new Map(content.HERB_INDEX.map((e) => [e.slug, e]));

  const records = cards.herbalRouteParams().map(({ herb: slug }) => {
    const card = cards.getHerbalCard(slug);
    if (!card) {
      throw new Error(`route slug ${slug} has no herbal card — cannot index it honestly`);
    }
    const record = {
      slug,
      name: card.name,
      latin: card.latin,
      labels: [...card.categoryLabels],
      props: [...card.properties],
    };
    // The route's canonical HERB_INDEX name, when it names the same
    // plant differently (e.g. /herbal-library/willow-bark renders the
    // "White Willow Bark" card) — kept so that name stays findable.
    const indexEntry = indexBySlug.get(slug);
    if (indexEntry && indexEntry.name !== card.name) record.aka = indexEntry.name;
    return record;
  });

  const body = records
    .map((r) => `  ${JSON.stringify(r)},`)
    .join('\n');
  const out = `/**
 * GENERATED — do not hand-edit.
 *
 * Compact herb search data for lib/search/site-search.ts: one record
 * per /herbal-library/[herb] route (${records.length} routes), derived from the
 * same registries the herb pages render from (lib/herbal-index/cards
 * + lib/content/herbs) by scripts/generate-herb-search-data.mjs.
 * Fields are the source records' own values, verbatim: name, Latin
 * name, category labels, and up to 5 recorded properties (the card's
 * "Properties:" folkloric list). \`aka\` is the route's canonical
 * HERB_INDEX name when it differs from the record name.
 *
 * Guarded by lib/search/herb-search-data.test.ts — if that test
 * fails, regenerate:  node scripts/generate-herb-search-data.mjs
 */
export interface HerbSearchRecord {
  /** Route slug — the page lives at /herbal-library/<slug>. */
  slug: string;
  name: string;
  latin: string;
  /** Category labels, verbatim from the card view-model. */
  labels: readonly string[];
  /** Recorded properties, verbatim (the card's folkloric list). */
  props: readonly string[];
  /** Canonical index name for this route, when it differs. */
  aka?: string;
}

export const HERB_SEARCH_DATA: readonly HerbSearchRecord[] = [
${body}
];
`;
  writeFileSync(OUT, out);
  console.log(`wrote ${OUT} — ${records.length} herb route records, ${out.length} bytes`);
} finally {
  await server.close();
}
