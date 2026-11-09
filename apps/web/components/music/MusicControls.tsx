'use client';

/**
 * WORKSTREAM B — persistent music controls for the navigation bar.
 *
 * Fidelity target: NETLIFY_SOURCE_OF_TRUTH.md §1 (.audio-controls).
 * - Toggle: "♪ OFF" → "♪ ON" with a .playing class; tooltips "Turn music on/off".
 * - Volume slider: input[type=range], min 0, max 100, default 7, persisted.
 * - Sliding to 0 pauses; sliding above 0 resumes (gain ramps, never jumps).
 * - Package 1 (2026-11-08): explicit Mute/Unmute button + a visible
 *   percentage readout beside the (widened) slider; the slider boots
 *   at the gentle capped value, never a stale loud stored level.
 *
 * Wiring (coordinator): render <MusicControls /> inside the header chrome
 * (components/layout/Header.tsx) next to the search/cart controls. Shares the
 * singleton MusicEngine with <MusicGate />.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getMusicEngine,
  DEFAULT_VOLUME_PERCENT,
  type MusicStateSnapshot,
} from '../../lib/music/audio';
import styles from './music.module.css';

/** Static snapshot for SSR prerendering (music is never on server-side). */
const SERVER_SNAPSHOT: MusicStateSnapshot = {
  enabled: false,
  playing: false,
  volumePercent: DEFAULT_VOLUME_PERCENT,
  muted: false,
};

export function MusicControls() {
  const [engine] = useState(() => getMusicEngine());

  useEffect(() => {
    engine.initLifecycle();
  }, [engine]);

  const snapshot = useSyncExternalStore(
    (onChange) => engine.subscribe(onChange),
    () => engine.getSnapshot(),
    () => SERVER_SNAPSHOT,
  );

  const playing = snapshot.playing;
  const muted = snapshot.muted;

  return (
    <div className={styles.controls} role="group" aria-label="Ambient music controls">
      <button
        type="button"
        className={`${styles.toggle} ${playing ? styles.playing : ''}`}
        aria-pressed={playing}
        title={playing ? 'Turn music off' : 'Turn music on'}
        onClick={() => engine.toggle()}
      >
        ♪ {playing ? 'ON' : 'OFF'}
      </button>
      <button
        type="button"
        className={`${styles.mute} ${muted ? styles.muted : ''}`}
        aria-pressed={muted}
        aria-label={muted ? 'Unmute music' : 'Mute music'}
        title={muted ? 'Unmute music' : 'Mute music'}
        onClick={() => engine.toggleMute()}
      >
        {muted ? 'Unmute' : 'Mute'}
      </button>
      <input
        type="range"
        className={styles.slider}
        min={0}
        max={100}
        step={1}
        value={snapshot.volumePercent}
        onChange={(event) => engine.setVolumeFromSlider(Number(event.target.value))}
        aria-label="Music volume"
        title="Music volume"
      />
      <span className={styles.volumeReadout} aria-hidden="true">
        {snapshot.volumePercent}%
      </span>
    </div>
  );
}
