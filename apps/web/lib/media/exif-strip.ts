/**
 * Image metadata stripping — Gaia profile build (owner spec
 * 2026-11-08: "Strip GPS/EXIF data from EVERY uploaded photo
 * server-side before storage").
 *
 * PURE, dependency-free, byte-level. GPS coordinates in an uploaded
 * photo live in exactly one place per format, and this module removes
 * that place without touching the image data itself:
 *
 * - JPEG: metadata rides in APPn segments between SOI and SOS. The
 *   Exif payload is APP1 ("Exif\0\0"); XMP is also APP1; IPTC is
 *   APP13/APP14 territory. We drop ALL APP0–APP15 segments except
 *   APP0 (JFIF header, required by many decoders) and APP14 when it
 *   carries the Adobe color transform... — in practice the safe,
 *   simple rule used here: drop every APPn except APP0. Decoders do
 *   not need XMP/Exif/ICC for display of a profile photo, and the
 *   owner's rule is absolute: no metadata survives.
 * - PNG: metadata rides in ancillary chunks (eXIf, tEXt, iTXt, zTXt,
 *   tIME). We drop eXIf + the text chunks + tIME; every other chunk
 *   is copied byte-for-byte, CRCs included (dropping a whole chunk
 *   never invalidates the ones that remain).
 * - WebP: metadata rides in EXIF and XMP chunks inside the RIFF
 *   container. We drop those chunks and fix the RIFF size. The VP8X
 *   feature flags are cleared of the EXIF/XMP bits so no reader goes
 *   looking for chunks that are gone.
 *
 * Anything unrecognized, truncated, or structurally wrong is
 * REJECTED (returns null) — an upload we cannot prove clean is never
 * stored. This module never throws.
 */

export type StrippedImageFormat = 'jpeg' | 'png' | 'webp';

export interface StrippedImage {
  format: StrippedImageFormat;
  bytes: Uint8Array;
  /** True when at least one metadata segment/chunk was removed. */
  metadataRemoved: boolean;
}

/** Format sniffing by magic bytes — the ONLY format evidence we trust. */
export function sniffImageFormat(bytes: Uint8Array): StrippedImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* JPEG                                                                */
/* ------------------------------------------------------------------ */

function stripJpeg(bytes: Uint8Array): StrippedImage | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const out: number[] = [0xff, 0xd8];
  let offset = 2;
  let removed = false;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return null; // lost sync — not a clean JPEG
    const marker = bytes[offset + 1];
    if (marker === undefined) return null;
    // Standalone markers (no length): RSTn, TEM, SOI — copy through.
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(0xff, marker);
      offset += 2;
      continue;
    }
    if (marker === 0xd9) {
      // EOI
      out.push(0xff, 0xd9);
      offset += 2;
      break;
    }
    if (offset + 4 > bytes.length) return null;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    const isAppSegment = marker >= 0xe0 && marker <= 0xef;
    const keep = !isAppSegment || marker === 0xe0; // keep APP0 (JFIF) only
    if (isAppSegment && !keep) {
      removed = true;
    } else {
      for (let i = 0; i < 2 + length; i++) out.push(bytes[offset + i]);
    }
    offset += 2 + length;
    if (marker === 0xda) {
      // SOS: everything after the header is entropy-coded image data —
      // copy the remainder verbatim (it may contain 0xFF bytes that are
      // not markers).
      for (let i = offset; i < bytes.length; i++) out.push(bytes[i]);
      offset = bytes.length;
      break;
    }
  }
  if (offset < bytes.length) {
    // Trailing bytes after EOI — not part of the image; drop them.
    removed = removed || true;
  }
  return { format: 'jpeg', bytes: new Uint8Array(out), metadataRemoved: removed };
}

/* ------------------------------------------------------------------ */
/* PNG                                                                 */
/* ------------------------------------------------------------------ */

const PNG_DROP_CHUNKS: ReadonlySet<string> = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);

