/**
 * REGRESSION SUITE — §19: soap-builder ritual (React conversion).
 *
 * Business laws under test:
 * - Ritual state machine: the reveal step is unreachable until every prior
 *   step is complete (step gating).
 * - Custom blends: hard max of 3 oils, enforced from data; exact oil IDs in
 *   the order record — never the string "custom scent".
 * - Natural/Clear is only offered on translucent bases (data-driven rule).
 * - Preview-shape invariance: the canvas is ALWAYS the Large Wave Rectangle;
 *   the cart records the actual selected mold separately.
 * - Bundle math derives from lib/pricing — components never hard-code
 *   $35.77 / $12.08 / $47.85 (source-grep guard).
 * - No superseded payment paths (Stripe/Shopify/PayPal/Square) anywhere.
 * - Analytics: only canonical 19-event contract names are emitted.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildCartItem,
  buildOrderConfiguration,
  customColorHex,
  validateBundleSlot,
  validateCustomization,
} from '../../lib/cart/validation';
import {
  BLENDABLE_OILS,
  MAX_BLEND_OILS,
  blendProfileTags,
} from '../../lib/catalog/oils';
import { getScentRecipe } from '../../lib/catalog/scents';
import {
  BUNDLE_SLOT_SHAPES,
  bundleComponentSumCents,
  bundleSavingsCents,
  bundleSavingsPct,
  formatPrice,
} from '../../lib/pricing/pricing';
import {
  ANALYTICS_EVENT_NAMES,
  type AnalyticsEventName,
} from '../../lib/analytics/events';
import { isPostHogLive, track } from '../../lib/analytics/posthog';
import type { ClientEventName } from '../../lib/analytics/posthog';
import type { Customization } from '../../types';
import {
  PREVIEW_CANVAS_SHAPE_ID,
  seededSpeckles,
  wavePath,
} from '../../components/builder/preview';
import {
  applyThemeToAll,
  blendReadout,
  canReachStep,
  colorAllowedForBase,
  colorLabel,
  defaultSelections,
  encodeCustomColor,
  isCustomColorId,
  scentSelectionOf,
  slotsFromTheme,
  stepComplete,
  themeFromSelections,
  toggleBlendOil,
  updateSlot,
  type BuilderSelections,
  type SlotTheme,
} from '../../components/builder/state';

const BUILDER_FILES = [
  '../../components/builder/preview.ts',
  '../../components/builder/state.ts',
  '../../components/builder/WavePreview.tsx',
  '../../components/builder/ScentStep.tsx',
  '../../components/builder/SoapBuilder.tsx',
  '../../components/builder/BundleConfigurator.tsx',
];

function readBuilderFile(f: string): string {
  return readFileSync(new URL(f, import.meta.url), 'utf8');
}

function completeSelections(): BuilderSelections {
  return {
    ...defaultSelections(),
    base: 'double-layer',
    shape: 'wave-rectangle',
    scentPath: 'signature',
    signatureId: 'SCENT_RECIPE_01',
    botanical: 'mint',
    color: 'emerald',
  };
}

function sampleTheme(): SlotTheme {
  return {
    base: 'double-layer',
    scent: { type: 'custom_blend', oils: ['lavender', 'frankincense'] },
    botanical: 'mint',
    color: 'emerald',
  };
}

/* ---------------- ritual state machine ---------------- */

