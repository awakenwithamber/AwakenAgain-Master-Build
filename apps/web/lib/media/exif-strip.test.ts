/**
 * EXIF/GPS stripping — the owner's hard rule: EVERY uploaded photo is
 * stripped server-side before storage, and a photo that cannot be
 * cleaned is rejected. These tests build images carrying an EXIF
 * block with GPS-shaped payloads and prove the stored bytes contain
 * no trace of them, while the image structure survives.
 */
import { describe, expect, it } from 'vitest';
import {
  cleanImageDataUrl,
  sniffImageFormat,
  stripImageMetadata,
} from './exif-strip';

/** A minimal JPEG: SOI, APP0(JFIF), APP1(Exif+GPS), DQT, SOF0, SOS, data, EOI. */
function jpegWithExif(): Uint8Array {
  const bytes: number[] = [0xff, 0xd8]; // SOI
  const segment = (marker: number, payload: number[]) => {
    const length = payload.length + 2;
    bytes.push(0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload);
  };
  segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]); // APP0 JFIF
  // APP1 "Exif\0\0" + a GPS-flavored payload (lat/long refs as text markers).
  const exifPayload = [
    ...Buffer.from('Exif\0\0', 'latin1'),
    ...Buffer.from('GPSLatitude:40.7608;GPSLongitude:-111.8910', 'latin1'),
  ];
  segment(0xe1, exifPayload);
  segment(0xdb, new Array(67).fill(8)); // DQT
  segment(0xc0, [8, 0, 16, 0, 16, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]); // SOF0
  segment(0xda, [3, 1, 0, 2, 0x11, 1, 3, 0x11, 1, 0, 63, 0]); // SOS header
  bytes.push(0x11, 0x22, 0x33, 0xff, 0x00, 0x44); // entropy data (with stuffed FF)
  bytes.push(0xff, 0xd9); // EOI
  return new Uint8Array(bytes);
}

/** A minimal PNG: signature, IHDR, eXIf (GPS), IDAT, IEND. */
function pngWithExif(): Uint8Array {
  const chunk = (type: string, data: number[]) => {
    const out = [
      (data.length >> 24) & 0xff, (data.length >> 16) & 0xff,
      (data.length >> 8) & 0xff, data.length & 0xff,
      ...Buffer.from(type, 'latin1'),
      ...data,
      0, 0, 0, 0, // CRC (the stripper drops/keeps whole chunks; CRCs of kept chunks are untouched)
    ];
    return out;
  };
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', new Array(13).fill(0)),
    ...chunk('eXIf', [...Buffer.from('GPS:40.7608,-111.8910', 'latin1')]),
    ...chunk('tEXt', [...Buffer.from('Location\0Salt Lake City', 'latin1')]),
    ...chunk('IDAT', [0x78, 0x9c, 1, 2, 3]),
    ...chunk('IEND', []),
  ]);
}

/** A minimal WebP: RIFF header, VP8X, EXIF chunk, VP8 chunk. */
function webpWithExif(): Uint8Array {
  const chunk = (type: string, data: number[]) => {
    const padded = data.length % 2 === 1 ? [...data, 0] : data;
    return [
      ...Buffer.from(type, 'latin1'),
      data.length & 0xff, (data.length >> 8) & 0xff, 0, 0,
      ...padded,
    ];
  };
  const body = [
    ...chunk('VP8X', [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]), // EXIF+XMP flags set
    ...chunk('EXIF', [...Buffer.from('GPS:40.7608,-111.8910', 'latin1')]),
    ...chunk('VP8 ', [1, 2, 3, 4]),
  ];
  const riffSize = 4 + body.length;
  return new Uint8Array([
    ...Buffer.from('RIFF', 'latin1'),
    riffSize & 0xff, (riffSize >> 8) & 0xff, 0, 0,
    ...Buffer.from('WEBP', 'latin1'),
    ...body,
  ]);
}

const asText = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

