/**
 * Herbal Index view-model tests (owner directive 2026-10-21).
 *
 * The honesty contract under test: card content is derived ONLY from
 * the catalog record — properties verbatim and capped at 5, note
 * verbatim, incomplete records flagged, nothing invented — and the
 * route/manifest counts reconcile exactly with the source data.
 */
import { describe, expect, it } from 'vitest';
import { HERBS, getHerb } from '../catalog/herbs';
import { HERB_INDEX } from '../content/herbs';
import { HERB_ILLUSTRATIONS } from '../../components/grimoire/grimoireContent';
import {
  CARD_PROPERTY_TARGET,
  HERBAL_CARDS,
  TARGET_CARD_COUNT,
  cardForHerb,
  classifyHerbalKind,
  getHerbalCard,
  herbalIndexManifest,
  herbalRouteParams,
} from './cards';

describe('derivation rules', () => {
  it('produces exactly one card per catalog record', () => {
    expect(HERBAL_CARDS).toHaveLength(HERBS.length);
    expect(HERBAL_CARDS.map((c) => c.slug)).toEqual(HERBS.map((h) => h.id));
  });

  it('caps properties at 5 and sources every entry verbatim from the record', () => {
    for (const card of HERBAL_CARDS) {
      const record = getHerb(card.slug);
      expect(record).toBeDefined();
      expect(card.properties.length).toBeLessThanOrEqual(CARD_PROPERTY_TARGET);
      expect([...card.properties]).toEqual(
        record!.traditionalBenefits.slice(0, CARD_PROPERTY_TARGET),
      );
      for (const p of card.properties) {
        expect(record!.traditionalBenefits).toContain(p);
      }
    }
  });

  it('never invents a property that exists in no record', () => {
    const allBenefits = new Set(HERBS.flatMap((h) => h.traditionalBenefits));
    for (const card of HERBAL_CARDS) {
      for (const p of card.properties) expect(allBenefits.has(p)).toBe(true);
    }
  });

  it('carries the note verbatim', () => {
    for (const card of HERBAL_CARDS) {
      expect(card.note).toBe(getHerb(card.slug)!.traditionalNote);
    }
  });

  it('flags records with fewer than 5 benefits as incomplete, and only those', () => {
    for (const card of HERBAL_CARDS) {
      const record = getHerb(card.slug)!;
      expect(card.benefitsListed).toBe(record.traditionalBenefits.length);
      expect(card.benefitsIncomplete).toBe(
        record.traditionalBenefits.length < CARD_PROPERTY_TARGET,
      );
    }
  });

  it('caution slot mirrors the record exactly: populated only where the record carries one (Stage 4)', () => {
    for (const card of HERBAL_CARDS) {
      const record = getHerb(card.slug)!;
      expect(card.caution).toBe(record.caution ?? null);
    }
    // Sourced populations exist (Stage 4) — and only for HERB_INDEX herbs.
    const populated = HERBAL_CARDS.filter((c) => c.caution !== null);
    expect(populated.length).toBeGreaterThan(0);
    expect(populated.length).toBeLessThan(HERBAL_CARDS.length);
  });

  it('references slot mirrors the record exactly: populated only where the record carries them (Phase 1)', () => {
    for (const card of HERBAL_CARDS) {
      const record = getHerb(card.slug)!;
      expect(card.references).toEqual(record.references ?? null);
    }
    const populated = HERBAL_CARDS.filter((c) => c.references !== null);
    expect(populated).toHaveLength(24); // Phase 1 Batch 01, owner-approved 2026-10-23
  });

  it('derives identity fields from the record', () => {
    const lavender = getHerbalCard('lavender')!;
    const record = getHerb('lavender')!;
    expect(lavender.name).toBe(record.name);
    expect(lavender.latin).toBe(record.latin);
    expect(lavender.detailHref).toBe('/herbal-library/lavender');
    expect(lavender.monogram).toBe('L');
  });
});