describe('ritual step gating', () => {
  it('reveal is unreachable with no selections', () => {
    const sel = defaultSelections();
    expect(canReachStep('reveal', sel, 'single')).toBe(false);
    expect(canReachStep('reveal', sel, 'bundle')).toBe(false);
  });

  it('each step gates on its own requirement', () => {
    const sel = defaultSelections();
    expect(stepComplete('base', sel)).toBe(false);
    expect(stepComplete('shape', sel)).toBe(false);
    expect(stepComplete('scent', sel)).toBe(false);
    expect(stepComplete('botanical', sel)).toBe(false);
    expect(stepComplete('color', sel)).toBe(false);

    const full = completeSelections();
    for (const step of ['base', 'shape', 'scent', 'botanical', 'color'] as const) {
      expect(stepComplete(step, full)).toBe(true);
    }
    expect(canReachStep('reveal', full, 'single')).toBe(true);
  });

  it('cannot skip ahead: reveal unreachable while any earlier step is incomplete', () => {
    const full = completeSelections();
    const withoutColor = { ...full, color: null };
    expect(canReachStep('reveal', withoutColor, 'single')).toBe(false);
    expect(canReachStep('color', withoutColor, 'single')).toBe(true);
    const withoutScent = { ...full, signatureId: null };
    expect(canReachStep('botanical', withoutScent, 'single')).toBe(false);
  });

  it('bundle mode needs no shape — single mode does', () => {
    const sel: BuilderSelections = {
      ...defaultSelections(),
      base: 'glycerin-castor',
      scentPath: 'blend',
      blendOils: ['lavender'],
      botanical: 'mint',
      color: 'natural-clear',
    };
    expect(canReachStep('reveal', sel, 'bundle')).toBe(true);
    expect(canReachStep('reveal', sel, 'single')).toBe(false);
    expect(canReachStep('shape', sel, 'bundle')).toBe(false); // shape is not a bundle step
  });

  it('blend path needs at least 1 oil; signature path needs a valid recipe', () => {
    const blendEmpty: BuilderSelections = {
      ...completeSelections(),
      scentPath: 'blend',
      signatureId: null,
      blendOils: [],
    };
    expect(stepComplete('scent', blendEmpty)).toBe(false);
    const blendOne = { ...blendEmpty, blendOils: ['lavender'] };
    expect(stepComplete('scent', blendOne)).toBe(true);
    const badRecipe = { ...blendEmpty, scentPath: 'signature' as const, signatureId: 'NOPE' };
    expect(stepComplete('scent', badRecipe)).toBe(false);
  });
});

/* ---------------- oil limit + blend data contract ---------------- */

describe('custom blend rules (enforced from data)', () => {
  it('hard max of 3 oils — the 4th toggle is ignored', () => {
    let oils: string[] = [];
    for (const id of ['lavender', 'lemon', 'peppermint']) {
      oils = toggleBlendOil(oils, id);
    }
    expect(oils).toHaveLength(3);
    expect(toggleBlendOil(oils, 'rose')).toHaveLength(3);
    expect(toggleBlendOil(oils, 'rose')).not.toContain('rose');
  });

  it('toggling a selected oil removes it; no duplicates possible', () => {
    const oils = toggleBlendOil(['lavender', 'lemon'], 'lavender');
    expect(oils).toEqual(['lemon']);
    expect(toggleBlendOil(['lavender'], 'lavender')).toEqual([]);
  });

  it('unknown oil ids never enter a blend', () => {
    expect(toggleBlendOil([], 'oregano')).toEqual([]);
    expect(toggleBlendOil(['lavender'], 'not-an-oil')).toEqual(['lavender']);
  });

  it('exactly 12 blendable oils — oregano, digestzen and finished blends excluded', () => {
    expect(MAX_BLEND_OILS).toBe(3);
    expect(BLENDABLE_OILS).toHaveLength(12);
    const ids = BLENDABLE_OILS.map((o) => o.id);
    for (const excluded of ['oregano', 'digestzen', 'breathe', 'on-guard', 'deep-blue']) {
      expect(ids).not.toContain(excluded);
    }
  });

  it('blend readout: names + deduplicated profile tags, max 4', () => {
    const { names, tags } = blendReadout(['lavender', 'frankincense']);
    expect(names).toEqual(['Lavender', 'Frankincense']);
    // Lavender: Floral, Herbal, Calming · Frankincense: Resinous, Warm, Musky
    expect(tags).toEqual(['Floral', 'Herbal', 'Calming', 'Resinous']);
    expect(blendProfileTags(['lemon', 'peppermint']).length).toBeLessThanOrEqual(4);
  });

  it('order record stores exact oil IDs — never prose', () => {
    const scent = scentSelectionOf({
      scentPath: 'blend',
      signatureId: null,
      blendOils: ['lavender', 'frankincense'],
    });
    expect(scent).toEqual({ type: 'custom_blend', oils: ['lavender', 'frankincense'] });
    expect(JSON.stringify(scent).toLowerCase()).not.toContain('custom scent');
    const sig = scentSelectionOf({
      scentPath: 'signature',
      signatureId: 'SCENT_RECIPE_01',
      blendOils: [],
    });
    expect(sig).toEqual({ type: 'signature', recipe_id: 'SCENT_RECIPE_01' });
  });
});

