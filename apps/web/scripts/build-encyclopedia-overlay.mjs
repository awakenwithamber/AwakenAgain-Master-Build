#!/usr/bin/env node
/**
 * build-encyclopedia-overlay.mjs — Herbal Encyclopedia Phase 2A data build.
 *
 * For every herb in the catalog (lib/catalog/herbs-data/part-1..4.ts),
 * keyed by its Latin name, fetch SOURCED encyclopedia fields:
 *
 *   - family            — Wikidata taxonomy ONLY (P171 parent-taxon chain
 *                         walked until a taxon whose rank P105 is "family",
 *                         Q35409). Never from article prose.
 *   - traditionalNames  — Wikidata English aliases of the matched taxon.
 *   - description       — Wikipedia article (Description-like section, or
 *                         the article intro when no such section exists).
 *   - distribution      — Wikipedia Distribution/Habitat-like section.
 *   - cultivation       — Wikipedia Cultivation-like section.
 *   - constituents      — Wikipedia Constituents/Phytochemistry-like section.
 *
 * HARD RULE: nothing is invented. A field a source does not state stays
 * ABSENT from the record. Extracts are capped at ~600 chars, truncated at
 * a sentence boundary where possible. Every field records
 * { value, source: { name, url, retrieved } }.
 *
 * Raw API responses are cached under <workspace>/p2-build-a/cache/ so
 * re-runs never re-hit the APIs. Requests are sequential with a delay.
 *
 * Outputs:
 *   lib/catalog/herb-encyclopedia-data.ts  (generated overlay data)
 *   <workspace>/p2-build-a/coverage-report.md
 *
 * Run from apps/web:  node scripts/build-encyclopedia-overlay.mjs
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// This build runs from a copied work tree (~/workspace/p2-build-a/work)
// or from the extracted repo (…/AwakenAgain-Master-Build-main/apps/web).
// Resolve the p2-build-a scratch dir as the first candidate that exists
// (or the work-tree candidate by default) so the cache is shared across
// layouts and re-runs never re-hit the APIs.
const P2_CANDIDATES = [
  join(WEB_ROOT, '..', '..', 'p2-build-a'),
  join(WEB_ROOT, '..', '..', '..', 'p2-build-a'),
  join(WEB_ROOT, '..', '..', '..', '..', 'p2-build-a'),
];
const P2_DIR = P2_CANDIDATES.find((p) => existsSync(p)) ?? P2_CANDIDATES[0];
const CACHE_DIR = join(P2_DIR, 'cache');
mkdirSync(CACHE_DIR, { recursive: true });

const UA = 'AwakenAgainBotanicalResearch/1.0 (contact: awaken@consultant.com)';
const RETRIEVED = '2026-10-29';
const DELAY_MS = 200;
const MAX_FIELD_CHARS = 600;
const FAMILY_RANK_QID = 'Q35409';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Catalog parsing (shards are generated TS with a stable shape)       */
/* ------------------------------------------------------------------ */

function parseCatalog() {
  const herbs = [];
  for (let i = 1; i <= 4; i++) {
    const text = readFileSync(
      join(WEB_ROOT, 'lib', 'catalog', 'herbs-data', `part-${i}.ts`),
      'utf8',
    );
    const re = /id:\s*"([^"]+)",\s*name:\s*"([^"]*)",\s*latin:\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(text))) {
      herbs.push({ id: m[1], name: m[2], latin: m[3] });
    }
  }
  return herbs;
}

/**
 * The PILOT TRANCHE: the 29 canonical HERB_INDEX herbs
 * (lib/content/herbs.ts), alias-resolved to catalog ids with the same
 * HERB_INDEX_SLUG_ALIASES map the site uses (lib/herbal-index/cards.ts).
 * Parsed from source so this script and the site can never drift.
 */
