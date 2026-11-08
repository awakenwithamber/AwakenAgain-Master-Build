import { describe, expect, it } from 'vitest';
import {
  enrichAdvisorResult,
  enrichClassicAlly,
  enrichClassicResult,
  herbLibrarySlug,
  NO_SAFETY_NOTES_ON_FILE,
  preparationFor,
  productsForHerb,
  safetyLinesFor,
  safetyNotesFor,
  whyMatchedClassic,
} from './herb-enrichment';
import { HERB_CAUTIONS } from '../catalog/herb-cautions';
import { getQuizResult, toQuizResultSnapshot } from './quiz';
import {
  computeAdvisorSynthesis,
  toAdvisorResultSnapshot,
  type AdvisorAnswers,
} from './advisor';
import { NO_QUIZ_SCREENING } from './quiz';

const BASE = 'https://www.awakenagain.com';

describe('herbLibrarySlug', () => {
  it('resolves library slugs for herbs that have pages', () => {
    expect(herbLibrarySlug('Chamomile')).toBe('chamomile');
    expect(herbLibrarySlug('Valerian root')).toBe('valerian-root');
    expect(herbLibrarySlug('Willow bark')).toBe('willow-bark');
    expect(herbLibrarySlug('Red raspberry leaf')).toBe('red-raspberry-leaf');
  });

  it('returns null for herbs with no library page — never a guessed URL', () => {
    // St. John's Wort is in the formula catalog but has no HERB_INDEX
    // entry; it must render unlinked rather than pointing at a 404.
    expect(herbLibrarySlug("St. John's Wort")).toBeNull();
    expect(herbLibrarySlug('Lavender')).toBeNull();
  });
});

describe('safetyNotesFor — the on-file transcription table', () => {
  it('carries verbatim notes for the eight herbs with safety text on file', () => {
    for (const herb of [
      'Chamomile',
      'Echinacea',
      'Arnica',
      'Willow bark',
      'Peppermint',
      'Mugwort',
      'Comfrey',
      "St. John's Wort",
    ]) {
      const safety = safetyNotesFor(herb);
      expect(safety.onFile, herb).toBe(true);
      expect(safety.notes.length, herb).toBeGreaterThan(0);
    }
  });

  it("carries the full St. John's Wort interaction text", () => {
    const safety = safetyNotesFor("St. John's Wort");
    expect(safety.notes).toHaveLength(4);
    expect(safety.notes.join(' ')).toContain(
      'interacts with many medications, including antidepressants, birth control, blood thinners, and immunosuppressants',
    );
    expect(safety.notes.join(' ')).toContain('sensitivity to sunlight');
  });

  it('carries both Echinacea sentences and the Willow bark blood-thinner clause', () => {
    expect(safetyNotesFor('Echinacea').notes).toHaveLength(2);
    expect(safetyNotesFor('Willow bark').notes[0]).toContain('blood thinners');
    expect(safetyNotesFor('Arnica').notes).toEqual(['External use only.']);
  });

  it('falls back to the standard line for herbs with nothing on file', () => {
    for (const herb of ['Turmeric', 'Valerian root', 'Ashwagandha', 'Ginger']) {
      const safety = safetyNotesFor(herb);
      expect(safety.onFile, herb).toBe(false);
      expect(safetyLinesFor(herb)).toEqual([NO_SAFETY_NOTES_ON_FILE]);
    }
    // The safety block is never empty, for any herb.
    expect(safetyLinesFor('Turmeric')[0]).toContain(
      'consult a qualified practitioner before use',
    );
  });

  it('resolves the HERB_CAUTIONS tier for herbs the transcription table lacks (2026-11-08)', () => {
    // Fennel, Calendula, and Cayenne have no entry in the owner's
    // transcription table, but the Herb Library's sourced overlay
    // carries cautions naming them — verbatim, never invented.
    expect(safetyNotesFor('Fennel')).toEqual({
      notes: [HERB_CAUTIONS['fennel']],
      onFile: true,
    });
    expect(safetyNotesFor('Calendula')).toEqual({
      notes: [HERB_CAUTIONS['calendula']],
      onFile: true,
    });
    expect(safetyNotesFor('Cayenne')).toEqual({
      notes: [HERB_CAUTIONS['cayenne']],
      onFile: true,
    });
    // The transcription table still wins where both sources exist.
    expect(safetyNotesFor('Arnica').notes).toEqual(['External use only.']);
  });
});

describe('preparationFor — a documented site-wide gap (2026-11-08)', () => {
  it('returns null for every herb: no per-herb preparation text exists on the site', () => {
    // A 2026-11-08 sweep of the herb library + catalog data found no
    // per-herb preparation guidance anywhere. The resolver and the
    // render hooks exist; the line is omitted until the owner authors
    // the text. This test pins the honest gap — it must start failing
    // (and be updated) the day real entries are added.
    for (const herb of ['Chamomile', 'Calendula', 'Ginger', 'Vitex', 'Turmeric']) {
      expect(preparationFor(herb), herb).toBeNull();
    }
  });
});

