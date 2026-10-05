/**
 * Pure SVG geometry for the Wave Rectangle preview canvas.
 *
 * Preview-shape invariance is STRUCTURAL: this module renders exactly one
 * shape (the Large Wave Rectangle) and accepts no shape parameter anywhere.
 * The cart records the customer's actual selected mold separately — the
 * preview never influences business data.
 *
 * Geometry ported from the QA'd static builder (soap-shop-build/soap-builder.html).
 */

export const PREVIEW_CANVAS_SHAPE_ID = 'wave-rectangle' as const;

/** Preview canvas geometry, in px of a 320x220 viewBox. */
export const WAVE_GEOMETRY = {
  viewW: 320,
  viewH: 220,
  barX: 40,
  barW: 240,
  topY: 46,
  /** Crisp boundary between the double-layer top and bottom — never a gradient. */
  splitY: 122,
  botY: 196,
} as const;

/** Wave-topped rectangle outline for the preview bar. Deterministic — one shape only. */
export function wavePath(): string {
  const { barX, barW, topY, botY } = WAVE_GEOMETRY;
  const y0 = topY;
  const y1 = botY;
  const right = barX + barW;
  return [
    `M${barX},${y1} L${barX},${y0 + 14}`,
    `Q${barX + 30},${y0 - 6} ${barX + 60},${y0 + 8}`,
    `Q${barX + 90},${y0 + 20} ${barX + 120},${y0 + 8}`,
    `Q${barX + 150},${y0 - 4} ${barX + 180},${y0 + 8}`,
    `Q${barX + 210},${y0 + 18} ${right},${y0 + 6}`,
    `L${right},${y1} Q${right},${y1 + 10} ${right - 10},${y1 + 10}`,
    `L${barX + 10},${y1 + 10} Q${barX},${y1 + 10} ${barX},${y1} Z`,
  ].join(' ');
}

/** FNV-1a string hash (ported from the QA'd static builder). */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seeded PRNG (mulberry32). Same seed → same speckle pattern, every device and session. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Speckle {
  /** Normalized 0..1 — the renderer maps these onto the region. */
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

/**
 * Deterministic botanical speckle field, keyed on (botanical, color).
 * Pure: identical inputs → identical output on every render.
 */
export function seededSpeckles(seedKey: string, count = 46): Speckle[] {
  const rnd = mulberry32(hashString(seedKey));
  const speckles: Speckle[] = [];
  for (let i = 0; i < count; i++) {
    speckles.push({
      cx: rnd(),
      cy: rnd(),
      r: 1.5 + rnd() * 3.2,
      opacity: 0.55 + rnd() * 0.4,
    });
  }
  return speckles;
}

/**
 * Presentation-only speckle palette, keyed by catalog botanical id.
 * Botanical identity always comes from lib/catalog/oils (BOTANICALS);
 * these hexes only tint the illustrated preview.
 */
export const BOTANICAL_SPECKLE_COLORS: Record<string, string> = {
  'rose-petals': '#B0303C',
  lavender: '#6B4E9B',
  calendula: '#D97B2B',
  chamomile: '#E8C95C',
  hibiscus: '#7A1F3D',
  rosemary: '#2E7D5B',
  mint: '#3E9B6A',
  oatmeal: '#C9A96A',
  cornflower: '#3B6EA5',
};

/**
 * Double-layer render constants — the hard boundary rule, in data.
 * The separator is a crisp line; no gradient, swirl, fade, or blend — ever.
 */
export const DOUBLE_LAYER_RENDER = {
  /** Opaque goat-milk + shea bottom fill. */
  bottomFill: '#F3E7CE',
  /** Crisp separator line between the translucent top and the opaque bottom. */
  boundaryStroke: '#8a6f35',
  boundaryWidth: 2.5,
  /** Tint applies to the translucent top layer only, at this opacity. */
  topTintOpacity: 0.62,
} as const;

export const SINGLE_LAYER_RENDER = {
  creamFill: '#F3E7CE',
  creamTintOpacity: 0.28,
  glycerinFill: '#e8dcc8',
  glycerinTintOpacity: 0.62,
} as const;

export const PREVIEW_OUTLINE = 'rgba(227,200,126,.5)';
export const PREVIEW_SHADOW_FILL = '#3a2a5e';
