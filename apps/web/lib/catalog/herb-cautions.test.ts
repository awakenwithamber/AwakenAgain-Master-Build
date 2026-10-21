/**
 * Herb caution overlay (Stage 4, R-21).
 *
 * Laws: the optional Herb.caution field is populated ONLY for herbs
 * among the 29 canonical HERB_INDEX entries, ONLY where an in-repo
 * source states the caution (each value is checked verbatim against
 * its cited source file), and every other record — including the
 * other 19 HERB_INDEX herbs — carries no caution and renders nothing.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HERBS, getHerb } from './herbs';
import { HERB_CAUTIONS } from './herb-cautions';
import { HERB_INDEX } from '../content/herbs';
import { HERB_INDEX_SLUG_ALIASES, getHerbalCard } from '../herbal-index/cards';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** HERB_INDEX slugs resolved to catalog record ids. */
const INDEX_RECORD_IDS = new Set(
  HERB_INDEX.map((entry) => HERB_INDEX_SLUG_ALIASES[entry.slug] ?? entry.slug),
);

/** The populated set, with the source file each value lifts from. */
const SOURCED: Record<string, string> = {
  mugwort: 'lib/catalog/products/rec-dreamease-capsules.ts',
  chamomile: 'lib/catalog/products/rec-radiance-support-capsules.ts',
  echinacea: 'lib/catalog/products/rec-immune-at-ease-capsules.ts',
  arnica: 'lib/catalog/products/rec-soothe-restore-botanical-balm.ts',
  comfrey: 'lib/catalog/products/rec-soothe-restore-botanical-balm.ts',
  cayenne: 'lib/catalog/products/rec-soothe-restore-botanical-balm.ts',
  peppermint: 'lib/catalog/products/rec-vital-flow-capsules.ts',
  'white-willow': 'lib/quiz/quiz.ts',
  calendula: 'lib/catalog/products/rec-radiance-renewal-balm.ts',
  fennel: 'lib/catalog/products/rec-root-scalp-revival-serum.ts',
};

describe('herb caution overlay (Stage 4)', () => {
  it('populates exactly the sourced set — no more, no fewer', () => {
    expect(Object.keys(HERB_CAUTIONS).sort()).toEqual(
      Object.keys(SOURCED).sort(),
    );
    const populated = HERBS.filter((h) => h.caution !== undefined).map(
      (h) => h.id,
    );
    expect(populated.sort()).toEqual(Object.keys(SOURCED).sort());
  });

  it('every populated herb is one of the 29 HERB_INDEX records', () => {
    expect(INDEX_RECORD_IDS.size).toBe(29);
    for (const id of Object.keys(HERB_CAUTIONS)) {
      expect(INDEX_RECORD_IDS.has(id), id).toBe(true);
    }
  });

  it('every populated value appears verbatim in its cited in-repo source', () => {
    for (const [id, sourceFile] of Object.entries(SOURCED)) {
      const source = read(sourceFile);
      // The quiz source escapes its apostrophe-free text plainly; the
      // catalog JSON escapes apostrophes as \' — normalize both sides.
      const normalizedSource = source.replace(/\\'/g, "'");
      expect(normalizedSource, `${id} ← ${sourceFile}`).toContain(
        HERB_CAUTIONS[id]!,
      );
      expect(getHerb(id)!.caution).toBe(HERB_CAUTIONS[id]);
    }
  });

  it('the other 19 HERB_INDEX herbs stay empty and render nothing', () => {
    const empty = [...INDEX_RECORD_IDS].filter(
      (id) => !(id in HERB_CAUTIONS),
    );
    expect(empty).toHaveLength(19);
    for (const id of empty) {
      expect(getHerb(id)!.caution, id).toBeUndefined();
      expect(getHerbalCard(id)!.caution, id).toBeNull();
    }
  });

  it('populated records render the caution through the herbal card/detail slot contract', () => {
    for (const id of Object.keys(SOURCED)) {
      expect(getHerbalCard(id)!.caution).toBe(HERB_CAUTIONS[id]);
    }
    // Alias route (willow-bark) resolves to the populated record too.
    expect(getHerbalCard('willow-bark')!.caution).toBe(
      HERB_CAUTIONS['white-willow'],
    );
  });

  it('the field is optional: records without a sourced caution are untouched originals', () => {
    const lavender = getHerb('lavender')!;
    expect('caution' in lavender).toBe(false);
  });
});
