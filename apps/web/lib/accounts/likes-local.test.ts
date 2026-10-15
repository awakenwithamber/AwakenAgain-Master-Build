/**
 * On-device likes — Phase 3 Step 3.
 *
 * The local half of profile likes: explicit-tap storage in the
 * personalization modules' injectable style. Corrupt data must read as
 * "no likes", never throw into a product page.
 */
import { describe, expect, it } from 'vitest';
import {
  LIKES_STORAGE_KEY,
  readLocalLikes,
  toggleLocalLike,
  writeLocalLikes,
} from './likes-local';
import type { StorageLike } from '../personalization/consent';

function fakeStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('local likes', () => {
  it('starts empty and toggles on/off', () => {
    const storage = fakeStorage();
    expect(readLocalLikes(storage)).toEqual([]);
    expect(toggleLocalLike(storage, 'gaias-rose-soap')).toEqual(['gaias-rose-soap']);
    expect(toggleLocalLike(storage, 'chill-pill-capsules')).toEqual([
      'gaias-rose-soap',
      'chill-pill-capsules',
    ]);
    expect(toggleLocalLike(storage, 'gaias-rose-soap')).toEqual(['chill-pill-capsules']);
    expect(readLocalLikes(storage)).toEqual(['chill-pill-capsules']);
  });

  it('tolerates corrupt or non-array storage', () => {
    expect(
      readLocalLikes(fakeStorage({ [LIKES_STORAGE_KEY]: 'not json' })),
    ).toEqual([]);
    expect(
      readLocalLikes(fakeStorage({ [LIKES_STORAGE_KEY]: '{"a":1}' })),
    ).toEqual([]);
    expect(
      readLocalLikes(
        fakeStorage({ [LIKES_STORAGE_KEY]: '["a-soap", 42, "a-soap", ""]' }),
      ),
    ).toEqual(['a-soap']);
  });

  it('write/read round-trips', () => {
    const storage = fakeStorage();
    writeLocalLikes(storage, ['a-soap', 'b-soap']);
    expect(readLocalLikes(storage)).toEqual(['a-soap', 'b-soap']);
  });
});
