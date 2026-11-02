/**
 * Tests — entry auth gate sequencing (2026-10-31).
 * Laws: the guest flow dismisses the gate and stays on the site
 * (guests can browse and buy); sign-in / create-account both route
 * to the existing /account email-code flow; the music gate may only
 * show after the auth gate was dismissed this session.
 */
import { describe, expect, it } from 'vitest';
import {
  AUTH_GATE_DISMISSED_KEY,
  authGateDismissed,
  dismissAuthGate,
  entryGateDestination,
  musicGateMayShow,
  type EntryGateStorage,
} from './entry-gate';

function fakeStorage(initial: Record<string, string> = {}): EntryGateStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

describe('entry gate destinations', () => {
  it('sign in and create account both go to /account (no password flow exists)', () => {
    expect(entryGateDestination('sign_in')).toBe('/account');
    expect(entryGateDestination('create_account')).toBe('/account');
  });

  it('guest stays on the site (null destination)', () => {
    expect(entryGateDestination('guest')).toBeNull();
  });
});

describe('guest flow + music sequencing', () => {
  it('before any choice: auth gate undismissed, music gate must wait', () => {
    const storage = fakeStorage();
    expect(authGateDismissed(storage)).toBe(false);
    expect(musicGateMayShow(storage)).toBe(false);
  });

  it('guest dismissal releases the music gate', () => {
    const storage = fakeStorage();
    // The guest choice: dismiss, stay (null destination), music follows.
    dismissAuthGate(storage);
    expect(entryGateDestination('guest')).toBeNull();
    expect(authGateDismissed(storage)).toBe(true);
    expect(musicGateMayShow(storage)).toBe(true);
  });

  it('a dismissal recorded in a prior session view still releases music', () => {
    const storage = fakeStorage({ [AUTH_GATE_DISMISSED_KEY]: '1' });
    expect(musicGateMayShow(storage)).toBe(true);
  });

  it('unreadable storage: auth gate first, music waits', () => {
    expect(authGateDismissed(null)).toBe(false);
    expect(musicGateMayShow(null)).toBe(false);
    const throwing: EntryGateStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(authGateDismissed(throwing)).toBe(false);
    expect(musicGateMayShow(throwing)).toBe(false);
    expect(() => dismissAuthGate(throwing)).not.toThrow();
  });
});
