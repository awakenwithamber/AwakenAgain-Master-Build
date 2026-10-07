/**
 * Welcome video — framed Vimeo player with a mute toggle.
 * Autoplay is OFF. The toggle drives the player via Vimeo's postMessage API
 * (setVolume) — no external player SDK needed.
 */
'use client';

import { useRef, useState } from 'react';
import styles from './home.module.css';

const VIMEO_URL = 'https://player.vimeo.com/video/1171942742';

export function WelcomeVideo() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(false);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    const win = iframeRef.current?.contentWindow;
    if (win) {
      win.postMessage(
        JSON.stringify({ method: 'setVolume', value: next ? 0 : 1 }),
        'https://player.vimeo.com',
      );
    }
  };

  return (
    <section
      id="welcome-video"
      className={`${styles.section} ${styles.paneBg}`}
      aria-labelledby="welcome-video-heading"
    >
      <div className={`${styles.paneInner} ${styles.container}`}>
        <div className={styles.ornament} aria-hidden="true">
          ✦ ─────────────── ✦
        </div>
        <h2 id="welcome-video-heading" className={styles.sectionTitle}>
          A Personal Welcome
        </h2>
        <p className={styles.videoContext}>
          Discover personalized herbal remedies, handcrafted formulas, and
          plant-based solutions designed to support your body naturally.
        </p>
        <div className={styles.videoFrame}>
          <iframe
            ref={iframeRef}
            src={VIMEO_URL}
            title="Meet Amber — a personal welcome from the founder"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
          <button
            type="button"
            className={styles.muteToggle}
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? 'Unmute the welcome video' : 'Mute the welcome video'}
          >
            {muted ? '🔇 Muted' : '🔊 Unmuted'}
          </button>
        </div>
        <p className={styles.videoCaption}>
          Meet Amber — a personal welcome from the founder
        </p>
      </div>
    </section>
  );
}
