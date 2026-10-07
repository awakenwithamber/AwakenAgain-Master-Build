/**
 * Workstream E — herb data integrity tests.
 *
 * Guards: every canonical herb has an illustration URL, the symptom keyword
 * table stays at full coverage (~70 keywords from the Netlify source of
 * truth), and representative symptom searches resolve to the expected herbs.
 */
import { describe, expect, it } from 'vitest';
import { illustrationFor } from './illustrations';
import {
  CATEGORY_LABELS,
  ENERGETIC_PROPERTIES,
  EXPLORER_QUICK_CATEGORIES,
  HERBS,
  SYMPTOM_KEYWORDS,
  SYMPTOM_KEYWORD_COUNT,
  getHerbRecord,
  searchHerbs,
} from './herb-data';
import { HERB_INDEX } from '../content/herbs';

describe('herb records', () => {
  it('covers every canonical herbal-library herb', () => {
    expect(HERBS).toHaveLength(HERB_INDEX.length);
    expect(HERB_INDEX.map((h) => h.slug)).toEqual(HERBS.map((h) => h.slug));
  });

  it('every herb has a name, latin name, and at least one category', () => {
    for (const herb of HERBS) {
      expect(herb.name.length).toBeGreaterThan(0);
      expect(herb.latin.length).toBeGreaterThan(0);
      expect(herb.categories.length).toBeGreaterThan(0);
    }
  });

  it('every herb has an illustration URL (report names any that lack one)', () => {
    const missing = HERBS.filter((h) => !h.illustration).map((h) => h.slug);
    expect(missing).toEqual([]);
  });

  it('every herb has an energetic-properties paragraph from the source', () => {
    for (const herb of HERBS) {
      expect(herb.energetic.length).toBeGreaterThan(40);
    }
  });

  it('all 29 canonical slugs resolve', () => {
    for (const entry of HERB_INDEX) {
      expect(getHerbRecord(entry.slug)?.name).toBe(entry.name);
    }
  });

  it('alias slugs resolve to their canonical illustration', () => {
    expect(getHerbRecord('valerian-root')?.illustration).toContain('herb-valerian_');
    expect(getHerbRecord('red-raspberry-leaf')?.illustration).toContain('herb-raspberry-leaf_');
    expect(getHerbRecord('chasteberry')?.illustration).toBeTruthy();
    expect(getHerbRecord('willow-bark')?.illustration).toBe(illustrationFor('white-willow'));
  });
});

describe('symptom keyword coverage', () => {
  it('carries the full keyword table from the Netlify source of truth', () => {
    // The live source (grimoire.js SYMPTOM_MAP) carries exactly 67 keywords
    // ("~70" in the spec). Transcription must stay verbatim — no drift.
    expect(SYMPTOM_KEYWORD_COUNT).toBe(67);
  });

  it('includes the flagship keywords for every explorer category', () => {
    for (const qc of EXPLORER_QUICK_CATEGORIES) {
      expect(SYMPTOM_KEYWORDS[qc.keyword]).toBeDefined();
    }
    expect(SYMPTOM_KEYWORDS['insomnia']).toEqual(['sleep']);
    expect(SYMPTOM_KEYWORDS['bloating' as keyof typeof SYMPTOM_KEYWORDS] ?? SYMPTOM_KEYWORDS['bloat']).toBeDefined();
    expect(SYMPTOM_KEYWORDS['pms']).toEqual(['hormonal']);
    expect(SYMPTOM_KEYWORDS['arthritis']).toEqual(['pain']);
  });
});

describe('searchHerbs', () => {
  it('returns sleep herbs for insomnia', () => {
    const slugs = searchHerbs('insomnia').map((h) => h.slug);
    expect(slugs).toContain('valerian-root');
    expect(slugs).toContain('passionflower');
    expect(slugs).toContain('chamomile');
  });

  it('returns pain herbs for back pain', () => {
    const slugs = searchHerbs('back pain').map((h) => h.slug);
    expect(slugs).toContain('arnica');
    expect(slugs).toContain('turmeric');
    expect(slugs).toContain('willow-bark');
  });

  it('returns immunity herbs for cold and flu', () => {
    const slugs = searchHerbs('cold and flu').map((h) => h.slug);
    expect(slugs).toContain('elderberry');
    expect(slugs).toContain('echinacea');
    expect(slugs).toContain('astragalus');
  });

  it('returns digestion herbs for bloating', () => {
    const slugs = searchHerbs('bloating after meals').map((h) => h.slug);
    expect(slugs).toContain('peppermint');
    expect(slugs).toContain('ginger');
    expect(slugs).toContain('fennel');
  });

  it('returns hormonal herbs for pms', () => {
    const slugs = searchHerbs('pms').map((h) => h.slug);
    expect(slugs).toContain('chasteberry');
    expect(slugs).toContain('red-raspberry-leaf');
  });

  it('returns beauty herbs for acne', () => {
    const slugs = searchHerbs('acne').map((h) => h.slug);
    expect(slugs).toContain('calendula');
  });

  it('returns adaptogen herbs for stress', () => {
    const slugs = searchHerbs('stress').map((h) => h.slug);
    expect(slugs).toContain('ashwagandha');
    expect(slugs).toContain('rhodiola');
  });

  it('finds herbs by direct name', () => {
    expect(searchHerbs('mugwort').map((h) => h.slug)).toEqual(['mugwort']);
  });

  it('returns empty for blank input and nothing for nonsense', () => {
    expect(searchHerbs('')).toEqual([]);
    expect(searchHerbs('   ')).toEqual([]);
    expect(searchHerbs('xylophone zebra')).toEqual([]);
  });
});

describe('categories', () => {
  it('every category key has a label and an energetic paragraph', () => {
    for (const key of Object.keys(ENERGETIC_PROPERTIES) as Array<keyof typeof ENERGETIC_PROPERTIES>) {
      expect(CATEGORY_LABELS[key].length).toBeGreaterThan(0);
      expect(ENERGETIC_PROPERTIES[key].length).toBeGreaterThan(40);
    }
  });

  it('the explorer offers exactly the 10 specified quick categories', () => {
    expect(EXPLORER_QUICK_CATEGORIES.map((c) => c.label)).toEqual([
      'Sleep',
      'Stress',
      'Immunity',
      'Pain',
      'Focus',
      'Energy',
      'Anxiety',
      'Digestion',
      'Skin',
      'Hormones',
    ]);
  });
});
