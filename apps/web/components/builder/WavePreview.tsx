'use client';
/**
 * Live preview canvas for the soap builder.
 *
 * ALWAYS renders the Large Wave Rectangle (PREVIEW_CANVAS_SHAPE_ID).
 * There is deliberately no `shape` prop: the preview can never render the
 * customer's selected mold, and the selected mold is recorded in the cart
 * data separately from the preview.
 *
 * The Signature Double Layer base shows a HARD visible boundary between the
 * translucent glycerin+castor top and the opaque goat-milk+shea bottom —
 * never a gradient, swirl, fade, or blend.
 *
 * Rendered with SVG/CSS only. This is an illustrated preview, never
 * generated or fake product photography.
 */
import { useMemo } from 'react';
import {
  BOTANICAL_SPECKLE_COLORS,
  DOUBLE_LAYER_RENDER,
  PREVIEW_CANVAS_SHAPE_ID,
  PREVIEW_OUTLINE,
  PREVIEW_SHADOW_FILL,
  SINGLE_LAYER_RENDER,
  WAVE_GEOMETRY,
  seededSpeckles,
  wavePath,
} from './preview';
import { colorHex } from './state';
import type { SoapBaseId } from '../../types';

export interface WavePreviewProps {
  /** Soap base — drives the layer rendering. Null before the base step is done. */
  base: SoapBaseId | null;
  /** ColorOption id, or an owner-approved custom color encoded as `custom#RRGGBB`. */
  colorId: string | null;
  botanicalId: string | null;
  /** Caption under the canvas, e.g. "Scented with Moonlit Lavender — …". */
  scentCaption: string;
  className?: string;
}

export function WavePreview({
  base,
  colorId,
  botanicalId,
  scentCaption,
  className,
}: WavePreviewProps) {
  const hex = colorId ? colorHex(colorId) : null;
  const { viewW, viewH, barX, barW, topY, splitY, botY } = WAVE_GEOMETRY;
  const path = useMemo(() => wavePath(), []);
  const speckles = useMemo(() => {
    if (!botanicalId) return [];
    return seededSpeckles(`${botanicalId}:${hex ?? 'none'}`);
  }, [botanicalId, hex]);
  const speckleFill =
    (botanicalId && BOTANICAL_SPECKLE_COLORS[botanicalId]) || '#8a6f35';

  const fullH = botY - topY;
  const topH = splitY - topY;

  const speckleCircles = (
    x: number,
    y: number,
    w: number,
    h: number,
  ) =>
    speckles.map((s, i) => (
      <circle
        key={i}
        cx={x + s.cx * w}
        cy={y + s.cy * h}
        r={s.r}
        fill={speckleFill}
        opacity={s.opacity}
      />
    ));

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        role="img"
        aria-label={`Illustrated preview of your soap on the Large Wave Rectangle canvas (${PREVIEW_CANVAS_SHAPE_ID})`}
      >
        <defs>
          <clipPath id="builder-barclip">
            <path d={path} />
          </clipPath>
          <clipPath id="builder-topclip">
            <rect x={barX} y={0} width={barW} height={topH + 8} />
          </clipPath>
        </defs>
        <path d={path} fill={PREVIEW_SHADOW_FILL} />
        <g clipPath="url(#builder-barclip)">
          {base === 'double-layer' && (
            <>
              {/* Opaque goat-milk + shea bottom */}
              <rect
                x={barX}
                y={splitY}
                width={barW}
                height={botY - splitY + 12}
                fill={DOUBLE_LAYER_RENDER.bottomFill}
              />
              {/* Tint applies to the translucent top layer only */}
              {hex && (
                <g clipPath="url(#builder-topclip)">
                  <rect
                    x={barX}
                    y={0}
                    width={barW}
                    height={splitY + 8}
                    fill={hex}
                    opacity={DOUBLE_LAYER_RENDER.topTintOpacity}
                    style={{ mixBlendMode: 'multiply' }}
                  />
                </g>
              )}
              {/* HARD boundary — a crisp line, never a gradient */}
              <line
                x1={barX}
                y1={splitY}
                x2={barX + barW}
                y2={splitY}
                stroke={DOUBLE_LAYER_RENDER.boundaryStroke}
                strokeWidth={DOUBLE_LAYER_RENDER.boundaryWidth}
              />
              {speckleCircles(barX, topY, barW, topH)}
            </>
          )}
          {base === 'goat-milk-shea' && (
            <>
              <rect
                x={barX}
                y={topY}
                width={barW}
                height={fullH + 12}
                fill={SINGLE_LAYER_RENDER.creamFill}
              />
              {hex && (
                <rect
                  x={barX}
                  y={topY}
                  width={barW}
                  height={fullH + 12}
                  fill={hex}
                  opacity={SINGLE_LAYER_RENDER.creamTintOpacity}
                  style={{ mixBlendMode: 'multiply' }}
                />
              )}
              {speckleCircles(barX, topY, barW, fullH)}
            </>
          )}
          {(base === 'glycerin-castor' || base === null) && (
            <>
              <rect
                x={barX}
                y={topY}
                width={barW}
                height={fullH + 12}
                fill={SINGLE_LAYER_RENDER.glycerinFill}
              />
              {hex && base !== null && (
                <rect
                  x={barX}
                  y={topY}
                  width={barW}
                  height={fullH + 12}
                  fill={hex}
                  opacity={SINGLE_LAYER_RENDER.glycerinTintOpacity}
                  style={{ mixBlendMode: 'multiply' }}
                />
              )}
              {base !== null && speckleCircles(barX, topY, barW, fullH)}
            </>
          )}
        </g>
        <path d={path} fill="none" stroke={PREVIEW_OUTLINE} strokeWidth={1.5} />
      </svg>
      <figcaption aria-live="polite" className="scent-caption">
        {scentCaption}
      </figcaption>
      <p className="preview-cap">
        Preview shown on the Wave Rectangle canvas — your soap will be
        hand-poured into your chosen mold. Illustrated preview, not a
        photograph of your finished bar.
      </p>
    </figure>
  );
}
