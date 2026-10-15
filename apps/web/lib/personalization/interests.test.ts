/**
 * Interest profile scoring (owner spec 2026-10-14): consent-gated
 * accrual, per-category cap, clear-winner top interest.
 */
import { describe, expect, it } from 'vitest';
import { chooseConsent, type StorageLike } from './consent';
import {
  INTERESTS_STORAGE_KEY,
  MAX_SCORE,
  clearProfile,
  emptyProfile,
  interestForCatalogCategory,
  readProfile,
  recordInterest,
  topInterest,
} from './interests';

function fakeStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function acceptedStorage(): StorageLike {
  const storage = fakeStorage();
  chooseConsent(storage, 'accepted');
  return storage;
}

describe('interest accrual is consent-gated', () => {
  it('does not accrue while consent is unknown', () => {
    const storage = fakeStorage();
    const profile = recordInterest(storage, 'herbs', 1);
    expect(profile.herbs).toBe(0);
    expect(storage.getItem(INTERESTS_STORAGE_KEY)).toBeNull();
  });

  it('does not accrue after a decline', () => {
    const storage = fakeStorage();
    chooseConsent(storage, 'declined');
    expect(recordInterest(storage, 'soaps', 3).soaps).toBe(0);
  });

  it('accrues once accepted, with points and persistence', () => {
    const storage = acceptedStorage();
    recordInterest(storage, 'herbs', 1);
    const profile = recordInterest(storage, 'herbs', 3);
    expect(profile.herbs).toBe(4);
    expect(readProfile(storage).herbs).toBe(4);
  });

  it('caps each category at MAX_SCORE', () => {
    const storage = acceptedStorage();
    const profile = recordInterest(storage, 'quiz', MAX_SCORE + 50);
    expect(profile.quiz).toBe(MAX_SCORE);
  });

  it('ignores non-positive points', () => {
    const storage = acceptedStorage();
    expect(recordInterest(storage, 'herbs', 0).herbs).toBe(0);
    expect(recordInterest(storage, 'herbs', -2).herbs).toBe(0);
  });

  it('clearProfile wipes the stored profile', () => {
    const storage = acceptedStorage();
    recordInterest(storage, 'grimoire', 5);
    clearProfile(storage);
    expect(readProfile(storage)).toEqual(emptyProfile());
  });

  it('reads corrupt stored data as an empty profile', () => {
    const storage = fakeStorage({ [INTERESTS_STORAGE_KEY]: '{not json' });
    expect(readProfile(storage)).toEqual(emptyProfile());
  });
});

describe('topInterest', () => {
  it('is null with no signal', () => {
    expect(topInterest(emptyProfile())).toBeNull();
  });

  it('is null below the minimum score', () => {
    const profile = { ...emptyProfile(), herbs: 2 };
    expect(topInterest(profile)).toBeNull();
  });

  it('returns the clear leader at or above the minimum', () => {
    const profile = { ...emptyProfile(), herbs: 5, soaps: 3 };
    expect(topInterest(profile)).toBe('herbs');
  });

  it('is null on a tie for first place', () => {
    const profile = { ...emptyProfile(), herbs: 5, soaps: 5 };
    expect(topInterest(profile)).toBeNull();
  });
});

describe('interestForCatalogCategory', () => {
  it('maps the catalog vocabulary', () => {
    expect(interestForCatalogCategory('Soaps')).toBe('soaps');
    expect(interestForCatalogCategory('Capsules')).toBe('herbs');
    expect(interestForCatalogCategory('Teas')).toBe('herbs');
    expect(interestForCatalogCategory('Services')).toBe('readings');
    expect(interestForCatalogCategory('Grimoire & Digital')).toBe('grimoire');
    expect(interestForCatalogCategory('Bundles')).toBeNull();
    expect(interestForCatalogCategory(undefined)).toBeNull();
  });
});