function stripPng(bytes: Uint8Array): StrippedImage | null {
  const signature = bytes.subarray(0, 8);
  const out: Uint8Array[] = [new Uint8Array(signature)];
  let offset = 8;
  let removed = false;
  let sawIend = false;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) return null;
    const length =
      (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const chunkTotal = 8 + length + 4; // length field + type + data + CRC
    if (length < 0 || offset + chunkTotal > bytes.length) return null;
    if (PNG_DROP_CHUNKS.has(type)) {
      removed = true;
    } else {
      out.push(bytes.slice(offset, offset + chunkTotal));
    }
    offset += chunkTotal;
    if (type === 'IEND') {
      sawIend = true;
      break;
    }
  }
  if (!sawIend) return null;
  const total = out.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let at = 0;
  for (const part of out) {
    merged.set(part, at);
    at += part.length;
  }
  return { format: 'png', bytes: merged, metadataRemoved: removed };
}

/* ------------------------------------------------------------------ */
/* WebP                                                                */
/* ------------------------------------------------------------------ */

function stripWebp(bytes: Uint8Array): StrippedImage | null {
  const chunks: Uint8Array[] = [];
  let offset = 12; // RIFF header (12) — chunk headers start here
  let removed = false;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) return null;
    const type = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const size =
      bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
    if (size < 0 || offset + 8 + size > bytes.length) return null;
    const padded = size + (size % 2); // RIFF chunks are word-aligned
    if (type === 'EXIF' || type === 'XMP ') {
      removed = true;
    } else if (type === 'VP8X' && size >= 1) {
      // Clear the EXIF (0x08) and XMP (0x04) feature flags in the copy.
      const copy = bytes.slice(offset, offset + 8 + padded);
      copy[8] = copy[8] & ~0x0c;
      chunks.push(copy);
    } else {
      chunks.push(bytes.slice(offset, offset + 8 + padded));
    }
    offset += 8 + padded;
  }
  const bodyLength = chunks.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(12 + bodyLength);
  merged.set(bytes.subarray(0, 12), 0);
  // RIFF size = file size − 8.
  const riffSize = merged.length - 8;
  merged[4] = riffSize & 0xff;
  merged[5] = (riffSize >> 8) & 0xff;
  merged[6] = (riffSize >> 16) & 0xff;
  merged[7] = (riffSize >> 24) & 0xff;
  let at = 12;
  for (const part of chunks) {
    merged.set(part, at);
    at += part.length;
  }
  return { format: 'webp', bytes: merged, metadataRemoved: removed };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/**
 * Strip ALL metadata (EXIF/GPS/XMP/text) from an uploaded image.
 * Returns null when the bytes are not a parseable JPEG/PNG/WebP —
 * callers must reject such uploads rather than store them raw.
 */
export function stripImageMetadata(bytes: Uint8Array): StrippedImage | null {
  const format = sniffImageFormat(bytes);
  if (!format) return null;
  try {
    if (format === 'jpeg') return stripJpeg(bytes);
    if (format === 'png') return stripPng(bytes);
    return stripWebp(bytes);
  } catch {
    return null;
  }
}

const MIME_BY_FORMAT: Record<StrippedImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Decode a data-URL upload, strip its metadata, and re-encode as a
 * clean data URL for storage. Returns null on any problem: wrong
 * shape, unsupported/mismatched type, unparseable bytes, or over the
 * decoded size cap.
 */
export function cleanImageDataUrl(
  input: unknown,
  maxDecodedBytes: number,
): { dataUrl: string; format: StrippedImageFormat; metadataRemoved: boolean } | null {
  if (typeof input !== 'string') return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(input.trim());
  if (!match) return null;
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(match[2].replace(/\s+/g, ''), 'base64'));
  } catch {
    return null;
  }
  if (bytes.length === 0 || bytes.length > maxDecodedBytes) return null;
  const stripped = stripImageMetadata(bytes);
  if (!stripped) return null;
  // The declared MIME must agree with the sniffed bytes.
  if (MIME_BY_FORMAT[stripped.format] !== match[1]) return null;
  return {
    dataUrl: `data:${match[1]};base64,${Buffer.from(stripped.bytes).toString('base64')}`,
    format: stripped.format,
    metadataRemoved: stripped.metadataRemoved,
  };
}
