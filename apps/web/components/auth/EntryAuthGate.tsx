'use client';

/**
 * Entry sign-in gate — runs BEFORE the music gate (staged, 2026-10-31).
 *
 * First thing a visitor sees on a visit, once per session:
 * - Sign in → the existing /account email-code sign-in.
 * - Create account → the same /account flow (a first-time email
 *   creates the account there; this site has no password sign-in
 *   and this gate never asks for one).
 * - Continue as guest → dismisses and browses freely; guests can
 *   browse and buy, and can sign in later from /account.
 *
 * Dismissing by ANY choice records the session dismissal and fires
 * AUTH_GATE_DONE_EVENT, which is what releases the MusicGate — so
 * the order is always auth gate → music gate → site, never both
 * modals at once. Escape = Continue as guest.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AUTH_GATE_DONE_EVENT,
  authGateDismissed,
  dismissAuthGate,
  entryGateDestination,
  type EntryGateChoice,
} from '../../lib/auth/entry-gate';
import styles from './entry-auth-gate.module.css';

const SHOW_DELAY_MS = 300;
const DISMISS_MS = 400;

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function EntryAuthGate() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (authGateDismissed(sessionStore())) {
      dismissedRef.current = true;
      return;
    }
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = useCallback((choice: EntryGateChoice) => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    dismissAuthGate(sessionStore());
    // Release the music gate, whatever the choice was.
    try {
      window.dispatchEvent(new Event(AUTH_GATE_DONE_EVENT));
    } catch {
      // Event dispatch unavailable — MusicGate also polls storage.
    }
    const destination = entryGateDestination(choice);
    if (destination) {
      // Navigating to /account: no fade needed, the page changes.
      window.location.assign(destination);
      return;
    }
    setLeaving(true);
    setTimeout(() => setVisible(false), DISMISS_MS);
  }, []);

  useEffect(() => {
    if (visible && !leaving) primaryRef.current?.focus();
  }, [visible, leaving]);

  // Escape = guest; Tab cycles inside the dialog.
  useEffect(() => {
    if (!visible || leaving) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss('guest');
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, leaving, dismiss]);

  if (!visible) return null;

  return (
    <div className={`${styles.gateOverlay} ${leaving ? styles.gateLeaving : ''}`}>
      <div
        ref={dialogRef}
        className={styles.gateDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-gate-title"
        aria-describedby="auth-gate-sub"
      >
        <div className={styles.gateOrnament} aria-hidden="true">
          ✦ ✦ ✦
        </div>
        <h2 id="auth-gate-title" className={styles.gateTitle}>
          Welcome to the Apothecary
        </h2>
        <p id="auth-gate-sub" className={styles.gateSub}>
          Sign in with an email code — no password — to keep your herbal
          allies, likes, and orders in your own profile. New here? The
          same sign-in creates your account. Or simply continue as a
          guest; you can browse and buy either way.
        </p>
        <div className={styles.gateActions}>
          <a
            ref={primaryRef}
            className={styles.gatePrimary}
            href="/account"
            onClick={(e) => {
              e.preventDefault();
              dismiss('sign_in');
            }}
          >
            ✦ Sign In
          </a>
          <a
            className={styles.gateGhost}
            href="/account"
            onClick={(e) => {
              e.preventDefault();
              dismiss('create_account');
            }}
          >
            Create Account
          </a>
          <button
            type="button"
            className={styles.gateGhost}
            onClick={() => dismiss('guest')}
          >
            Continue as Guest
          </button>
        </div>
        <p className={styles.gateNote}>
          Signing in never starts a membership — the Living Grimoire
          keeps its own gate, and guest checkout works as always.
        </p>
      </div>
    </div>
  );
}