/* ---------------- Natural/Clear rule ---------------- */

describe('Natural/Clear enforcement (data-driven)', () => {
  it('natural-clear is allowed only on the translucent base', () => {
    expect(colorAllowedForBase('glycerin-castor', 'natural-clear')).toBe(true);
    expect(colorAllowedForBase('double-layer', 'natural-clear')).toBe(false);
    expect(colorAllowedForBase('goat-milk-shea', 'natural-clear')).toBe(false);
  });

  it('regular colors are allowed on every base', () => {
    for (const base of ['double-layer', 'goat-milk-shea', 'glycerin-castor'] as const) {
      expect(colorAllowedForBase(base, 'emerald')).toBe(true);
      expect(colorAllowedForBase(base, 'creamy-white')).toBe(true);
    }
  });

  it('step gating rejects natural-clear on a non-translucent base', () => {
    const sel: BuilderSelections = {
      ...completeSelections(),
      base: 'double-layer',
      color: 'natural-clear',
    };
    expect(stepComplete('color', sel)).toBe(false);
    const ok: BuilderSelections = { ...sel, base: 'glycerin-castor' };
    expect(stepComplete('color', ok)).toBe(true);
  });
});

/* ---------------- custom colors ---------------- */

describe('owner-approved custom colors', () => {
  it('encode/decode round-trips a 6-digit hex', () => {
    expect(encodeCustomColor('#8a5a9e')).toBe('custom#8a5a9e');
    expect(isCustomColorId('custom#8a5a9e')).toBe(true);
    expect(isCustomColorId('emerald')).toBe(false);
    expect(colorLabel('custom#8a5a9e')).toBe('Custom color #8A5A9E');
    expect(colorAllowedForBase('double-layer', 'custom#8a5a9e')).toBe(true);
  });

  it('cart validation accepts custom#RRGGBB and rejects malformed ids', () => {
    expect(customColorHex('custom#8a5a9e')).toBe('#8a5a9e');
    expect(customColorHex('custom#xyz')).toBeNull();
    const base: Customization = {
      base: 'double-layer',
      shape: 'small-rose',
      scent: { type: 'signature', recipe_id: 'SCENT_RECIPE_01' },
      botanical: 'mint',
      color: 'custom#8a5a9e',
    };
    expect(validateCustomization(base).valid).toBe(true);
    const bad = { ...base, color: 'custom#xyz' };
    expect(validateCustomization(bad).valid).toBe(false);
  });
});

/* ---------------- bundle slots ---------------- */

describe('bundle slot independence', () => {
  it('theme produces 5 slots with fixed shapes, one per style', () => {
    const slots = slotsFromTheme(sampleTheme());
    expect(slots).toHaveLength(5);
    expect(slots.map((s) => s.slot_index)).toEqual([0, 1, 2, 3, 4]);
    for (const slot of slots) {
      const asBundle = {
        slot_index: slot.slot_index,
        base: slot.base,
        shape: BUNDLE_SLOT_SHAPES[slot.slot_index] as string,
        scent: slot.scent,
        botanical: slot.botanical,
        color: slot.color,
      };
      expect(validateBundleSlot(asBundle).valid).toBe(true);
    }
  });

  it('updating one slot never touches another', () => {
    const slots = slotsFromTheme(sampleTheme());
    const next = updateSlot(slots, 1, { base: 'glycerin-castor', color: 'natural-clear' });
    expect(next[1]?.base).toBe('glycerin-castor');
    expect(next[0]?.base).toBe('double-layer');
    expect(next[2]?.color).toBe('emerald');
    expect(slots[1]?.base).toBe('double-layer'); // original untouched
  });

  it('apply-theme creates independent copies — no shared references', () => {
    const slots = slotsFromTheme(sampleTheme());
    const theme2: SlotTheme = {
      ...sampleTheme(),
      scent: { type: 'custom_blend', oils: ['rose'] },
    };
    const applied = applyThemeToAll(slots, theme2);
    expect(applied[0]?.scent).toEqual({ type: 'custom_blend', oils: ['rose'] });
    // Mutating one slot's oils must not leak into another slot.
    if (applied[0]?.scent.type === 'custom_blend' && applied[1]?.scent.type === 'custom_blend') {
      applied[0].scent.oils.push('jasmine');
      expect(applied[1].scent.oils).toEqual(['rose']);
    } else {
      throw new Error('expected custom blends in applied slots');
    }
  });

  it('themeFromSelections returns null until the ritual is complete', () => {
    expect(themeFromSelections(defaultSelections())).toBeNull();
    const theme = themeFromSelections(completeSelections());
    expect(theme).not.toBeNull();
    expect(theme?.scent).toEqual({ type: 'signature', recipe_id: 'SCENT_RECIPE_01' });
  });
});

