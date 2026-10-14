/**
 * Product display-image resolution — the one place UI code asks: "what
 * image may represent this product, and how must it be framed?"
 *
 * An image is renderable for a product ONLY when the registry and the
 * catalog record agree about it:
 *   1. lib/media/image-manifest.ts carries a non-MISSING_ASSET entry whose
 *      slotKey is the product handle and whose file is deployed; AND
 *   2. the product record registers that same path as an image, without
 *      marking it a placeholder / MISSING_ASSET.
 * Where the two disagree, nothing renders and the surface falls back to its
 * honest placeholder / text-only state.
 *
 * Honesty rules (Amber's, binding):
 *   - A generated or AI-styled asset is NEVER presented as documentary
 *     photography: it resolves with descriptive-of-the-artwork alt text and
 *     a visible "illustrated representation" caption.
 *   - Only an asset the manifest does NOT flag notDocumentaryPhoto may be
 *     presented plainly as a product photo.
 *   - Mappings are never guessed: no manifest entry + record agreement, no
 *     image.
 *
 * Basis: image-coverage truth table, audit-2026-10-13 (every deployed file
 * below was viewed and, where an owner-upload source exists, pixel-verified
 * against it on 2026-10-13).
 */
import {
  getAssetsForSlot,
  type ImageAssetEntry,
} from './image-manifest';
import type { Product } from '../../types';

/**
 * Deployed images whose baked-in content is KNOWN to be wrong for the
 * product they depict belong here: they stay exactly as they are (the
 * cards' pre-existing blind canonical-path render is untouched) but are
 * NOT newly wired into any additional surface until the owner decides
 * whether to regenerate or replace them.
 *
 * Resolution note (2026-10-13): sacred-balance-capsules (caption named a
 * different product), immune-at-ease-capsules (garbled caption), and
 * vital-vitality-capsules (jar label read "Vitamins") were regenerated at
 * the owner's direction and verified word-for-word; they resolve normally
 * and the set is empty. Add a handle here only for a newly discovered
 * wrong-content image, with the reason recorded in the manifest.
 */
export const PENDING_OWNER_DECISION_HANDLES: ReadonlySet<string> = new Set(
  [],
);

/** Visible caption shown under every non-documentary product image. */
export const REPRESENTATION_CAPTION =
  'Illustrated representation — product photography in progress.';

export interface ProductDisplayImage {
  /** App-served path of the deployed file. */
  src: string;
  /** Accessible alt text; describes the artwork honestly, never claims a photo of the physical product for non-documentary assets. */
  alt: string;
  /** True only when the asset is a documentary photo of the physical product. */
  documentaryPhoto: boolean;
  /** Visible honest caption for non-documentary imagery; null for photos. */
  caption: string | null;
  /** Manifest provenance of the asset. */
  provenance: ImageAssetEntry['provenance'];
}

type ImageRecord = Record<string, unknown>;

function recordImages(product: Product): ImageRecord[] {
  const raw = (product as Record<string, unknown>)['images'];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is ImageRecord =>
      typeof e === 'object' && e !== null && !Array.isArray(e),
  );
}

/** The app-served path an image record points at (records use src | file | path). */
function recordImagePath(entry: ImageRecord): string | null {
  for (const key of ['src', 'file', 'path'] as const) {
    const v = entry[key];
    if (typeof v === 'string' && v.startsWith('/')) return v;
  }
  return null;
}

/** True when the record itself marks this entry as a placeholder / missing asset. */
function recordEntryIsPlaceholder(entry: ImageRecord): boolean {
  const status = entry['status'];
  if (status === 'placeholder' || status === 'placeholder_fallback') {
    return true;
  }
  return entry['asset_status'] === 'MISSING_ASSET';
}

/**
 * Resolve the primary display image for a product, or null when no deployed
 * imagery is honestly registered for it (placeholder products, services with
 * unverified legacy associations, flagged images pending owner decision,
 * and any manifest/record disagreement).
 */
export function getProductDisplayImage(
  product: Product,
): ProductDisplayImage | null {
  if (PENDING_OWNER_DECISION_HANDLES.has(product.handle)) return null;

  const entry = getAssetsForSlot(product.handle).find(
    (a) => a.deployed && a.provenance !== 'MISSING_ASSET',
  );
  if (!entry) return null;

  const record = recordImages(product).find(
    (e) => recordImagePath(e) === entry.path,
  );
  if (!record) return null; // registry and record disagree — render nothing
  if (recordEntryIsPlaceholder(record)) return null;

  const documentaryPhoto = !entry.notDocumentaryPhoto;
  const recordAlt =
    typeof record['alt'] === 'string' ? (record['alt'] as string) : null;
  return {
    src: entry.path,
    // For a documentary photo the record's own alt describes the product;
    // for artwork the manifest's `depicts` already names it as generated /
    // illustrated, which keeps the alt honest about what is shown.
    alt: documentaryPhoto ? (recordAlt ?? entry.depicts) : entry.depicts,
    documentaryPhoto,
    caption: documentaryPhoto ? null : REPRESENTATION_CAPTION,
    provenance: entry.provenance,
  };
}