describe('kind classification', () => {
  const kindOf = (id: string) => classifyHerbalKind(getHerb(id)!);
  it('classifies representative records', () => {
    expect(kindOf('lavender')).toBe('botanical');
    expect(kindOf('reishi')).toBe('mushroom');
    expect(kindOf('frankincense')).toBe('resin');
    expect(kindOf('jojoba')).toBe('oil');
    expect(kindOf('vitamin-d3')).toBe('vitamin-mineral');
    expect(kindOf('propolis')).toBe('animal-derived');
    expect(kindOf('probiotics')).toBe('microbial-blend');
    expect(kindOf('quercetin')).toBe('isolated-compound');
  });
});

describe('29-vs-catalog reconciliation', () => {
  it('resolves every HERB_INDEX slug to a card (aliases included)', () => {
    for (const entry of HERB_INDEX) {
      expect(getHerbalCard(entry.slug), entry.slug).toBeDefined();
    }
  });

  it('resolves the four alias slugs to their catalog records', () => {
    expect(getHerbalCard('valerian-root')!.slug).toBe('valerian');
    expect(getHerbalCard('willow-bark')!.slug).toBe('white-willow');
    expect(getHerbalCard('chasteberry')!.slug).toBe('vitex');
    expect(getHerbalCard('red-raspberry-leaf')!.slug).toBe('red-raspberry');
  });

  it('returns undefined for unknown slugs', () => {
    expect(getHerbalCard('not-a-real-herb')).toBeUndefined();
  });

  it('route params cover all records plus the original 29, uniquely', () => {
    const params = herbalRouteParams().map((p) => p.herb);
    expect(new Set(params).size).toBe(params.length);
    for (const h of HERBS) expect(params).toContain(h.id);
    for (const entry of HERB_INDEX) expect(params).toContain(entry.slug);
    expect(params).toHaveLength(HERBS.length + 4); // 309 records + 4 alias slugs
  });
});

/**
 * Slugs whose botanical-map entry was DELIBERATELY removed in the
 * 2026-10-29 correction pass (Track B audit): 19 compound / blend /
 * non-plant records, for which a whole-plant photo would misidentify
 * the entry, plus coptis (no verified image of Coptis chinensis
 * exists). These cards carry no reference and render the monogram.
 */
const REMOVED_ILLUSTRATION_SLUGS = new Set([
  'apigenin',
  'luteolin',
  'astaxanthin',
  'menthol',
  'trikatu',
  'alpha-lipoic',
  'berberine',
  'coq10',
  'n-acetyl-cysteine',
  'vitamin-d3',
  'vitamin-k2',
  'b12-methylcobalamin',
  'folate',
  'zinc-bisglycinate',
  'probiotics',
  'triphala',
  'propolis',
  'pearl-powder',
  'deer-antler',
  'coptis',
]);

/**
 * Owner-approved herb-library additions 2026-10-30 (house-blend recipe
 * adoption): orange peel, lemongrass, and star anise entered the catalog
 * after the illustration map was generated, so no mapped reference exists
 * for them yet. Like the audited removals above, these cards carry no
 * reference and render the monogram; unlike the removals, artwork is
 * simply owed — they are counted in the manifest's needingArtwork total
 * until illustrations land. No URL is invented for them here.
 */
const ARTWORK_PENDING_SLUGS = new Set([
  'orange-peel',
  'lemongrass',
  'star-anise',
]);

