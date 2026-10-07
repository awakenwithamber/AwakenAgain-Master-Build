'use client';
/**
 * Mold photo for a soap shape card.
 *
 * Codes against the SHAPE_IMAGES contract (lib/media/image-paths.ts) that
 * the asset pipeline populates. If the file is missing or fails to load,
 * renders a neutral placeholder instead of a broken image — a missing asset
 * is never faked and never breaks the card.
 */
import { useState } from 'react';
import { SHAPE_IMAGES } from '../../lib/media/image-paths';
import styles from './SoapBuilderModal.module.css';

const SHAPE_ID_TO_IMAGE: Record<string, string> = {
  'small-rose': SHAPE_IMAGES.smallRose,
  'medium-rose': SHAPE_IMAGES.mediumRose,
  'wave-rectangle': SHAPE_IMAGES.waveRectangle,
  'floral-round': SHAPE_IMAGES.floralRound,
  'plain-rectangle': SHAPE_IMAGES.plainRectangle,
};

export interface ShapeImageProps {
  shapeId: string;
  /** Accessible name for the mold photo. */
  alt: string;
}

export function ShapeImage({ shapeId, alt }: ShapeImageProps) {
  const [failed, setFailed] = useState(false);
  const src = SHAPE_ID_TO_IMAGE[shapeId];

  return (
    <span className={styles.shapeImgWrap}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          className={styles.shapeImg}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={styles.shapeImgFallback}
          role="img"
          aria-label={`${alt} (photo coming soon)`}
        >
          🧼
        </span>
      )}
    </span>
  );
}