function parsePilotIds() {
  const indexText = readFileSync(
    join(WEB_ROOT, 'lib', 'content', 'herbs.ts'),
    'utf8',
  );
  const slugs = [...indexText.matchAll(/\{\s*slug:\s*'([^']+)'/g)].map(
    (m) => m[1],
  );
  const cardsText = readFileSync(
    join(WEB_ROOT, 'lib', 'herbal-index', 'cards.ts'),
    'utf8',
  );
  const block = cardsText.slice(
    cardsText.indexOf('HERB_INDEX_SLUG_ALIASES'),
    cardsText.indexOf('};', cardsText.indexOf('HERB_INDEX_SLUG_ALIASES')),
  );
  const aliases = {};
  for (const m of block.matchAll(/(?:'([^']+)'|(\w[\w-]*)):\s*'([^']+)'/g)) {
    aliases[m[1] ?? m[2]] = m[3];
  }
  return slugs.map((slug) => ({
    slug,
    id: aliases[slug] ?? slug,
  }));
}

/** Genus + species tokens from a Latin name (drops hybrid × and authors). */
function genusSpecies(latin) {
  const tokens = latin
    .replace(/×/g, ' ')
    .split(/\s+/)
    .filter((t) => /^[A-Za-z][a-z]+$/.test(t) || /^[A-Z][a-z]+$/.test(t));
  if (tokens.length >= 2) return `${tokens[0]} ${tokens[1]}`;
  const full = latin.trim();
  // Multi-word fallback (e.g. a hyphenated epithet, "Vitex
  // agnus-castus") still verifies by full-name P225 equality. A
  // SINGLE word never verifies: "Propolis" and "Margarita" are also
  // unrelated fungus / sea-snail genera on Wikidata, and a genus-only
  // collision put a fungus's family on the bee-propolis record in the
  // first run. Unverifiable → null → the herb stays unmatched.
  return full.includes(' ') ? full : null;
}

/* ------------------------------------------------------------------ */
/* Cached JSON fetching                                                */
/* ------------------------------------------------------------------ */

async function fetchJson(url) {
  const key = createHash('sha1').update(url).digest('hex');
  const file = join(CACHE_DIR, `${key}.json`);
  if (existsSync(file)) {
    return JSON.parse(readFileSync(file, 'utf8'));
  }
  await sleep(DELAY_MS);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const json = await res.json();
  writeFileSync(file, JSON.stringify(json));
  return json;
}

const wdApi = (params) =>
  `https://www.wikidata.org/w/api.php?${new URLSearchParams({
    format: 'json',
    ...params,
  })}`;

/* ------------------------------------------------------------------ */
/* Wikidata                                                            */
/* ------------------------------------------------------------------ */

async function wdSearch(term) {
  const json = await fetchJson(
    wdApi({
      action: 'wbsearchentities',
      search: term,
      language: 'en',
      type: 'item',
      limit: '7',
    }),
  );
  return (json.search ?? []).map((s) => s.id);
}

async function wdEntities(ids, props) {
  if (ids.length === 0) return {};
  const json = await fetchJson(
    wdApi({
      action: 'wbgetentities',
      ids: ids.join('|'),
      props,
      languages: 'en',
      sitefilter: 'enwiki',
    }),
  );
  return json.entities ?? {};
}

function claimValues(entity, prop) {
  const claims = entity?.claims?.[prop] ?? [];
  return claims
    .map((c) => c?.mainsnak?.datavalue?.value)
    .filter((v) => v !== undefined && v !== null);
}

function taxonName(entity) {
  const v = claimValues(entity, 'P225')[0];
  return typeof v === 'string' ? v : null;
}

/**
 * Find the Wikidata taxon item for a Latin name: search, then VERIFY a
 * candidate's P225 taxon name equals the expected genus+species. A
 * candidate that cannot be verified is never used.
 */
async function matchTaxon(herb) {
  const gs = genusSpecies(herb.latin);
  if (!gs) return null; // no verifiable binomial — never guess
  const expected = gs.toLowerCase();
  const queries = [...new Set([herb.latin, gs, herb.name])];
  for (const q of queries) {
    let ids;
    try {
      ids = await wdSearch(q);
    } catch {
      continue;
    }
    if (ids.length === 0) continue;
    let entities;
    try {
      entities = await wdEntities(ids, 'claims|aliases|labels|sitelinks');
    } catch {
      continue;
    }
    for (const id of ids) {
      const ent = entities[id];
      if (!ent) continue;
      const tn = taxonName(ent);
      if (tn && tn.toLowerCase() === expected) {
        return { qid: id, entity: ent };
      }
    }
  }
  return null;
}

/** Walk P171 parents (depth-first, visited-guarded) until rank = family. */
async function findFamily(qid, entity, depth = 0, visited = new Set()) {
  if (depth > 20 || visited.has(qid)) return null;
  visited.add(qid);
  const parents = claimValues(entity, 'P171')
    .map((v) => v?.id)
    .filter(Boolean);
  for (const pid of parents) {
    let pent;
    try {
      const ents = await wdEntities([pid], 'claims');
      pent = ents[pid];
    } catch {
      continue;
    }
    if (!pent) continue;
    const ranks = claimValues(pent, 'P105').map((v) => v?.id);
    if (ranks.includes(FAMILY_RANK_QID)) {
      return taxonName(pent);
    }
    const up = await findFamily(pid, pent, depth + 1, visited);
    if (up) return up;
  }
  return null;
}

function traditionalNames(entity, herb) {
  const aliases = (entity.aliases?.en ?? []).map((a) => a.value);
  const seen = new Set();
  const out = [];
  for (const a of aliases) {
    const key = a.toLowerCase();
    if (
      key === herb.latin.toLowerCase() ||
      key === herb.name.toLowerCase() ||
      seen.has(key)
    ) {
      continue;
    }
    seen.add(key);
    // Same provider-purity guard as the extracts: an alias carrying a
    // forbidden token is dropped, never shipped.
    if (FORBIDDEN_RE.test(a)) {
      purityAliasDrops++;
      continue;
    }
    out.push(a);
    if (out.length >= 8) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Wikipedia                                                           */
/* ------------------------------------------------------------------ */

const SECTION_FIELDS = [
  // priority order: a heading is claimed by the first field it matches
  ['constituents', ['constituent', 'phytochem', 'chemical composition', 'chemistry', 'composition', 'active compound']],
  ['cultivation', ['cultivation', 'harvest', 'propagation']],
  ['distribution', ['distribution', 'habitat', 'range', 'ecology', 'native range']],
  ['description', ['description', 'morphology', 'characteristics', 'botany', 'appearance']],
];

function cleanExtract(text) {
  return text
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text) {
  if (text.length <= MAX_FIELD_CHARS) return text;
  const cut = text.slice(0, MAX_FIELD_CHARS);
  const sentence = cut.lastIndexOf('. ');
  if (sentence > 300) return cut.slice(0, sentence + 1);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space)}…`;
}

/* Repo law (tests/no-forbidden-providers.test.ts): the tokens of the
   forbidden payment providers may not appear in shipped lib sources —
   but "square" is also ordinary botanical English ("square stems" is
   the mint family's defining trait). An extract containing a token is
   shortened to the text BEFORE the token — a prefix extract, the same
   operation as the 600-char cap, still verbatim from the source — or
   omitted when too little precedes the token. Every application is
   counted and disclosed in the coverage report. */
const FORBIDDEN_RE = /\b(shopify|paypal|square)\b/i;
let purityCuts = 0;
let purityOmits = 0;
let purityAliasDrops = 0;

function purityCut(text) {
  const m = FORBIDDEN_RE.exec(text);
  if (!m) return text;
  const before = text.slice(0, m.index).trimEnd();
  const sentence = before.lastIndexOf('. ');
  let out;
  if (sentence > 120) out = before.slice(0, sentence + 1);
  else {
    const space = before.lastIndexOf(' ');
    out = space > 0 ? `${before.slice(0, space)}…` : before;
  }
  if (out.length >= 40) {
    purityCuts++;
    return out;
  }
  purityOmits++;
  return null;
}

async function wikipediaFields(title) {
  const url =
    `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
      action: 'query',
      prop: 'extracts',
      explaintext: '1',
      exsectionformat: 'wiki',
      titles: title,
      format: 'json',
      formatversion: '2',
      redirects: '1',
    })}`;
  const json = await fetchJson(url);
  const page = json?.query?.pages?.[0];
  const extract = page?.extract ?? '';
  if (!extract) return {};

  // Split into intro + headed sections ("== Heading ==" lines).
  const parts = extract.split(/^==+\s*(.+?)\s*==+\s*$/m);
  const intro = cleanExtract(parts[0] ?? '');
  const sections = [];
  for (let i = 1; i + 1 < parts.length + 1 && i < parts.length; i += 2) {
    sections.push({ heading: parts[i].toLowerCase(), body: cleanExtract(parts[i + 1] ?? '') });
  }

  const fields = {};
  for (const sec of sections) {
    if (sec.body.length < 40) continue;
    for (const [field, keywords] of SECTION_FIELDS) {
      if (fields[field]) continue;
      if (keywords.some((k) => sec.heading.includes(k))) {
        fields[field] = truncate(sec.body);
        break;
      }
    }
  }
  // Description fallback: the article intro is the source's own summary
  // of the plant — used verbatim (truncated), never paraphrased by us.
  if (!fields.description && intro.length >= 40) {
    fields.description = truncate(intro);
  }
  // Provider-purity guard: shorten or omit extracts carrying a
  // forbidden token (see FORBIDDEN_RE above).
  for (const f of Object.keys(fields)) {
    const cut = purityCut(fields[f]);
    if (cut === null) delete fields[f];
    else fields[f] = cut;
  }
  return fields;
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const herbs = parseCatalog();
  console.log(`Catalog: ${herbs.length} herbs`);
  const data = {};
  const unmatched = [];
  const matchedNoWiki = [];
  const fieldCounts = {
    family: 0,
    traditionalNames: 0,
    description: 0,
    distribution: 0,
    cultivation: 0,
    constituents: 0,
  };

  let n = 0;
  for (const herb of herbs) {
    n++;
    if (n % 25 === 0 || n === 1) console.log(`… ${n}/${herbs.length}`);
    let match = null;
    try {
      match = await matchTaxon(herb);
    } catch (err) {
      console.warn(`match failed for ${herb.id}: ${err.message}`);
    }
    if (!match) {
      unmatched.push(herb);
      continue;
    }
    const { qid, entity } = match;
    const wdUrl = `https://www.wikidata.org/wiki/${qid}`;
    const wdSource = { name: 'Wikidata', url: wdUrl, retrieved: RETRIEVED };
    const entry = {};

    try {
      const fam = await findFamily(qid, entity);
      if (fam) {
        entry.family = { value: fam, source: wdSource };
        fieldCounts.family++;
      }
    } catch (err) {
      console.warn(`family failed for ${herb.id}: ${err.message}`);
    }

    const names = traditionalNames(entity, herb);
    if (names.length > 0) {
      entry.traditionalNames = { value: names, source: wdSource };
      fieldCounts.traditionalNames++;
    }

    const title = entity.sitelinks?.enwiki?.title;
    if (title) {
      try {
        const wf = await wikipediaFields(title);
        const wpSource = {
          name: 'Wikipedia',
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
          retrieved: RETRIEVED,
        };
        for (const f of ['description', 'distribution', 'cultivation', 'constituents']) {
          if (wf[f]) {
            entry[f] = { value: wf[f], source: wpSource };
            fieldCounts[f]++;
          }
        }
      } catch (err) {
        console.warn(`wikipedia failed for ${herb.id}: ${err.message}`);
      }
    } else {
      matchedNoWiki.push(herb);
    }

    if (Object.keys(entry).length > 0) {
      data[herb.id] = entry;
    }
  }

  /* ---- generated data file ---- */
  const header = `/**
 * Per-herb encyclopedia overlay data (Herbal Encyclopedia, Project 2
 * Phase 2A) — GENERATED by scripts/build-encyclopedia-overlay.mjs on
 * ${RETRIEVED}. Do not hand-edit; re-run the script (responses are
 * cached) to regenerate.
 *
 * Every field below was fetched from the cited source and is carried
 * verbatim (extracts truncated at ~600 chars at a sentence boundary).
 * Family comes from Wikidata taxonomy (P171 chain to the family-rank
 * taxon); traditional names are the taxon's Wikidata English aliases;
 * description / distribution / cultivation / constituents are short
 * extracts from the taxon's English Wikipedia article sections.
 *
 * A herb or field ABSENT here means the sources did not state it —
 * absence is honest and renders nothing. Nothing in this file was
 * written by hand or inferred.
 *
 * Repo provider-purity law (tests/no-forbidden-providers.test.ts)
 * forbids the tokens of three payment providers in shipped sources,
 * but one of those words is also ordinary botanical English (the
 * mint family's four-angled stems). Extracts containing such a
 * token were shortened to the verbatim prefix before the token, or
 * omitted when too little preceded it; the counts are disclosed in
 * the coverage report.
 */
import type { EncyclopediaEntry } from './herb-encyclopedia';

export const HERB_ENCYCLOPEDIA_DATA: Readonly<
  Record<string, EncyclopediaEntry>
> = ${JSON.stringify(data, null, 2)};
`;
  writeFileSync(
    join(WEB_ROOT, 'lib', 'catalog', 'herb-encyclopedia-data.ts'),
    header,
  );

  /* ---- coverage report ---- */
  const total = herbs.length;
  const pct = (c) => `${c}/${total} (${Math.round((c / total) * 100)}%)`;
  const FIELD_NAMES = [
    'family',
    'traditionalNames',
    'description',
    'distribution',
    'cultivation',
    'constituents',
  ];

  /* Pilot tranche: the 29 canonical HERB_INDEX herbs. */
  const pilot = parsePilotIds();
  const pilotCounts = Object.fromEntries(FIELD_NAMES.map((f) => [f, 0]));
  let pilotEntries = 0;
  const pilotMissing = [];
  for (const p of pilot) {
    const entry = data[p.id];
    if (!entry) {
      pilotMissing.push(p);
      continue;
    }
    pilotEntries++;
    for (const f of FIELD_NAMES) if (entry[f]) pilotCounts[f]++;
  }
  const pilotPct = (c) =>
    `${c}/${pilot.length} (${Math.round((c / pilot.length) * 100)}%)`;
  const pilotTable = FIELD_NAMES.map(
    (f) => `| ${f} | ${pilotPct(pilotCounts[f])} |`,
  ).join('\n');

  /* Samples: the 3 pilot herbs with the richest sourced data (most
     populated fields, then most sourced text). */
  const richness = (entry) => ({
    fields: Object.keys(entry).length,
    chars: Object.values(entry).reduce(
      (sum, f) => sum + JSON.stringify(f.value).length,
      0,
    ),
  });
  const sampleIds = pilot
    .map((p) => p.id)
    .filter((id) => data[id])
    .sort((a, b) => {
      const ra = richness(data[a]);
      const rb = richness(data[b]);
      return rb.fields - ra.fields || rb.chars - ra.chars;
    })
    .slice(0, 3);
  const samples = sampleIds
    .map(
      (id) =>
        `### ${id}\n\n\`\`\`json\n${JSON.stringify(data[id], null, 2)}\n\`\`\``,
    )
    .join('\n\n');
  const report = `# Herbal Encyclopedia overlay — coverage report

Generated: ${RETRIEVED} · Script: scripts/build-encyclopedia-overlay.mjs
Catalog herbs processed: ${total}
Wikidata taxon matched (P225-verified): ${total - unmatched.length}
Overlay entries with at least one field: ${Object.keys(data).length}

## Per-field coverage

| Field | Source | Coverage |
|---|---|---|
| family | Wikidata (P171 chain → family rank) | ${pct(fieldCounts.family)} |
| traditionalNames | Wikidata (English aliases) | ${pct(fieldCounts.traditionalNames)} |
| description | Wikipedia (Description section or article intro) | ${pct(fieldCounts.description)} |
| distribution | Wikipedia (Distribution/Habitat section) | ${pct(fieldCounts.distribution)} |
| cultivation | Wikipedia (Cultivation section) | ${pct(fieldCounts.cultivation)} |
| constituents | Wikipedia (Constituents/Phytochemistry section) | ${pct(fieldCounts.constituents)} |

## PILOT TRANCHE — the 29 canonical HERB_INDEX herbs (owner-approved Phase 2A pilot)

Pilot herbs with at least one sourced field: ${pilotEntries}/${pilot.length}
Pilot slugs resolve to catalog ids via HERB_INDEX_SLUG_ALIASES
(valerian-root→valerian, willow-bark→white-willow, chasteberry→vitex,
red-raspberry-leaf→red-raspberry); all other slugs are their own id.

| Field | Pilot coverage |
|---|---|
${pilotTable}

Provider-purity guard (tests/no-forbidden-providers.test.ts): extracts
shortened to the verbatim prefix before a forbidden token: ${purityCuts};
extracts omitted because too little preceded the token: ${purityOmits};
Wikidata aliases dropped for carrying a token: ${purityAliasDrops}.

Pilot herbs with NO sourced overlay entry (${pilotMissing.length}):

${pilotMissing.map((p) => `- ${p.slug} → ${p.id}`).join('\n') || '- none'}

## Herbs with NO verified Wikidata/Wikipedia match (${unmatched.length})

These stay absent from the overlay — nothing was fabricated for them.
Most are non-botanical catalog items (compounds, blends, vitamins) or
names with no Wikidata taxon under the catalog's Latin name.

${unmatched.map((h) => `- ${h.id} — ${h.name} (${h.latin})`).join('\n')}

## Herbs matched on Wikidata but with no English Wikipedia sitelink (${matchedNoWiki.length})

Family/names may still be present from Wikidata; no Wikipedia fields.

${matchedNoWiki.map((h) => `- ${h.id} — ${h.name} (${h.latin})`).join('\n')}

## Sample records (3 richest PILOT herbs, for spot-checking)

${samples}
`;
  writeFileSync(join(P2_DIR, 'coverage-report.md'), report);
  console.log('Done.', JSON.stringify(fieldCounts));
  console.log(`Unmatched: ${unmatched.length}; entries: ${Object.keys(data).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
