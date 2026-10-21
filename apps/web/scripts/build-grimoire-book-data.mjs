#!/usr/bin/env node
/**
 * build-grimoire-book-data.mjs — Grimoire ingestion generator
 * (fix-all follow-on, owner directives 2026-10-21: "Make the full
 * grimoire first", "Add them all", free preview = 16 pages).
 *
 * Reads the assembly package produced by the dedicated assembly pass:
 *   ~/workspace/goals/amber-s-alchemy-apothecary-next-js-migration/
 *     files/grimoire-full-assembly/
 * (full-grimoire-manifest.json is the source of truth for book order,
 * page counts and rights flags) and generates:
 *
 *   data/grimoire/<slug>.json   — one page-record array per book:
 *     { pages: [{ heading, paragraphs, images?, pageImage? }] }
 *   data/grimoire/family-edition.json — the 333-page family edition.
 *   data/grimoire/sigil-lesson.json   — the original sigil lesson.
 *   public/grimoire/<slug>/…        — page renders (page-image books),
 *     embedded illustrations (text books), supplied covers.
 *
 * HARD RULES enforced here:
 * - The Black Books of Elverum (© 1999 Mary S. Rustad) is NEVER read,
 *   never extracted, never emitted — rights hold. Its slug is skipped
 *   before any file access and the output tree is asserted clean.
 * - Albertus Magnus is scan-only (OCR-NEEDED): page records carry a
 *   rendered page image and NO text — nothing is fabricated.
 * - The Kabbalah Unveiled is excluded entirely (never in the package).
 * - The held Spells8 article (owner-supplied-text/) is never read.
 * - Page counts are asserted against the assembly manifest; a
 *   mismatch aborts the run (fail closed, never truncate silently).
 *
 * Idempotent: re-running regenerates identical outputs. Requires
 * poppler tools (pdftoppm, pdfimages) on PATH.
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSEMBLY = join(
  process.env.HOME,
  'workspace/goals/amber-s-alchemy-apothecary-next-js-migration/files/grimoire-full-assembly',
);
const DATA_DIR = join(ROOT, 'data/grimoire');
const PUBLIC_DIR = join(ROOT, 'public/grimoire');

const HELD_SLUG = 'black-books-of-elverum';
/** Books rendered as full-page images (pdftoppm), text kept alongside
 *  where a text layer exists (search/accessibility). */
const PAGE_RENDER_BOOKS = new Set([
  'albertus-magnus-egyptian-secrets',
  'book-of-raziel',
  'sepher-sephiroth',
]);
/** Text books whose embedded illustrations are wired per page. */
const EMBEDDED_IMAGE_BOOKS = new Set([
  'book-of-ceremonial-magic-waite-1913',
  'grimorium-verum',
  'book-of-forbidden-knowledge',
  'irish-witchcraft-and-demonology',
]);

function fail(msg) {
  console.error(`BUILD-GRIMOIRE-DATA: ${msg}`);
  process.exit(1);
}

/** Parse a [[PAGE N]]-delimited text-pages.txt into raw page strings. */
function parsePages(text) {
  const parts = text.split(/^\[\[PAGE (\d+)\]\]\s*$/m);
  // parts: [prelude, "1", body1, "2", body2, …]
  const pages = [];
  for (let i = 1; i < parts.length; i += 2) {
    const n = Number(parts[i]);
    if (n !== pages.length + 1) fail(`page marker sequence broken at ${n}`);
    pages.push(parts[i + 1] ?? '');
  }
  return pages;
}

/** Lines that are pure print furniture, evidenced per book family. */
const FURNITURE_PATTERNS = [
  /^— Page \d+ of \d+ —$/, // family edition footer
  /^The Grimoire of Remembered Light • Awaken Again$/, // family header
  /^\d{1,4}$/, // bare page number
];

