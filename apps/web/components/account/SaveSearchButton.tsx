/**
 * "Save this search" — the explicit save action for searches
 * (Phase 3 Step 3).
 *
 * Searching itself records nothing server-side; only this deliberate
 * tap saves, and only for a signed-in profile. Signed-out visitors get
 * a pointer to /account instead of a silent no-op.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { saveSearchToProfile } from '../../lib/accounts/client';
import styles from './account.module.css';

type State = 'idle' | 'saving' | 'saved' | 'signin' | 'error';

export function SaveSearchButton({
  query,
  surface,
}: {
  query: string;
  surface: 'catalog' | 'herbs';
}) {
  const [state, setState] = useState<State>('idle');
  const trimmed = query.trim();
  if (trimmed.length < 2) return null;

  if (state === 'signin') {
    return (
      <p className={styles.meta}>
        <Link href="/account">Sign in</Link> to save this search to your
        profile.
      </p>
    );
  }
  if (state === 'saved') {
    return <p className={styles.meta}>✦ Saved to your profile.</p>;
  }

  return (
    <button
      type="button"
      className={styles.saveSearchBtn}
      disabled={state === 'saving'}
      onClick={async () => {
        setState('saving');
        const outcome = await saveSearchToProfile(trimmed, surface);
        setState(
          outcome === 'saved' ? 'saved' : outcome === 'signin' ? 'signin' : 'error',
        );
      }}
    >
      {state === 'saving'
        ? 'Saving…'
        : state === 'error'
          ? 'Save didn’t land — try again'
          : '✦ Save this search'}
    </button>
  );
}
