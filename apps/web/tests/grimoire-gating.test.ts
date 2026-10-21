/**
 * Grimoire server-side gating — payload non-leak suite (Stage 2
 * mechanism; ingestion follow-on 2026-10-21 moved the boundary to
 * the owner's 16-page preview).
 *
 * Laws under test:
 * - A locked viewer's serialized payload contains pages 1–16 in full
 *   and ONLY locked placeholders (page number, kind, and a label that
 *   already appears in the free TOC/index) for pages 17+: no gated
 *   body text — not the framing FULL version, not family-edition
 *   text, not collected-work text, not gated facsimile paths.
 * - An entitled viewer's payload contains the full gated text.
 * - The held Black Books of Elverum leaks NOWHERE: its text is
 *   absent from both payloads and from every shipped data file; the
 *   only Elverum strings anywhere in a payload are its title inside
 *   the rights-pending TOC/index entries.
 * - Albertus Magnus contributes facsimiles only — no text anywhere.
 * - Keeper env config never reaches client code, and no component
 *   value-imports the server-only book-content module (import-
 *   boundary checks, following the repo's source-reading style).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildGrimoirePages,
  displayPagesFor,
  FREE_PREVIEW_LAST_PAGE,
  GRIMOIRE_INDEX,
} from '../components/grimoire/grimoireContent';
import { getEditionManifest } from '../lib/grimoire/manifest';
import { getBookContent } from '../lib/grimoire/book-content';

const ROOT = join(process.cwd());
const manifest = getEditionManifest();
const content = getBookContent();
const pages = buildGrimoirePages(manifest, content);
const lockedPayload = JSON.stringify(displayPagesFor(pages, false));
const entitledPayload = JSON.stringify(displayPagesFor(pages, true));

describe('locked viewer payload', () => {
  it('the boundary is page 16/17 (owner Option B, 2026-10-21)', () => {
    expect(FREE_PREVIEW_LAST_PAGE).toBe(16);
    const display = displayPagesFor(pages, false);
    expect(display.slice(0, 16).every((p) => p.kind !== 'locked')).toBe(true);
    const locked = display.filter((p) => p.kind === 'locked');
    expect(locked).toHaveLength(1389 - 16);
    expect(locked[0].pageNumber).toBe(17);
    expect(locked[locked.length - 1].pageNumber).toBe(1389);
  });

  it('locked placeholders expose only page number, kind, and a free-surface label', () => {
    const display = displayPagesFor(pages, false);
    for (const p of display) {
      if (p.kind !== 'locked') continue;
      const keys = Object.keys(p).sort();
      const allowed = [
        ['kind', 'lockedKind', 'pageNumber'],
        ['bookTitle', 'kind', 'lockedKind', 'pageNumber'],
        ['herbName', 'kind', 'lockedKind', 'pageNumber'],
        ['kind', 'lockedKind', 'pageNumber', 'sectionLabel'],
      ].map((a) => a.join(','));
      expect(allowed).toContain(keys.join(','));
    }
    // Labels used are exactly the ones the free TOC/index publish.
    const toc = pages.find((p) => p.kind === 'toc');
    if (toc?.kind !== 'toc') throw new Error('toc missing');
    const tocLabels = toc.entries.map((e) => e.label).join('\n');
    for (const p of display) {
      if (p.kind !== 'locked') continue;
      if (p.bookTitle) expect(tocLabels).toContain(p.bookTitle);
      if (p.sectionLabel) {
        expect(
          tocLabels.includes(p.sectionLabel) ||
            p.sectionLabel === 'Sigil-Making',
        ).toBe(true);
      }
    }
  });

  it('gated framing FULL text is absent from the locked payload', () => {
    // JSON.stringify containment is escape-exact: the payload IS a
    // JSON document, so a shipped string appears in stringified form.
    const canary = JSON.stringify('hide it when riders come');
    const signature = JSON.stringify(
      'They tried to erase the real ones. They could not stop us from keeping them.',
    );
    expect(lockedPayload).not.toContain(canary.slice(1, -1));
    expect(lockedPayload).not.toContain(signature.slice(1, -1));
    expect(entitledPayload).toContain(canary.slice(1, -1));
  });

  it('gated family-edition text is absent from the locked payload', () => {
    // JSON.stringify form: escape-exact against the JSON payload.
    for (const idx of [100, 200, 332]) {
      const text = content.familyPages[idx].paragraphs[0];
      expect(text.length).toBeGreaterThan(60);
      expect(lockedPayload).not.toContain(JSON.stringify(text));
      expect(entitledPayload).toContain(JSON.stringify(text));
    }
  });

  it('gated collected-work text is absent from the locked payload', () => {
    const waite = content.books['book-of-ceremonial-magic-waite-1913'];
    const deepText = waite[199].paragraphs[0];
    expect(deepText.length).toBeGreaterThan(100);
    expect(lockedPayload).not.toContain(JSON.stringify(deepText));
    expect(entitledPayload).toContain(JSON.stringify(deepText));
    const forbidden = content.books['book-of-forbidden-knowledge'];
    const midText = forbidden[79].paragraphs[0];
    expect(midText.length).toBeGreaterThan(100);
    expect(lockedPayload).not.toContain(JSON.stringify(midText));
    expect(entitledPayload).toContain(JSON.stringify(midText));
  });

  it('gated facsimile paths are absent from the locked payload', () => {
    const albertus = content.books['albertus-magnus-egyptian-secrets'];
    const gatedImage = albertus[100].pageImage;
    expect(gatedImage).toBeTruthy();
    expect(lockedPayload).not.toContain(gatedImage);
    expect(entitledPayload).toContain(gatedImage);
  });

  it('free preview content IS present in the locked payload (samples included)', () => {
    // The generated TOC (a free page object) + the Forbidden
    // Knowledge taste page, verbatim. (Front-matter prose constants
    // render from the component, not the page payload, by design.)
    expect(lockedPayload).toContain('A taste of — The Emerald Tablet');
    const sample = pages[15];
    if (sample.kind !== 'collection-sample') throw new Error('sample shape');
    expect(sample.bookId).toBe('book-of-forbidden-knowledge');
    expect(sample.paragraphs[0].length).toBeGreaterThan(40);
    expect(lockedPayload).toContain(JSON.stringify(sample.paragraphs[0]));
  });

  it('the index surface itself carries no gated body text', () => {
    const indexJson = JSON.stringify(GRIMOIRE_INDEX);
    expect(indexJson).not.toContain(content.familyPages[100].paragraphs[0]);
  });
});

describe('Elverum rights hold — absent from every shipped payload', () => {
  it('no payload contains Elverum text, editor name, or content ids', () => {
    for (const payload of [lockedPayload, entitledPayload]) {
      // Interior-text canaries from the held book itself (its
      // bibliographic TITLE legitimately appears in the free
      // TOC/index, so canaries are body-text strings only).
      expect(payload).not.toContain('typescript by Per Sande');
      expect(payload).not.toContain('Mary S. Rustad');
      // No content id or asset path for the held book (lowercase
      // 'elverum' appears only in ids/paths — the allowed TOC/index
      // presence uses the capitalized title).
      expect(payload).not.toContain('black-books-of-elverum');
    }
    // The ONLY Elverum presence is the rights-pending TOC/index entry.
    expect(entitledPayload).toContain('The Black Books of Elverum');
    expect(entitledPayload).toContain('rights pending — not yet available');
  });

  it('no shipped data file carries the held book', () => {
    const dataDir = join(ROOT, 'data', 'grimoire');
    const files = readdirSync(dataDir);
    expect(files.some((f) => f.toLowerCase().includes('elverum'))).toBe(false);
    for (const f of files) {
      const text = readFileSync(join(dataDir, f), 'utf8');
      expect(text).not.toContain('typescript by Per Sande');
      expect(text).not.toContain('Mary S. Rustad');
    }
    const assetsDir = join(ROOT, 'public', 'grimoire');
    expect(
      readdirSync(assetsDir).some((d) => d.toLowerCase().includes('elverum')),
    ).toBe(false);
  });

  it('the server content module never imports held-book data', () => {
    const source = readFileSync(
      join(ROOT, 'lib', 'grimoire', 'book-content.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/from\s+['"][^'"]*elverum[^'"]*['"]/);
    expect(source).not.toMatch(/from\s+['"][^'"]*spells8/i);
  });

  it('the excluded Kabbalah volume is referenced nowhere in shipped code', () => {
    const surfaces = [
      readFileSync(join(ROOT, 'lib', 'grimoire', 'manifest.ts'), 'utf8'),
      readFileSync(
        join(ROOT, 'components', 'grimoire', 'grimoireContent.ts'),
        'utf8',
      ),
      readFileSync(join(ROOT, 'lib', 'grimoire', 'book-content.ts'), 'utf8'),
    ];
    for (const source of surfaces) {
      expect(source.toLowerCase()).not.toContain('kabbalah');
    }
  });
});

describe('Albertus Magnus — facsimile only, no fabricated text', () => {
  it('every ingested Albertus page has zero text paragraphs', () => {
    const albertus = content.books['albertus-magnus-egyptian-secrets'];
    expect(albertus).toHaveLength(216);
    for (const p of albertus) {
      expect(p.paragraphs).toEqual([]);
      expect(p.pageImage).toBeTruthy();
    }
  });
});

describe('keeper env + server content never reach client code', () => {
  function clientSources(): { name: string; source: string }[] {
    const dir = join(ROOT, 'components');
    const out: { name: string; source: string }[] = [];
    const walk = (d: string) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const path = join(d, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
          out.push({ name: entry.name, source: readFileSync(path, 'utf8') });
        }
      }
    };
    walk(dir);
    return out;
  }

  it('no component references the keeper env or server entitlement modules', () => {
    const sources = clientSources();
    expect(sources.length).toBeGreaterThan(10);
    for (const { source } of sources) {
      expect(source).not.toContain('GRIMOIRE_KEEPER_EMAILS');
      expect(source).not.toContain('grimoire/entitlement');
      expect(source).not.toMatch(/from\s+['"][^'"]*grimoire\/unlock['"]/);
      expect(source).not.toContain('grimoire/otp');
    }
  });

  it('book-content is type-only in client-shared code (no gated text in bundles)', () => {
    for (const { name, source } of clientSources()) {
      const imports = source.match(
        /import\s+(type\s+)?\{[^}]*\}\s+from\s+['"][^'"]*book-content['"]/g,
      );
      if (!imports) continue;
      for (const stmt of imports) {
        expect(stmt.startsWith('import type')).toBe(true);
      }
      expect(name).toBe('grimoireContent.ts');
    }
  });

  it('gated owner copy never lives in a client-shared module', () => {
    // The framing FULL version is gated text: it may exist only in
    // the generated data + the server loader, never in components/
    // (whose modules ship in the client bundle).
    for (const { name, source } of clientSources()) {
      expect(source, name).not.toContain('hide it when riders come');
      expect(source, name).not.toContain(
        'They tried to erase the real ones. They could not stop us',
      );
    }
  });

  it('the keeper env is read only in the server entitlement module', () => {
    const serverModule = readFileSync(
      join(ROOT, 'lib', 'grimoire', 'entitlement.ts'),
      'utf8',
    );
    expect(serverModule).toContain('GRIMOIRE_KEEPER_EMAILS');
    expect(serverModule).toContain('SERVER-ONLY');
  });
});