describe('enriched sections — dimension + preparation (2026-11-08)', () => {
  const answers: AdvisorAnswers = {
    symptoms: ['beauty'],
    intensity: 'moderate',
    frequency: 'frequent',
    duration: 'weeks',
    sleep: 'restful',
    stressLevel: 'calm',
    digestion: 'smooth',
    emotional: 'steady',
    triggers: [],
    timeOfDay: [],
    sensitivity: 'balanced',
    preferredFormat: 'serum',
  };

  it('carries a Body/Mind/Soul dimension and a null preparation per ally', () => {
    const snapshot = toAdvisorResultSnapshot(
      computeAdvisorSynthesis(answers, NO_QUIZ_SCREENING),
    );
    const sections = enrichAdvisorResult(snapshot, BASE);
    expect(sections).toHaveLength(5);
    for (const section of sections) {
      expect(['body', 'mind', 'soul']).toContain(section.dimension);
      expect(section.preparation).toBeNull();
    }
    const byName = new Map(sections.map((s) => [s.name, s]));
    expect(byName.get('Calendula')!.dimension).toBe('body');
    // Calendula's caution now resolves through the HERB_CAUTIONS tier.
    expect(byName.get('Calendula')!.safety.onFile).toBe(true);
  });
});

describe('whyMatchedClassic — built from the answers given', () => {
  it('names the visitor’s concern goal and chosen form', () => {
    const snapshot = toQuizResultSnapshot(getQuizResult('pain', 'balm')!);
    const arnica = snapshot.allies.find((a) => a.name === 'Arnica')!;
    const line = whyMatchedClassic(arnica, snapshot);
    expect(line).toContain('everyday comfort after activity is a priority');
    expect(line).toContain('you prefer Balm / Salve');
    expect(line).toContain('Arnica');
    // Structure/function framing only — never a treatment claim.
    expect(line).not.toMatch(/\b(treat|treats|cure|cures|prevent|prevents)\b/i);
  });
});

describe('productsForHerb — catalog ingredient matching', () => {
  it('matches products whose records list the herb', () => {
    const arnica = productsForHerb('Arnica');
    expect(arnica.map((p) => p.handle)).toContain('soothe-restore-botanical-balm');
    const chamomile = productsForHerb('Chamomile');
    expect(chamomile.map((p) => p.handle)).toContain('radiance-support-capsules');
  });

  it('omits the block (empty list) when no product lists the herb', () => {
    // Per the 2026-11-07 sweep: no catalog product lists these herbs.
    expect(productsForHerb('Willow bark')).toEqual([]);
    expect(productsForHerb('Chasteberry')).toEqual([]);
    expect(productsForHerb('Blue lotus')).toEqual([]);
  });
});

describe('enrichClassicResult — a real Pain × Balm run', () => {
  const snapshot = toQuizResultSnapshot(getQuizResult('pain', 'balm')!);
  const sections = enrichClassicResult(snapshot, BASE);

  it('enriches every ally the engine returned', () => {
    expect(sections.map((s) => s.name)).toEqual([
      'Turmeric',
      'Arnica',
      'Willow bark',
    ]);
  });

  it('links every ally to its Herb Library page', () => {
    expect(sections.map((s) => s.libraryUrl)).toEqual([
      `${BASE}/herbal-library/turmeric`,
      `${BASE}/herbal-library/arnica`,
      `${BASE}/herbal-library/willow-bark`,
    ]);
  });

  it('gives flagged herbs their notes and unflagged herbs the fallback', () => {
    const byName = new Map(sections.map((s) => [s.name, s]));
    expect(byName.get('Arnica')!.safety.onFile).toBe(true);
    expect(byName.get('Willow bark')!.safety.onFile).toBe(true);
    expect(byName.get('Turmeric')!.safety.onFile).toBe(false);
  });
});

describe('enrichClassicAlly — the St. John’s Wort proof', () => {
  it('renders SJW unlinked with its full safety text (constructed ally)', () => {
    const snapshot = toQuizResultSnapshot(getQuizResult('sleep', 'capsule')!);
    const section = enrichClassicAlly(
      {
        name: "St. John's Wort",
        latin: 'Hypericum perforatum',
        evidence: 'traditional',
        note: 'A storied traditional herb for the nerves and mood.',
      },
      snapshot,
      BASE,
    );
    expect(section.libraryUrl).toBeNull();
    expect(section.safety.onFile).toBe(true);
    expect(section.safety.notes).toHaveLength(4);
    expect(section.products.map((p) => p.handle)).toContain('happy-pill-capsules');
  });
});