describe('stripImageMetadata', () => {
  it('removes the JPEG EXIF/GPS segment and keeps the image', () => {
    const original = jpegWithExif();
    expect(asText(original)).toContain('GPSLatitude');
    const stripped = stripImageMetadata(original);
    expect(stripped).not.toBeNull();
    expect(stripped!.format).toBe('jpeg');
    expect(stripped!.metadataRemoved).toBe(true);
    const text = asText(stripped!.bytes);
    expect(text).not.toContain('Exif');
    expect(text).not.toContain('GPSLatitude');
    expect(text).not.toContain('40.7608');
    // Structure survives: SOI, JFIF APP0 kept, SOF0 + SOS + EOI present.
    expect(stripped!.bytes[0]).toBe(0xff);
    expect(stripped!.bytes[1]).toBe(0xd8);
    expect(text).toContain('JFIF');
    expect(stripped!.bytes[stripped!.bytes.length - 2]).toBe(0xff);
    expect(stripped!.bytes[stripped!.bytes.length - 1]).toBe(0xd9);
  });

  it('removes PNG eXIf and text chunks, keeps IHDR/IDAT/IEND', () => {
    const stripped = stripImageMetadata(pngWithExif());
    expect(stripped).not.toBeNull();
    expect(stripped!.metadataRemoved).toBe(true);
    const text = asText(stripped!.bytes);
    expect(text).not.toContain('GPS');
    expect(text).not.toContain('Salt Lake City');
    expect(text).toContain('IHDR');
    expect(text).toContain('IDAT');
    expect(text).toContain('IEND');
  });

  it('removes the WebP EXIF chunk and clears the VP8X flags', () => {
    const stripped = stripImageMetadata(webpWithExif());
    expect(stripped).not.toBeNull();
    expect(stripped!.metadataRemoved).toBe(true);
    const text = asText(stripped!.bytes);
    expect(text).not.toContain('GPS');
    expect(text).toContain('VP8 ');
    // RIFF size field must equal file size − 8.
    const riffSize =
      stripped!.bytes[4] | (stripped!.bytes[5] << 8) | (stripped!.bytes[6] << 16) | (stripped!.bytes[7] << 24);
    expect(riffSize).toBe(stripped!.bytes.length - 8);
  });

  it('rejects non-images and truncated images outright', () => {
    expect(stripImageMetadata(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(stripImageMetadata(jpegWithExif().subarray(0, 10))).toBeNull();
    expect(sniffImageFormat(new Uint8Array([0x47, 0x49, 0x46]))).toBeNull(); // GIF — unsupported
  });
});

describe('cleanImageDataUrl — the storage boundary', () => {
  it('a data-URL upload with EXIF GPS is stored with NO trace of it', () => {
    const dataUrl = `data:image/jpeg;base64,${Buffer.from(jpegWithExif()).toString('base64')}`;
    const cleaned = cleanImageDataUrl(dataUrl, 400 * 1024);
    expect(cleaned).not.toBeNull();
    expect(cleaned!.metadataRemoved).toBe(true);
    const storedBytes = new Uint8Array(Buffer.from(cleaned!.dataUrl.split(',')[1], 'base64'));
    const text = asText(storedBytes);
    expect(text).not.toContain('Exif');
    expect(text).not.toContain('GPS');
    expect(text).not.toContain('-111.8910');
  });

  it('rejects mismatched MIME, oversize, and non-image payloads', () => {
    const jpeg = `data:image/jpeg;base64,${Buffer.from(jpegWithExif()).toString('base64')}`;
    const asPng = jpeg.replace('image/jpeg', 'image/png');
    expect(cleanImageDataUrl(asPng, 400 * 1024)).toBeNull();
    expect(cleanImageDataUrl(jpeg, 16)).toBeNull(); // cap below the file size
    expect(cleanImageDataUrl('data:text/html;base64,PGI+', 400 * 1024)).toBeNull();
    expect(cleanImageDataUrl('not a data url', 400 * 1024)).toBeNull();
    expect(cleanImageDataUrl(undefined, 400 * 1024)).toBeNull();
  });
});
