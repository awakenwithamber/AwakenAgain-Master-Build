/**
 * Formula builder logic tests — lib/custom-formula/formula.ts.
 *
 * Laws under test:
 * - Herb toggle: hard max of 12, no duplicates, unknown ids rejected,
 *   form usability enforced from data (Herb.uses).
 * - Search/filter: pure and data-driven.
 * - Step gating: reveal unreachable until size + herbs + safety ack.
 * - Order record: exact herb IDs, text length caps.
 */
import { describe, expect, it } from 'vitest';
import { getHerb } from '../catalog/herbs';
import {
  MAX_FORMULA_HERBS,
  availableHerbs,
  canReachFormulaStep,
  defaultFormulaSelections,
  filterFormulaHerbs,
  formulaCustomizationOf,
  formulaMakerNotes,
  formulaStepComplete,
  herbCategories,
  toggleFormulaHerb,
  type FormulaSelections,
} from './formula';

describe('toggleFormulaHerb', () => {
  it('adds and removes a herb', () => {
    let ids: string[] = [];
    ids = toggleFormulaHerb(ids, 'andrographis', 'capsule');
    expect(ids).toEqual(['andrographis']);
    ids = toggleFormulaHerb(ids, 'andrographis', 'capsule');
    expect(ids).toEqual([]);
  });

  it('hard max of 12 herbs — the 13th toggle is ignored', () => {
    expect(MAX_FORMULA_HERBS).toBe(12);
    const capsuleHerbs = availableHerbs('capsule').slice(0, 13).map((h) => h.id);
    let ids: string[] = [];
    for (const id of capsuleHerbs) ids = toggleFormulaHerb(ids, id, 'capsule');
    expect(ids.length).toBe(12);
  });

  it('no duplicates possible — toggling a selected herb removes it', () => {
    const ids = toggleFormulaHerb(['andrographis'], 'andrographis', 'capsule');
    expect(ids).toEqual([]);
    // Round-trip: add → remove → add never duplicates.
    const readded = toggleFormulaHerb(ids, 'andrographis', 'capsule');
    expect(readded).toEqual(['andrographis']);
  });

  it('unknown herb ids never enter a formula', () => {
    expect(toggleFormulaHerb([], 'not-a-herb', 'capsule')).toEqual([]);
  });

  it('form usability enforced from data: lavender is not capsule-usable', () => {
    expect(getHerb('lavender')?.uses).not.toContain('capsule');
    expect(toggleFormulaHerb([], 'lavender', 'capsule')).toEqual([]);
    expect(toggleFormulaHerb([], 'lavender', 'tea')).toEqual(['lavender']);
  });

  it('form usability enforced from data: andrographis is capsule-only', () => {
    expect(getHerb('andrographis')?.uses).toEqual(['capsule']);
    expect(toggleFormulaHerb([], 'andrographis', 'tea')).toEqual([]);
    expect(toggleFormulaHerb([], 'andrographis', 'capsule')).toEqual(['andrographis']);
  });

  it('form usability enforced from data: spearmint is tea-only', () => {
    expect(toggleFormulaHerb([], 'spearmint', 'capsule')).toEqual([]);
    expect(toggleFormulaHerb([], 'spearmint', 'tea')).toEqual(['spearmint']);
  });
});

describe('filterFormulaHerbs + herbCategories', () => {
  it('empty query returns the full list', () => {
    const herbs = availableHerbs('capsule');
    expect(filterFormulaHerbs(herbs, '', '')).toHaveLength(herbs.length);
  });

  it('query matches name, latin, and notes', () => {
    const herbs = availableHerbs('capsule');
    const byName = filterFormulaHerbs(herbs, 'ashwagandha', '');
    expect(byName.map((h) => h.id)).toContain('ashwagandha');
    const byLatin = filterFormulaHerbs(herbs, 'withania', '');
    expect(byLatin.map((h) => h.id)).toContain('ashwagandha');
  });

  it('category filter narrows the list', () => {
    const herbs = availableHerbs('tea');
    const sleep = filterFormulaHerbs(herbs, '', 'sleep');
    expect(sleep.length).toBeGreaterThan(0);
    expect(sleep.length).toBeLessThan(herbs.length);
    expect(sleep.every((h) => h.categories.includes('sleep'))).toBe(true);
  });

  it('query + category combine', () => {
    const herbs = availableHerbs('tea');
    const result = filterFormulaHerbs(herbs, 'zzz-no-match', 'sleep');
    expect(result).toHaveLength(0);
  });

  it('herbCategories returns distinct categories in encounter order', () => {
    const cats = herbCategories(availableHerbs('capsule'));
    expect(new Set(cats).size).toBe(cats.length);
    expect(cats).toContain('immune');
  });
});

