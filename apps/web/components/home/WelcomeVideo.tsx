/**
 * Welcome / intro video — Amber's own intro video (owner-ruled
 * 2026-10-30: the 231-second apothecary compilation she uploaded is
 * THE intro video). Self-hosted native player: the owner's file,
 * web-compressed (1080×1920 HEVC 39 MB → 720×1280 H.264, ~7 MB,
 * faststart) with a poster frame from its opening. Autoplay is OFF;
 * the mute toggle drives the native video element.
 */
'use client';

import { useRef, useState } from 'react';
import styles from './home.module.css';

const VIDEO_SRC = '/video/ambers-alchemy-intro.mp4';
const POSTER_SRC = '/images/video/intro-poster.jpg';

export function WelcomeVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
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
          Hey neighbors — before you wander the shelves, let Amber herself
          show you around the apothecary: the soaps, the teas, the
          capsules, the readings, and the Living Grimoire, all in her own
          words. ✨🌿
        </p>
        <div className={styles.videoFrame}>
          <video
            ref={videoRef}
            src={VIDEO_SRC}
            poster={POSTER_SRC}
            title="Meet Amber — a personal welcome from the founder"
            controls
            playsInline
            preload="none"
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