/**
 * Turn one raw extracted page into { heading, paragraphs }.
 * - furniture lines are dropped;
 * - a short line repeated as furniture across ≥30% of the book's pages
 *   (running heads) is dropped everywhere;
 * - blank-line-separated blocks become paragraphs (layout lines joined
 *   with single spaces);
 * - the first block, when short, becomes the heading.
 */
function paragraphize(rawPages, furnitureLines) {
  return rawPages.map((raw, idx) => {
    const rawLines = raw.replace(/\f/g, '\n').split('\n');
    const kept = [];
    for (const l of rawLines) {
      const t = l.trim();
      if (!t) {
        kept.push('');
        continue;
      }
      if (furnitureLines.has(t)) continue;
      if (FURNITURE_PATTERNS.some((re) => re.test(t))) continue;
      kept.push(t.replace(/\s+/g, ' '));
    }
    const paras = [];
    let buf = [];
    for (const l of kept) {
      if (l === '') {
        if (buf.length) paras.push(buf.join(' '));
        buf = [];
      } else buf.push(l);
    }
    if (buf.length) paras.push(buf.join(' '));
    let heading;
    if (paras.length && paras[0].length <= 140) {
      heading = paras.shift();
    } else if (paras.length) {
      const first = paras[0];
      const cut = first.slice(0, 140);
      heading = cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : 140);
    } else {
      heading = `Page ${idx + 1}`;
    }
    return { heading, paragraphs: paras };
  });
}

/** Short lines (≤70 chars) appearing on ≥30% of pages = running heads. */
function furnitureLineSet(rawPages) {
  const counts = new Map();
  for (const raw of rawPages) {
    const seen = new Set(
      raw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && l.length <= 70),
    );
    for (const l of seen) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  const threshold = Math.max(3, Math.floor(rawPages.length * 0.3));
  return new Set(
    [...counts.entries()].filter(([, c]) => c >= threshold).map(([l]) => l),
  );
}

/** Map embedded images → pages via `pdfimages -list` (type=image only). */
function embeddedImageMap(pdfPath, extractedDir) {
  const out = execFileSync('pdfimages', ['-list', pdfPath], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const files = readdirSync(join(extractedDir, 'images')).sort();
  const byPage = new Map();
  let imageRows = 0;
  for (const line of out.split('\n').slice(2)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 6) continue;
    const [page, num, type, w, h] = [
      Number(cols[0]),
      Number(cols[1]),
      cols[2],
      Number(cols[3]),
      Number(cols[4]),
    ];
    if (type !== 'image' || Number.isNaN(page) || Number.isNaN(num)) continue;
    imageRows++;
    if (w < 40 || h < 40) continue; // hairlines / specks are not illustrations
    const file = files[num];
    if (!file) fail(`pdfimages row ${num} has no extracted file`);
    if (!byPage.has(page)) byPage.set(page, []);
    byPage.get(page).push(file);
  }
  if (imageRows !== files.length) {
    fail(
      `image mapping mismatch: ${imageRows} image rows vs ${files.length} extracted files`,
    );
  }
  return byPage;
}

