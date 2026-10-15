/**
 * Consent state machine + traffic tagging (owner spec 2026-10-14).
 * Pure rules against an in-memory StorageLike fake.
 */
import { describe, expect, it } from 'vitest';
import {
  CONSENT_STORAGE_KEY,
  TRAFFIC_TYPE_KEY,
  canCaptureDetails,
  canCountPageviews,
  chooseConsent,
  readConsentState,
  resolveTrafficType,
  withdrawConsent,
  type StorageLike,
} from './consent';

function fakeStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('consent state machine', () => {
  it('starts unknown when nothing is stored', () => {
    expect(readConsentState(fakeStorage())).toBe('unknown');
  });

  it('treats garbage in storage as unknown', () => {
    const storage = fakeStorage({ [CONSENT_STORAGE_KEY]: 'maybe' });
    expect(readConsentState(storage)).toBe('unknown');
  });

  it('accept persists and reads back', () => {
    const storage = fakeStorage();
    expect(chooseConsent(storage, 'accepted')).toBe('accepted');
    expect(readConsentState(storage)).toBe('accepted');
  });

  it('decline persists and can be changed to accept later', () => {
    const storage = fakeStorage();
    chooseConsent(storage, 'declined');
    expect(readConsentState(storage)).toBe('declined');
    chooseConsent(storage, 'accepted');
    expect(readConsentState(storage)).toBe('accepted');
  });

  it('withdraw resets to unknown and demands the side effects', () => {
    const storage = fakeStorage();
    chooseConsent(storage, 'accepted');
    const result = withdrawConsent(storage);
    expect(result.state).toBe('unknown');
    expect(result.wipeInterests).toBe(true);
    expect(result.posthogOptOut).toBe(true);
    expect(readConsentState(storage)).toBe('unknown');
  });

  it('detail capture is allowed only when accepted', () => {
    expect(canCaptureDetails('accepted')).toBe(true);
    expect(canCaptureDetails('unknown')).toBe(false);
    expect(canCaptureDetails('declined')).toBe(false);
  });

  it('page counts are allowed unless declined', () => {
    expect(canCountPageviews('accepted')).toBe(true);
    expect(canCountPageviews('unknown')).toBe(true);
    expect(canCountPageviews('declined')).toBe(false);
  });
});

describe('traffic-type tagging', () => {
  it('defaults to real', () => {
    expect(resolveTrafficType({ search: '', session: fakeStorage() })).toBe(
      'real',
    );
  });

  it('?aa_test=1 tags the visit as test and persists for the session', () => {
    const session = fakeStorage();
    expect(resolveTrafficType({ search: '?aa_test=1', session })).toBe('test');
    expect(session.getItem(TRAFFIC_TYPE_KEY)).toBe('test');
    // Later pages in the same session stay tagged without the parameter.
    expect(resolveTrafficType({ search: '', session })).toBe('test');
  });

  it('an unrelated parameter does not tag test traffic', () => {
    expect(
      resolveTrafficType({ search: '?utm=x', session: fakeStorage() }),
    ).toBe('real');
  });
});