describe('step gating', () => {
  function completeSelections(): FormulaSelections {
    return {
      ...defaultFormulaSelections(),
      sizeId: 'capsule-28',
      herbIds: ['andrographis', 'garlic'],
      safetyAck: true,
    };
  }

  it('reveal is unreachable with no selections', () => {
    const sel = defaultFormulaSelections();
    expect(canReachFormulaStep('reveal', sel, 'capsule')).toBe(false);
  });

  it('each step gates on its own requirement', () => {
    const sel = defaultFormulaSelections();
    expect(formulaStepComplete('size', sel, 'capsule')).toBe(false);
    expect(formulaStepComplete('herbs', sel, 'capsule')).toBe(false);
    expect(formulaStepComplete('safety', sel, 'capsule')).toBe(false);

    const sized = { ...sel, sizeId: 'capsule-28' };
    expect(formulaStepComplete('size', sized, 'capsule')).toBe(true);
    expect(canReachFormulaStep('herbs', sized, 'capsule')).toBe(true);
    expect(canReachFormulaStep('reveal', sized, 'capsule')).toBe(false);
  });

  it('an unknown size id does not complete the size step', () => {
    const sel = { ...defaultFormulaSelections(), sizeId: 'nope' };
    expect(formulaStepComplete('size', sel, 'capsule')).toBe(false);
  });

  it('a tea size id does not complete the capsule size step', () => {
    const sel = { ...defaultFormulaSelections(), sizeId: 'tea-loose-1oz' };
    expect(formulaStepComplete('size', sel, 'capsule')).toBe(false);
    expect(formulaStepComplete('size', sel, 'tea')).toBe(true);
  });

  it('herbs step needs 1–12 form-usable herbs', () => {
    const sel = { ...defaultFormulaSelections(), herbIds: [] };
    expect(formulaStepComplete('herbs', sel, 'capsule')).toBe(false);
    const badForm = { ...defaultFormulaSelections(), herbIds: ['lavender'] };
    expect(formulaStepComplete('herbs', badForm, 'capsule')).toBe(false);
    expect(formulaStepComplete('herbs', badForm, 'tea')).toBe(true);
  });

  it('safety step needs the acknowledgment checkbox', () => {
    const sel = completeSelections();
    expect(formulaStepComplete('safety', { ...sel, safetyAck: false }, 'capsule')).toBe(false);
    expect(canReachFormulaStep('reveal', sel, 'capsule')).toBe(true);
  });

  it('cannot skip ahead: reveal unreachable while any earlier step is incomplete', () => {
    const sel = completeSelections();
    expect(canReachFormulaStep('reveal', { ...sel, sizeId: null }, 'capsule')).toBe(false);
    expect(canReachFormulaStep('reveal', { ...sel, herbIds: [] }, 'capsule')).toBe(false);
    expect(canReachFormulaStep('reveal', { ...sel, safetyAck: false }, 'capsule')).toBe(false);
  });
});

describe('formulaCustomizationOf — the order record', () => {
  it('returns null until size + herbs are complete', () => {
    const sel = defaultFormulaSelections();
    expect(formulaCustomizationOf(sel, 'capsule')).toBeNull();
    const sized = { ...sel, sizeId: 'capsule-28' };
    expect(formulaCustomizationOf(sized, 'capsule')).toBeNull();
  });

  it('persists exact herb IDs and the size id — never prose', () => {
    const sel: FormulaSelections = {
      ...defaultFormulaSelections(),
      sizeId: 'tea-loose-1oz',
      herbIds: ['lavender', 'chamomile'],
    };
    expect(formulaCustomizationOf(sel, 'tea')).toEqual({
      herb_ids: ['lavender', 'chamomile'],
      size_id: 'tea-loose-1oz',
    });
  });

  it('trims free text and omits empty fields', () => {
    const sel: FormulaSelections = {
      ...defaultFormulaSelections(),
      sizeId: 'capsule-60',
      herbIds: ['andrographis'],
      creationName: '  Morning Clarity  ',
      intention: '',
      notes: '   ',
    };
    const f = formulaCustomizationOf(sel, 'capsule');
    expect(f?.creation_name).toBe('Morning Clarity');
    expect(f).not.toHaveProperty('intention');
    expect(f).not.toHaveProperty('notes');
  });

  it('caps free-text lengths (server rejects longer)', () => {
    const sel: FormulaSelections = {
      ...defaultFormulaSelections(),
      sizeId: 'capsule-60',
      herbIds: ['andrographis'],
      creationName: 'x'.repeat(81),
    };
    const f = formulaCustomizationOf(sel, 'capsule');
    // Client truncates for display; the server validator rejects over-length.
    expect(f?.creation_name?.length).toBeLessThanOrEqual(80);
  });
});

describe('formulaMakerNotes', () => {
  it('summarizes form, size, and exact botanical names for the maker', () => {
    const notes = formulaMakerNotes(
      'tea',
      'tea-bags-20',
      ['lavender', 'chamomile'],
      'Evening Unwind',
      'wind down',
      'extra chamomile please',
    );
    expect(notes).toMatch(/Custom Tea Blend/);
    expect(notes).toMatch(/Tea Bags/);
    expect(notes).toMatch(/Lavender, Chamomile/);
    expect(notes).toMatch(/Evening Unwind/);
    expect(notes).toMatch(/wind down/);
    expect(notes).toMatch(/extra chamomile please/);
    expect(notes).toMatch(/safety notice/);
  });

  it('unknown herb ids fall back to the id (never crashes)', () => {
    const notes = formulaMakerNotes('capsule', 'capsule-28', ['nope'], '', '', '');
    expect(notes).toMatch(/nope/);
  });
});
