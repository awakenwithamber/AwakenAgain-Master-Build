/**
 * Herbal Index Phase 1 overlay guardrails — Batch 01 (owner-approved
 * 2026-10-23): herb-benefits-supplement.ts + herb-references.ts.
 *
 * Laws under test (plan herbal-index-completion-plan-2026-10-23.md §3.1):
 * - Overlay keys are real catalog record ids; references never exist
 *   without the paired benefit supplement.
 * - Each supplement is exactly two benefits; a supplemented record
 *   carries exactly 5, with benefits 1–3 byte-identical to the
 *   generated shard (the overlay appends, it never rewrites).
 * - Batch census: exactly the 24 Batch 01 records are complete and
 *   referenced; every other record still carries its original 3.
 * - Every supplemented record has at least one reference; entries are
 *   well-formed — kind in the plan enum, label/body non-empty, URL
 *   http(s) when present, and a URL-less entry is always carried as
 *   unverified (never silently upgraded).
 * - Claim-language lint over the NEW benefit text only: no cure /
 *   treatment / prevention claims, no disease names asserted, no
 *   dosage language (benefits 1–3 are the owner's archive text and
 *   are linted by herbs.test.ts, not here).
 */
import { describe, expect, it } from 'vitest';
import { HERBS, getHerb } from './herbs';
import { HERBS_PART_1 } from './herbs-data/part-1';
import { HERBS_PART_2 } from './herbs-data/part-2';
import { HERBS_PART_3 } from './herbs-data/part-3';
import { HERBS_PART_4 } from './herbs-data/part-4';
import { HERB_BENEFITS_SUPPLEMENT } from './herb-benefits-supplement';
import { HERB_REFERENCES } from './herb-references';
import type { HerbReferenceKind } from '../../types';

const RAW_BY_ID = new Map(
  [...HERBS_PART_1, ...HERBS_PART_2, ...HERBS_PART_3, ...HERBS_PART_4].map(
    (h) => [h.id, h] as const,
  ),
);
const SUPPLEMENT_IDS = Object.keys(HERB_BENEFITS_SUPPLEMENT);
const REFERENCE_IDS = Object.keys(HERB_REFERENCES);

const KINDS: readonly HerbReferenceKind[] = [
  'monograph',
  'safety',
  'taxonomy',
  'evidence',
  'traditional',
];

const CLAIM_BLOCKLIST = [
  /\bcures?\b/i,
  /\bcured\b/i,
  /\btreats\b/i,
  /\bprevents\b/i,
  /\bdiagnos\w*\b/i,
  /\bcancer\b/i,
  /\btumou?rs?\b/i,
  /\bdiabetes\b/i,
];
const DOSAGE = [/\b\d+(\.\d+)?\s?(mg|mcg|ml|iu)\b/i, /\btake (one|two|three|\d+)\b/i];

describe('Phase 1 Batch 01 overlay integrity', () => {
  it('targets exactly the 24 Batch 01 records, all real catalog ids', () => {
    expect(SUPPLEMENT_IDS).toHaveLength(24);
    expect(REFERENCE_IDS.sort()).toEqual([...SUPPLEMENT_IDS].sort());
    for (const id of SUPPLEMENT_IDS) {
      expect(RAW_BY_ID.has(id), id).toBe(true);
      expect(getHerb(id), id).toBeDefined();
    }
  });

  it('appends exactly two benefits; benefits 1–3 stay byte-identical to the shard', () => {
    for (const id of SUPPLEMENT_IDS) {
      const pair = HERB_BENEFITS_SUPPLEMENT[id];
      expect(pair, id).toHaveLength(2);
      for (const b of pair) expect(b.trim().length, `${id} benefit`).toBeGreaterThan(0);
      const record = getHerb(id)!;
      const raw = RAW_BY_ID.get(id)!;
      expect(record.traditionalBenefits, id).toHaveLength(5);
      expect(record.traditionalBenefits.slice(0, 3), id).toEqual(
        raw.traditionalBenefits,
      );
      expect(record.traditionalBenefits.slice(3), id).toEqual([...pair]);
    }
  });

  it('batch census: 24 records complete at 5, the other 282 untouched at 3', () => {
    const complete = HERBS.filter((h) => h.traditionalBenefits.length === 5);
    expect(complete.map((h) => h.id).sort()).toEqual([...SUPPLEMENT_IDS].sort());
    for (const h of HERBS) {
      if (!HERB_BENEFITS_SUPPLEMENT[h.id]) {
        expect(h.traditionalBenefits, h.id).toHaveLength(3);
        expect(h.references, h.id).toBeUndefined();
      }
    }
  });

  it('every supplemented record carries well-formed references', () => {
    for (const id of SUPPLEMENT_IDS) {
      const refs = HERB_REFERENCES[id];
      expect(refs.length, id).toBeGreaterThanOrEqual(1);
      expect(getHerb(id)!.references, id).toEqual(refs);
      for (const ref of refs) {
        expect(KINDS, `${id} kind`).toContain(ref.kind);
        expect(ref.label.trim().length, `${id} label`).toBeGreaterThan(0);
        expect(ref.body.trim().length, `${id} body`).toBeGreaterThan(0);
        if (ref.url !== undefined) {
          expect(ref.url, `${id} url`).toMatch(/^https?:\/\//);
        } else {
          // A reference with no verified canonical URL is always
          // carried with its unverified marking — never upgraded.
          expect(ref.unverified, `${id} url-less ref unverified`).toBe(true);
        }
      }
    }
  });

  it('claim-language lint over the new benefit text (plan §3.1 blocklist)', () => {
    const offenders: string[] = [];
    for (const id of SUPPLEMENT_IDS) {
      for (const b of HERB_BENEFITS_SUPPLEMENT[id]) {
        for (const p of [...CLAIM_BLOCKLIST, ...DOSAGE]) {
          if (p.test(b)) offenders.push(`${id}: ${p} in "${b}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('california-poppy Benefit 5 carries its external/wash-use label', () => {
    expect(HERB_BENEFITS_SUPPLEMENT['california-poppy'][1]).toContain(
      '(traditional external/wash use)',
    );
  });
});