describe('illustrations', () => {
  it('carries a mapped reference except the audited removals, and never renders a dead CDN hotlink', () => {
    for (const card of HERBAL_CARDS) {
      if (card.illustrationUrl === null) {
        expect(
          REMOVED_ILLUSTRATION_SLUGS.has(card.slug) ||
            ARTWORK_PENDING_SLUGS.has(card.slug),
          `unexpected missing illustration: ${card.slug}`,
        ).toBe(true);
        expect(card.illustrationRenderable).toBe(false);
        continue;
      }
      if (
        card.illustrationUrl.includes('manuscdn.com') ||
        card.illustrationUrl.includes('cloudfront.net')
      ) {
        expect(card.illustrationRenderable).toBe(false);
      }
    }
  });

  it('renders the Commons-corrected illustrations (2026-10-29 pass)', () => {
    // 17 map entries were corrected, but 'willow-bark' is a HERB_INDEX
    // alias of the 'white-willow' record (same Salix alba image), so
    // 16 distinct cards become renderable.
    const renderable = HERBAL_CARDS.filter((c) => c.illustrationRenderable);
    expect(renderable).toHaveLength(16);
    for (const card of renderable) {
      expect(card.illustrationUrl).toContain('wikimedia.org');
    }
  });

  it('counts the Grimoire illustration map coverage', () => {
    const covered = HERBAL_CARDS.filter((c) => HERB_ILLUSTRATIONS[c.slug]);
    expect(covered).toHaveLength(Object.keys(HERB_ILLUSTRATIONS).length);
  });

  it('marks a local illustration reference renderable (future local assets)', () => {
    const record = getHerb('lavender')!;
    const card = cardForHerb(record);
    expect(card.illustrationRenderable).toBe(false); // today's CDN reference
  });
});

describe('manifest integrity', () => {
  it('reconciles with counts computed independently from the source data', () => {
    const manifest = herbalIndexManifest();
    expect(manifest.targetCards).toBe(TARGET_CARD_COUNT);
    expect(manifest.totalRecords).toBe(HERBS.length);
    const kindSum = Object.values(manifest.byKind).reduce((a, b) => a + b, 0);
    expect(kindSum).toBe(HERBS.length);
    expect(manifest.herbRecords + manifest.nonHerbRecords).toBe(HERBS.length);
    expect(
      manifest.fullBenefits + manifest.partialBenefits + manifest.noBenefits,
    ).toBe(HERBS.length);
    expect(manifest.fullBenefits).toBe(
      HERBS.filter((h) => h.traditionalBenefits.length >= 5).length,
    );
    expect(manifest.partialBenefits).toBe(
      HERBS.filter(
        (h) => h.traditionalBenefits.length > 0 && h.traditionalBenefits.length < 5,
      ).length,
    );
    expect(manifest.noBenefits).toBe(
      HERBS.filter((h) => h.traditionalBenefits.length === 0).length,
    );
    expect(manifest.shortfallToTarget).toBe(
      TARGET_CARD_COUNT - manifest.herbRecords,
    );
    expect(manifest.needingArtwork).toBe(
      manifest.totalRecords - manifest.renderableIllustrations,
    );
  });

  it('states the current headline numbers honestly', () => {
    const manifest = herbalIndexManifest();
    expect(manifest.totalRecords).toBe(309);
    expect(manifest.herbRecords).toBe(290);
    expect(manifest.nonHerbRecords).toBe(19);
    expect(manifest.fullBenefits).toBe(24); // Phase 1 Batch 01 (owner-approved 2026-10-23)
    expect(manifest.partialBenefits).toBe(285);
    expect(manifest.noBenefits).toBe(0);
    expect(manifest.shortfallToTarget).toBe(43);
    // 2026-10-29 correction pass: 20 map entries deliberately removed
    // (compounds/blends + coptis — see REMOVED_ILLUSTRATION_SLUGS) and
    // 17 wrong-species map entries replaced with verified Wikimedia
    // Commons illustrations (16 distinct renderable cards: willow-bark
    // is an alias of white-willow and shares its corrected image).
    expect(manifest.withIllustrationEntry).toBe(286);
    expect(manifest.withGrimoireIllustration).toBe(12);
    expect(manifest.renderableIllustrations).toBe(16);
    expect(manifest.needingArtwork).toBe(293);
  });
});