/* ---------------- preview invariance ---------------- */

describe('preview-shape invariance', () => {
  it('the preview canvas is always the Large Wave Rectangle', () => {
    expect(PREVIEW_CANVAS_SHAPE_ID).toBe('wave-rectangle');
  });

  it('wavePath is deterministic and takes no shape input', () => {
    expect(wavePath()).toBe(wavePath());
    expect(wavePath()).toContain('M40,196');
    expect(wavePath.length).toBe(0); // wavePath takes no arguments
  });

  it('seeded speckles are deterministic per (botanical, color) key', () => {
    const a = seededSpeckles('mint:#2e7d5b');
    const b = seededSpeckles('mint:#2e7d5b');
    const c = seededSpeckles('mint:#b0303c');
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toHaveLength(46);
  });

  it('WavePreview renders no gradients — the double-layer boundary stays hard', () => {
    const src = readBuilderFile('../../components/builder/WavePreview.tsx');
    expect(src).not.toMatch(/linearGradient|radialGradient/i);
    expect(src).toContain('PREVIEW_CANVAS_SHAPE_ID');
  });

  it('WavePreview accepts no shape prop — invariance is structural', () => {
    const src = readBuilderFile('../../components/builder/WavePreview.tsx');
    expect(src).not.toMatch(/shape\?:/);
    expect(src).not.toMatch(/props\.shape|selectedShape/);
  });

  it('the cart records the actual mold while the preview stays wave-rectangle', () => {
    const customization: Customization = {
      base: 'double-layer',
      shape: 'small-rose',
      scent: { type: 'signature', recipe_id: 'SCENT_RECIPE_01' },
      botanical: 'mint',
      color: 'emerald',
    };
    const item = buildCartItem('custom-alchemy-soap', customization, 1);
    expect(item.customization?.shape).toBe('small-rose');
    expect(item.unit_price_cents).toBe(577);
    expect(PREVIEW_CANVAS_SHAPE_ID).toBe('wave-rectangle');
  });
});

/* ---------------- bundle math derivation ---------------- */

describe('bundle pricing — derived, never hard-coded in components', () => {
  it('lib derivation still reconciles: 4785 − 3577 = 1208 (25.2%)', () => {
    expect(bundleComponentSumCents()).toBe(4785);
    expect(bundleSavingsCents()).toBe(1208);
    expect(bundleSavingsPct()).toBe(25.2);
    expect(formatPrice(bundleSavingsCents())).toBe('$12.08');
  });

  it('no hard-coded bundle literals in any builder component source', () => {
    const forbidden = [/35\.77/, /12\.08/, /47\.85/, /\b3577\b/, /\b1208\b/, /\b4785\b/, /\$55\b/];
    for (const f of BUILDER_FILES) {
      const src = readBuilderFile(f);
      for (const re of forbidden) {
        expect(src, `${f} contains hard-coded bundle literal ${re}`).not.toMatch(re);
      }
    }
  });
});

/* ---------------- order-record honesty ---------------- */

