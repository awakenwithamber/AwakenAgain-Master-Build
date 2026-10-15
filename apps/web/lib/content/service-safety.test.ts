/**
 * Service-page safety copy cleanup — tests (2026-10-14).
 *
 * Guards the render-layer fix for the /services/<slug> Safety section:
 * catalog records repeat their disclaimers (warnings list + a combined
 * disclaimer string restating them) and carry internal provenance tags
 * ("(Sourced from services.csv.)"). The cleanup must dedupe without
 * ever dropping a genuinely distinct warning, and must strip the
 * attribution tags customers should never see.
 */
import { describe, expect, it } from 'vitest';
import {
  dedupeSafetyCopy,
  serviceSafetyCopy,
  stripSourceAttribution,
} from './service-safety';
import { getProductByHandle } from '../catalog/products';

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('stripSourceAttribution', () => {
  it('strips "(Sourced from …)" tails', () => {
    expect(
      stripSourceAttribution(
        'Outcomes are not guaranteed. (Sourced from services.csv.)',
      ),
    ).toBe('Outcomes are not guaranteed.');
  });

  it('strips "(Sourced.)" tails', () => {
    expect(
      stripSourceAttribution(
        'Not medical advice. Seek qualified professional care. (Sourced.)',
      ),
    ).toBe('Not medical advice. Seek qualified professional care.');
  });

  it('strips "(Combined sourced disclaimers.)" tails', () => {
    expect(
      stripSourceAttribution(
        'For educational purposes only. (Combined sourced disclaimers.)',
      ),
    ).toBe('For educational purposes only.');
  });

  it('strips repeated trailing tags', () => {
    expect(
      stripSourceAttribution('Some warning. (Sourced.) (Sourced from x.)'),
    ).toBe('Some warning.');
  });

  it('leaves untagged text and real parentheticals untouched', () => {
    expect(stripSourceAttribution('Individual experiences vary.')).toBe(
      'Individual experiences vary.',
    );
    expect(
      stripSourceAttribution('Use as directed (see the label) daily.'),
    ).toBe('Use as directed (see the label) daily.');
  });
});

describe('dedupeSafetyCopy', () => {
  it('drops exact duplicates after whitespace/case normalization', () => {
    expect(
      dedupeSafetyCopy([
        'Individual experiences vary.',
        'individual   experiences vary.',
        'INDIVIDUAL EXPERIENCES VARY.',
      ]),
    ).toEqual(['Individual experiences vary.']);
  });

  it('keeps the longer string when one fully contains another', () => {
    const combined =
      'For educational purposes only. Not medical advice. Individual experiences vary.';
    // Contained string first, container later.
    expect(
      dedupeSafetyCopy(['Not medical advice.', combined, 'A distinct note.']),
    ).toEqual([combined, 'A distinct note.']);
    // Container first, contained string later.
    expect(dedupeSafetyCopy([combined, 'Not medical advice.'])).toEqual([
      combined,
    ]);
  });

  it('dedupes strings that differ only by their attribution tag', () => {
    expect(
      dedupeSafetyCopy([
        'Outcomes are not guaranteed. (Sourced from services.csv.)',
        'Outcomes are not guaranteed.',
      ]),
    ).toEqual(['Outcomes are not guaranteed.']);
  });

  it('preserves genuinely distinct warnings, in order', () => {
    const items = [
      'Not medical advice.',
      'Outcomes are not guaranteed.',
      'Individual experiences vary.',
    ];
    expect(dedupeSafetyCopy(items)).toEqual(items);
  });

  it('skips null, undefined, and empty-after-cleaning entries', () => {
    expect(
      dedupeSafetyCopy([null, undefined, '   ', 'Real warning.']),
    ).toEqual(['Real warning.']);
  });
});

describe('serviceSafetyCopy against the real catalog records', () => {
  it('tarot-readings: each disclaimer sentence renders exactly once, tags gone', () => {
    const copy = serviceSafetyCopy(getProductByHandle('tarot-readings'));
    const joined = copy.join('\n');
    // The combined disclaimer absorbs the two warnings it restates;
    // the three distinct warnings survive alongside it.
    expect(copy).toEqual([
      'Spiritual/reflective service; outcomes are not guaranteed.',
      'No predictive powers are claimed; readings are framed as reflective and symbolic.',
      'Individual experiences vary.',
      'For educational, spiritual, or informational purposes only. Not medical advice and not intended to diagnose, treat, cure, or prevent any disease. Seek qualified professional care for medical concerns. For spiritual, reflective, and entertainment purposes; not professional medical, legal, or financial advice.',
    ]);
    expect(occurrences(joined, 'not intended to diagnose')).toBe(1);
    expect(
      occurrences(
        joined,
        'For spiritual, reflective, and entertainment purposes',
      ),
    ).toBe(1);
    expect(occurrences(joined, 'Individual experiences vary.')).toBe(1);
    expect(joined).not.toContain('Sourced');
    expect(joined).not.toContain('services.csv');
  });

  it('every mapped service record yields clean, duplicate-free copy', () => {
    for (const handle of [
      'tarot-readings',
      'home-aura-space-cleansing',
      'past-life-inspired-guided-exploration',
      'energy-work',
    ]) {
      const copy = serviceSafetyCopy(getProductByHandle(handle));
      expect(copy.length, handle).toBeGreaterThan(0);
      expect(new Set(copy).size, handle).toBe(copy.length);
      for (const item of copy) {
        expect(item, handle).not.toContain('Sourced');
        expect(item, handle).not.toContain('(Combined');
      }
    }
  });

  it('energy-work: string warnings and disclaimer are both distinct, both kept', () => {
    const copy = serviceSafetyCopy(getProductByHandle('energy-work'));
    expect(copy).toHaveLength(2);
    expect(copy[0]).toContain('Not a substitute for medical care.');
    expect(copy[1]).toContain('not intended to diagnose');
  });

  it('returns [] for a missing record', () => {
    expect(serviceSafetyCopy(undefined)).toEqual([]);
    expect(serviceSafetyCopy(null)).toEqual([]);
  });
});