function main() {
  const manifest = JSON.parse(
    readFileSync(join(ASSEMBLY, 'full-grimoire-manifest.json'), 'utf8'),
  );
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(PUBLIC_DIR, { recursive: true });

  const summary = [];

  /* ---------------- family edition (333 pp., text) ---------------- */
  const famRaw = parsePages(
    readFileSync(join(ASSEMBLY, 'family-edition/text-pages.txt'), 'utf8'),
  );
  if (famRaw.length !== manifest.family_edition.pages) {
    fail(
      `family edition: ${famRaw.length} text pages ≠ manifest ${manifest.family_edition.pages}`,
    );
  }
  const famPages = paragraphize(famRaw, furnitureLineSet(famRaw));
  writeFileSync(
    join(DATA_DIR, 'family-edition.json'),
    JSON.stringify({ pages: famPages }),
  );
  summary.push(`family-edition: ${famPages.length} pages (text)`);

  /* ---------------- collection books ---------------- */
  for (const book of manifest.collection.books) {
    const slug = book.slug;
    if (slug === HELD_SLUG) {
      summary.push(`${slug}: SKIPPED — rights hold (never read)`);
      continue;
    }
    const dir = join(ASSEMBLY, 'extracted', slug);
    const raw = parsePages(readFileSync(join(dir, 'text-pages.txt'), 'utf8'));
    if (raw.length !== book.pages) {
      fail(`${slug}: ${raw.length} text pages ≠ manifest ${book.pages}`);
    }
    const pages = paragraphize(raw, furnitureLineSet(raw));
    const outDir = join(PUBLIC_DIR, slug);
    mkdirSync(outDir, { recursive: true });

    if (PAGE_RENDER_BOOKS.has(slug)) {
      execFileSync('pdftoppm', [
        '-jpeg',
        '-r',
        '100',
        '-jpegopt',
        'quality=85',
        join(dir, 'book.pdf'),
        join(outDir, 'page'),
      ]);
      const renders = new Map();
      for (const f of readdirSync(outDir)) {
        const m = f.match(/^page-(\d+)\.jpg$/);
        if (m) renders.set(Number(m[1]), `/grimoire/${slug}/${f}`);
      }
      if (renders.size !== book.pages) {
        fail(`${slug}: ${renders.size} page renders ≠ ${book.pages} pages`);
      }
      pages.forEach((p, i) => {
        p.pageImage = renders.get(i + 1);
        if (slug === 'albertus-magnus-egyptian-secrets') {
          // Scan-only: no text layer exists — fabricate none.
          p.paragraphs = [];
          p.heading = `Page ${i + 1}`;
        }
      });
      summary.push(
        `${slug}: ${pages.length} pages (page-image${slug === 'albertus-magnus-egyptian-secrets' ? ' only, OCR-needed' : ' + text'})`,
      );
    } else if (EMBEDDED_IMAGE_BOOKS.has(slug)) {
      const byPage = embeddedImageMap(join(dir, 'book.pdf'), dir);
      let wired = 0;
      for (const [page, files] of byPage) {
        const paths = files.map((f) => {
          copyFileSync(join(dir, 'images', f), join(outDir, f));
          return `/grimoire/${slug}/${f}`;
        });
        pages[page - 1].images = paths;
        wired += paths.length;
      }
      summary.push(`${slug}: ${pages.length} pages (text + ${wired} images wired)`);
    } else {
      summary.push(`${slug}: ${pages.length} pages (text)`);
    }

    /* supplied cover art */
    const coverSources = [
      join(dir, 'cover-supplied.jpg'),
      join(
        ASSEMBLY,
        'collection/incoming-2026-10-21b',
        slug === 'book-of-forbidden-knowledge'
          ? 'The-Book-of-Forbidden-Knowledge-1_43_h7o9.jpg'
          : slug === 'emerald-tablet-of-hermes'
            ? 'The-Emerald-Tablet-of-Hermes-1_42_gmzi.jpg'
            : '__none__',
      ),
    ];
    for (const src of coverSources) {
      if (existsSync(src)) {
        copyFileSync(src, join(outDir, 'cover.jpg'));
        summary.push(`${slug}: cover wired (/grimoire/${slug}/cover.jpg)`);
        break;
      }
    }

    writeFileSync(
      join(DATA_DIR, `${slug}.json`),
      JSON.stringify({ pages }),
    );
  }

  /* ---------------- original sigil lesson ---------------- */
  const lessonMd = readFileSync(
    join(
      ASSEMBLY,
      'original-content/sigil-making-a-living-grimoire-lesson-2026-10-21.md',
    ),
    'utf8',
  );
  const bodyStart = lessonMd.indexOf('## Sigil-Making');
  const bodyEnd = lessonMd.indexOf('\n---', bodyStart);
  if (bodyStart < 0 || bodyEnd < 0) fail('sigil lesson body not found');
  const lessonBody = lessonMd.slice(bodyStart, bodyEnd);
  const lessonParas = lessonBody
    .split(/\n\s*\n/)
    .map((b) =>
      b
        .replace(/^#{2,3}\s+/gm, '')
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((b) => b && b !== 'Sigil-Making');
  writeFileSync(
    join(DATA_DIR, 'sigil-lesson.json'),
    JSON.stringify({ heading: 'Sigil-Making', paragraphs: lessonParas }),
  );
  summary.push(`sigil-lesson: 1 page, ${lessonParas.length} paragraphs (original)`);


  /* ---------------- framing FULL version (gated owner copy) --------
   * VERBATIM from the owner file
   * grimoire-what-a-true-grimoire-is-2026-10-21.md ("FULL VERSION"),
   * split across the two gated front-matter pages the assembly
   * manifest budgets for it. It lives ONLY in this generated data
   * file + the server loader — never in a client-shared module, or
   * the gated text would ship in the client bundle. */
const FRAMING_FULL_PAGES = [
  [
    'The word grimoire comes from the Old French grammaire — a book of knowledge. But long before the word, there were the books themselves: handwritten collections of remedies, charms, calendars, star-lore, prayers, and household wisdom, gathered over a lifetime and rarely finished by the hand that began them.',
    'A true grimoire was never a finished product. It was a living document. One keeper wrote down how to draw a fever out and when to sow by the moon; the next added a marriage, a death, a drought year, a better way to keep seed through winter. The margins filled with generations arguing, agreeing, improving. To hold one was to hold your own family’s evidence that they had paid attention to the world — and survived it.',
    'That is precisely why they were hunted.',
  ],
  [
    'Across centuries, grimoires and the people who kept them were condemned as dangerous. Churches banned them; inquisitors catalogued them among forbidden books; copies were burned in public as warnings. During the witch-trial years, a handwritten book of remedies and charms found in the wrong cottage could be treated as proof of a crime. The keepers — so often women, so often the village’s memory for healing, birth, and burial — were exactly the people that campaign of erasure was aimed at.',
    'And still, they could not erase them.',
    'Because a grimoire is not only paper. It is a practice: copy it before it fades, hide it when riders come, teach it aloud when writing is unsafe, bury it in the garden wall and dig it up when the danger passes. Families did all of this, for hundreds of years, and the books came through — scorched at the edges, rebound in homespun cloth, annotated in five different hands — as protected heirlooms, handed down keeper to keeper, exactly as they were meant to be.',
    'The Living Grimoire of Light & Magic is written into that lineage on purpose. It is a keeper’s book for this century: gathered slowly, guarded deliberately, and shared only under protection — no downloads, no loose copies, every viewing watched over — because what families fought to keep deserves better than to be scattered carelessly across the internet.',
    'They tried to erase the real ones. They could not stop us from keeping them.',
    '— kept by Amber’s Alchemy Apothecary',
  ],
];
  if (FRAMING_FULL_PAGES.length !== 2) fail('framing full must be 2 pages');
  if (!FRAMING_FULL_PAGES[1].join(' ').includes('hide it when riders come')) {
    fail('framing full canary missing');
  }
  writeFileSync(
    join(DATA_DIR, 'framing-full.json'),
    JSON.stringify({ pages: FRAMING_FULL_PAGES }),
  );
  summary.push('framing-full: 2 pages (verbatim owner copy, gated)');

  /* ---------------- hold enforcement ---------------- */
  const heldOut = join(DATA_DIR, `${HELD_SLUG}.json`);
  if (existsSync(heldOut)) rmSync(heldOut);
  for (const f of readdirSync(DATA_DIR)) {
    if (f.toLowerCase().includes('elverum')) fail(`held content leaked: ${f}`);
  }

  console.log(summary.join('\n'));
  console.log('BUILD-GRIMOIRE-DATA: done');
}

main();
