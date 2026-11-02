/**
 * Entry auth gate — pure sequencing logic (staged build, 2026-10-31).
 *
 * Visit order on the site is: entry auth gate → music gate → site.
 * This module owns the testable half of that sequence — the storage
 * keys and the "may the music gate show yet?" decision — with no
 * DOM or React in it, mirroring how MusicGate keeps its own key.
 *
 * Laws:
 * - The auth gate is an OFFER, never a wall: guests dismiss it and
 *   can browse and buy; signing in is always optional.
 * - Dismissal is per browser session (sessionStorage), so the gate
 *   shows once per visit, not on every navigation.
 * - Accounts are the existing /account email-code flow: a first-time
 *   email creates the account there. No password exists in this
 *   flow and none is introduced here.
 */

export const AUTH_GATE_DISMISSED_KEY = 'aa-auth-gate-dismissed';
export const MUSIC_GATE_DISMISSED_KEY = 'aa-music-gate-dismissed';
export const AUTH_GATE_DONE_EVENT = 'aa:auth-gate-done';

export type EntryGateChoice = 'sign_in' | 'create_account' | 'guest';

export interface EntryGateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Where each choice sends the visitor. Sign-in and create-account share the /account email-code flow. */
export function entryGateDestination(choice: EntryGateChoice): string | null {
  switch (choice) {
    case 'sign_in':
    case 'create_account':
      return '/account';
    case 'guest':
      return null;
  }
}

/** True once the visitor has dismissed the auth gate this session. */
export function authGateDismissed(storage: EntryGateStorage | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(AUTH_GATE_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Record dismissal; storage failures degrade to "this view only". */
export function dismissAuthGate(storage: EntryGateStorage | null): void {
  if (!storage) return;
  try {
    storage.setItem(AUTH_GATE_DISMISSED_KEY, '1');
  } catch {
    // Storage unavailable — the component still dismisses in-memory.
  }
}

/**
 * The sequencing law: the music gate may only appear after the auth
 * gate has been dismissed (any choice — sign-in, create, or guest).
 * When storage is unreadable the auth gate shows first, so music
 * waits (false) rather than racing ahead of it.
 */
export function musicGateMayShow(storage: EntryGateStorage | null): boolean {
  if (!storage) return false;
  return authGateDismissed(storage);
}
