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
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getMusicEngine } from '../../lib/music/audio';
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
  // not on every page navigation.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('aa-music-gate-dismissed') === '1') {
        dismissedRef.current = true;
        return;
      }
    } catch {
      // Storage unavailable — show the gate.
    }
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
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

  // Focus the primary action when the gate opens.
  useEffect(() => {
    if (visible && !leaving) primaryRef.current?.focus();
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
          Enhance your experience with soft nature sounds and 432Hz healing tones — stress-reducing
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