describe('order-record honesty', () => {
  it('no component writes the string "custom scent" anywhere', () => {
    for (const f of BUILDER_FILES) {
      const src = readBuilderFile(f);
      expect(src, `"custom scent" in ${f}`).not.toMatch(/custom scent/i);
    }
  });

  it('no superseded payment paths in builder components or the page', () => {
    const files = [...BUILDER_FILES, '../../app/soap-builder/page.tsx'];
    for (const f of files) {
      const src = readBuilderFile(f);
      expect(src, `payment path in ${f}`).not.toMatch(/stripe|shopify|paypal|square/i);
    }
  });
});

/* ---------------- brand ---------------- */

describe('brand identity on the builder route', () => {
  it('page + island use the exact business name', () => {
    const page = readBuilderFile('../../app/soap-builder/page.tsx');
    const island = readBuilderFile('../../components/builder/SoapBuilder.tsx');
    expect(page).toContain("Amber's Alchemy Apothecary");
    expect(island).toContain("Amber's Alchemy Apothecary");
  });

  it('the builder never shortens the name to "Amber\'s Alchemy" alone', () => {
    const files = [...BUILDER_FILES, '../../app/soap-builder/page.tsx'];
    for (const f of files) {
      const src = readBuilderFile(f);
      const shortUses = (src.match(/Amber's Alchemy(?! Apothecary)/g) ?? []).length;
      expect(shortUses, `shortened brand in ${f}`).toBe(0);
    }
  });
});

/* ---------------- analytics contract ---------------- */

describe('analytics emits only canonical contract names', () => {
  it('every track() call uses ANALYTICS_EVENT_NAMES — no string literals', () => {
    const names = new Set(Object.keys(ANALYTICS_EVENT_NAMES));
    for (const f of BUILDER_FILES) {
      const src = readBuilderFile(f);
      const literalCalls = src.match(/track(?:Once)?\(\s*['"][^'"]+['"]/g) ?? [];
      expect(literalCalls, `string-literal event in ${f}`).toEqual([]);
      const used = [...src.matchAll(/ANALYTICS_EVENT_NAMES\.(\w+)/g)].map((m) => m[1] as string);
      for (const u of used) {
        expect(names.has(u), `unknown event ${u} in ${f}`).toBe(true);
      }
    }
  });

  it('the tracker is inert without a token and never throws', () => {
    expect(isPostHogLive()).toBe(false);
    // ClientEventName (not the broader AnalyticsEventName): the browser
    // tracker type-refuses server-owned events — see analytics-contracts.
    const name = ANALYTICS_EVENT_NAMES.baseSelected as ClientEventName;
    expect(() => track(name, { base: 'double-layer' })).not.toThrow();
  });
});

/* ---------------- server authority ---------------- */

describe('server-authoritative totals', () => {
  it('buildCartItem prices from the shape table — the client sends no price', () => {
    const customization: Customization = {
      base: 'glycerin-castor',
      shape: 'floral-round',
      scent: { type: 'custom_blend', oils: ['jasmine', 'lemon'] },
      botanical: 'cornflower',
      color: 'natural-clear',
    };
    const item = buildCartItem('custom-alchemy-soap', customization, 2);
    expect(item.unit_price_cents).toBe(1177);
    const order = buildOrderConfiguration([item], undefined, 0);
    expect(order.total_cents).toBe(2354);
    expect(order.computed_by).toBe('server');
  });

  it('a tampered unit price is rejected by the recompute', () => {
    const customization: Customization = {
      base: 'double-layer',
      shape: 'small-rose',
      scent: { type: 'signature', recipe_id: 'SCENT_RECIPE_01' },
      botanical: 'mint',
      color: 'emerald',
    };
    const item = buildCartItem('custom-alchemy-soap', customization, 1);
    const tampered = { ...item, unit_price_cents: 1 };
    expect(() => buildOrderConfiguration([tampered], undefined, 0)).toThrow(
      /Price mismatch/,
    );
  });

  it('signature recipes referenced by the builder exist in the catalog', () => {
    expect(getScentRecipe('SCENT_RECIPE_01')?.name).toBe('Moonlit Lavender');
    expect(getScentRecipe('SCENT_RECIPE_08')?.name).toBe('Spice of the Earth');
  });
});
