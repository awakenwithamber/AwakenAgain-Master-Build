/**
 * ScentStep seasonal card — the feature image derives from the registry.
 *
 * Pin style: source-shape + data derivation, the pattern this repo
 * uses for JSX components (cf. components/shop/SeasonalBanner.test.tsx).
 * The vitest transform cannot import a JSX component (tsconfig jsx:
 * preserve), so the derivation is pinned in two halves that compose:
 * (1) the card resolves the seasonal entry's image slot through the
 * image manifest and renders the registry entry's path/depicts — never
 * a hard-coded path; (2) November's served entry carries the slot and
 * it resolves to a real OWNER_UPLOADED asset. The rendered-output proof
 * on the real serving path is the production-build capture in the
 * release record (~/workspace/november-pecan-pie-stage-2026-11-09/).
 *
 * Law under test (owner photo + standing rule, 2026-11-09): the
 * November feature card shows the owner's own photograph of the
 * actual bar; entries without a registered real image keep the
 * text-only card.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getSeasonalFeature } from '../../lib/catalog/seasonal';
import { getAsset } from '../../lib/media/image-manifest';

const here = dirname(fileURLToPath(import.meta.url));
const scentStepSource = readFileSync(join(here, 'ScentStep.tsx'), 'utf8');
const cssSource = readFileSync(join(here, 'SoapBuilderModal.module.css'), 'utf8');

describe('ScentStep seasonal card — feature image from the registry', () => {
  it('resolves the seasonal entry\u2019s image slot through the manifest and renders the registry entry', () => {
    expect(scentStepSource).toContain('getAsset(seasonal.image_slot_id)');
    expect(scentStepSource).toContain('src={showSeasonalImage.path}');
    expect(scentStepSource).toContain('alt={showSeasonalImage.depicts}');
    expect(scentStepSource).toContain('className={styles.seasonalImage}');
    // No image path is hard-coded into the component.
    expect(scentStepSource).not.toContain('/images/seasonal/');
    // The card's image style exists in the CSS module.
    expect(cssSource).toContain('.seasonalImage');
  });

  it("November's served entry carries the slot and it resolves to a real asset", () => {
    const november = getSeasonalFeature(11, 2026)!;
    expect(november.image_slot_id).toBe('slot_seasonal_pecan_pie_nov_2026');
    const asset = getAsset(november.image_slot_id!);
    expect(asset).toBeDefined();
    expect(asset!.provenance).toBe('REAL_PRODUCT_PHOTO');
    expect(asset!.path).toBe('/images/seasonal/pecan-pie-nov-2026.webp');
  });
});
