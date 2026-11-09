'use client';

/**
 * WORKSTREAM B — entry-gate music choice modal.
 *
 * Fidelity target: NETLIFY_SOURCE_OF_TRUTH.md §1 (exact copy/behaviour).
 * - Appears on EVERY page load after a 600ms delay (no persistence).
 * - Dismiss animates out over 400ms.
 * - "Get the Full Experience" is the ONLY path that starts playback —
 *   audio is NEVER autoplayed.
 *
 * Wiring (coordinator): render <MusicGate /> once inside <body> in
 * app/layout.tsx. Do not render it anywhere else.
 *
 * Sequencing (2026-10-31): the entry AUTH gate runs first. This gate
 * waits until lib/auth/entry-gate says the auth gate was dismissed
 * (AUTH_GATE_DONE_EVENT, with a storage poll as fallback) before its
 * show timer starts — the two modals never appear at once.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getMusicEngine } from '../../lib/music/audio';
import {
  AUTH_GATE_DONE_EVENT,
  musicGateMayShow,
} from '../../lib/auth/entry-gate';
import styles from './music.module.css';

const SHOW_DELAY_MS = 600;
const DISMISS_MS = 400;

export function MusicGate() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dismissedRef = useRef(false);

  // Remember dismissal for the session: the gate appears once per visit,
  // not on every page navigation. Sequencing: wait for the entry auth
  // gate to be dismissed first (event + poll fallback), then start the
  // usual show delay.
  useEffect(() => {
    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }
    try {
      if (storage?.getItem('aa-music-gate-dismissed') === '1') {
        dismissedRef.current = true;
        return;
      }
    } catch {
      // Storage unavailable — sequencing still applies via the event.
    }
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      if (poll) clearInterval(poll);
      showTimer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    };
    if (musicGateMayShow(storage)) {
      release();
    } else {
      window.addEventListener(AUTH_GATE_DONE_EVENT, release);
      poll = setInterval(() => {
        if (musicGateMayShow(storage)) release();
      }, 250);
    }
    return () => {
      window.removeEventListener(AUTH_GATE_DONE_EVENT, release);
      if (poll) clearInterval(poll);
      if (showTimer) clearTimeout(showTimer);
    };
  }, []);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    try {
      window.sessionStorage.setItem('aa-music-gate-dismissed', '1');
    } catch {
      // Storage unavailable — dismiss for this view only.
    }
    setLeaving(true);
    setTimeout(() => setVisible(false), DISMISS_MS);
  }, []);

  const chooseFullExperience = useCallback(() => {
    // User gesture → play() is permitted. Never called automatically.
    void getMusicEngine().enable();
    dismiss();
  }, [dismiss]);

  // Focus the primary action when the gate opens. preventScroll: the
  // overlay is position:fixed, but on mobile browsers a bare focus()
  // can scroll the document underneath (Package 1, 2026-11-08).
  useEffect(() => {
    if (visible && !leaving) primaryRef.current?.focus({ preventScroll: true });
  }, [visible, leaving]);

  // Escape dismisses (= "Browse without Music"); Tab cycles inside the dialog.
  useEffect(() => {
    if (!visible || leaving) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'),
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
        aria-labelledby="music-gate-title"
        aria-describedby="music-gate-sub"
      >
        <div className={styles.gateOrnament} aria-hidden="true">
          ✦ ✦ ✦
        </div>
        <h2 id="music-gate-title" className={styles.gateTitle}>
          Welcome to the Apothecary
        </h2>
        <p id="music-gate-sub" className={styles.gateSub}>
          Enhance your experience with soft nature sounds and 432Hz tones — calming
          music to accompany you as you explore the apothecary.
        </p>
        <div className={styles.gateActions}>
          <button
            ref={primaryRef}
            type="button"
            className={styles.gatePrimary}
            onClick={chooseFullExperience}
          >
            ✦ Get the Full Experience
          </button>
          <button type="button" className={styles.gateGhost} onClick={dismiss}>
            Browse without Music
          </button>
        </div>
        <p className={styles.gateNote}>
          You can toggle music on or off at any time from the navigation bar.
        </p>
      </div>
    </div>
  );
}
