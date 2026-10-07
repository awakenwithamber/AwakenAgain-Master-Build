/**
 * WORKSTREAM B — ambient music lifecycle for Amber's Alchemy Apothecary.
 *
 * Fidelity target: the Netlify site's #bgMusic behaviour
 * (docs/launch-readiness/NETLIFY_SOURCE_OF_TRUTH.md §1–§2).
 *
 * HARD RULES (do not weaken):
 * - NEVER autoplay. Playback starts only from an explicit user gesture:
 *   "Get the Full Experience" (entry gate) or the nav toggle / volume slider.
 * - Music *choice* is NOT persisted — the entry gate reappears on every load.
 * - Volume IS persisted to localStorage['siteVolume'] (0–100 slider scale).
 * - Fade-in target: stored volume if present, capped at 12%; default 7%.
 * - Tab hidden → pause. pagehide → pause + unload the audio source.
 */
import { AUDIO } from '../media/image-paths';

/** localStorage key for the persisted volume slider value (0–100). */
export const VOLUME_STORAGE_KEY = 'siteVolume';
/** Fade-in target when no stored volume exists. */
export const DEFAULT_VOLUME_PERCENT = 7;
/** Stored volumes are honoured but capped at this percent for the fade-in. */
export const MAX_VOLUME_PERCENT = 12;
/** "Get the Full Experience" fades 0 → target over ~4s… */
export const FADE_DURATION_MS = 4000;
/** …in this many steps (matches the Netlify implementation). */
export const FADE_STEPS = 33;

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Minimal audio-element surface the engine drives. HTMLAudioElement satisfies it. */
export interface AudioElementLike {
  src: string;
  loop: boolean;
  preload: string;
  volume: number;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
}

export interface DocumentLike {
  readonly hidden: boolean;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface WindowLike {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface MusicEngineDeps {
  createAudioElement: () => AudioElementLike;
  storage: KeyValueStorage | null;
  documentRef: DocumentLike | null;
  windowRef: WindowLike | null;
}

export function clampVolumePercent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME_PERCENT;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Read the persisted slider value (0–100), or null when absent/invalid. */
export function readStoredVolume(storage: KeyValueStorage | null | undefined): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(VOLUME_STORAGE_KEY);
    if (raw === null || raw.trim() === '') return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    return clampVolumePercent(parsed);
  } catch {
    return null;
  }
}

/** Persist the slider value (0–100). Never throws. */
export function writeStoredVolume(
  storage: KeyValueStorage | null | undefined,
  volumePercent: number,
): void {
  if (!storage) return;
  try {
    storage.setItem(VOLUME_STORAGE_KEY, String(clampVolumePercent(volumePercent)));
  } catch {
    /* storage unavailable (private mode, SSR) — volume simply isn't persisted */
  }
}

/**
 * Resolve the fade-in target for "Get the Full Experience":
 * stored preference honoured, capped at 12%; default 7%.
 */
export function resolveTargetVolume(storedPercent: number | null): number {
  if (storedPercent === null || storedPercent === undefined) return DEFAULT_VOLUME_PERCENT;
  return Math.min(clampVolumePercent(storedPercent), MAX_VOLUME_PERCENT);
}

/** Slider percent (0–100) → HTMLAudioElement gain (0–1). */
export function percentToGain(percent: number): number {
  return clampVolumePercent(percent) / 100;
}

export interface MusicStateSnapshot {
  /** User intent: music wanted on (gate choice or nav toggle). */
  enabled: boolean;
  /** Actually audible right now. */
  playing: boolean;
  /** Current slider volume, 0–100. */
  volumePercent: number;
}

type SnapshotListener = (snapshot: MusicStateSnapshot) => void;

export class MusicEngine {
  private audio: AudioElementLike | null = null;
  private sourceLoaded = false;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private volumePercent: number;
  private intentOn = false;
  private actuallyPlaying = false;
  private lifecycleBound = false;
  private boundVisibility: (() => void) | null = null;
  private boundPageHide: (() => void) | null = null;
  private listeners = new Set<SnapshotListener>();
  private snapshot: MusicStateSnapshot;

  constructor(private readonly deps: MusicEngineDeps) {
    this.volumePercent = clampVolumePercent(
      readStoredVolume(deps.storage) ?? DEFAULT_VOLUME_PERCENT,
    );
    this.snapshot = this.buildSnapshot();
  }

  /* ------------------------------ state ------------------------------ */

  getSnapshot(): MusicStateSnapshot {
    return this.snapshot;
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private buildSnapshot(): MusicStateSnapshot {
    return {
      enabled: this.intentOn,
      playing: this.actuallyPlaying,
      volumePercent: this.volumePercent,
    };
  }

  private emit(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(this.snapshot);
      } catch {
        /* a listener must never break playback */
      }
    }
  }

  /* ------------------------------ audio ------------------------------ */

  private ensureAudio(): void {
    if (!this.audio) {
      this.audio = this.deps.createAudioElement();
      // Netlify-fidelity element config, enforced here so every factory
      // (real DOM or test fake) produces the same element.
      this.audio.loop = true;
      this.audio.preload = 'auto';
    }
    if (!this.sourceLoaded) {
      this.audio.src = AUDIO.ambientApothecary;
      this.audio.load();
      this.sourceLoaded = true;
    }
  }

  private cancelFade(): void {
    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private startFade(targetPercent: number): void {
    const audio = this.audio;
    if (!audio) return;
    const gainTarget = percentToGain(targetPercent);
    let step = 0;
    const stepMs = FADE_DURATION_MS / FADE_STEPS;
    this.fadeTimer = setInterval(() => {
      step += 1;
      const el = this.audio;
      if (!el) {
        this.cancelFade();
        return;
      }
      el.volume = Math.min((gainTarget * step) / FADE_STEPS, gainTarget);
      if (step >= FADE_STEPS) {
        el.volume = gainTarget;
        this.cancelFade();
        this.emit();
      }
    }, stepMs);
  }

  /* --------------------------- public controls --------------------------- */

  /**
   * "Get the Full Experience" / nav toggle ON.
   * MUST only be called from a user gesture — never on page load.
   */
  async enable(): Promise<void> {
    if (this.intentOn && this.actuallyPlaying) return;
    this.cancelFade();
    this.ensureAudio();
    const audio = this.audio;
    if (!audio) return;

    const target = resolveTargetVolume(readStoredVolume(this.deps.storage));
    this.volumePercent = target;
    // The capped target becomes the new slider value and is persisted, so the
    // slider, the audible volume, and the stored preference never disagree.
    writeStoredVolume(this.deps.storage, target);
    this.intentOn = true;
    audio.volume = 0;
    this.emit();
    try {
      await audio.play();
    } catch {
      // Autoplay/policy refusal: stay "wanted on" but silent; the user can
      // retry from the nav toggle. Never leave a runaway fade behind.
      this.actuallyPlaying = false;
      this.emit();
      return;
    }
    this.actuallyPlaying = true;
    this.emit();
    this.startFade(target);
  }

  /** Nav toggle OFF. The choice is deliberately NOT persisted. */
  disable(): void {
    this.cancelFade();
    this.intentOn = false;
    this.actuallyPlaying = false;
    if (this.audio) this.audio.pause();
    this.emit();
  }

  toggle(): void {
    if (this.intentOn || this.actuallyPlaying) {
      this.disable();
    } else {
      void this.enable();
    }
  }

  /**
   * Volume slider (0–100). Sliding to 0 pauses; sliding above 0 resumes.
   * A slider move is a user gesture, so resuming playback is allowed.
   */
  setVolumeFromSlider(percent: number): void {
    const next = clampVolumePercent(percent);
    this.cancelFade();
    this.volumePercent = next;
    writeStoredVolume(this.deps.storage, next);

    if (next === 0) {
      this.actuallyPlaying = false;
      if (this.audio) this.audio.pause();
      this.emit();
      return;
    }

    this.ensureAudio();
    const audio = this.audio;
    if (!audio) return;
    this.intentOn = true;
    audio.volume = percentToGain(next);
    this.actuallyPlaying = true; // optimistic; corrected below if refused
    this.emit();
    void audio.play().then(
      () => {
        this.actuallyPlaying = true;
        this.emit();
      },
      () => {
        this.actuallyPlaying = false;
        this.emit();
      },
    );
  }

  /* ----------------------------- lifecycle ----------------------------- */

  /** Pause when the tab hides; pause + unload the source on pagehide. Idempotent. */
  initLifecycle(): void {
    if (this.lifecycleBound) return;
    const { documentRef, windowRef } = this.deps;
    if (!documentRef || !windowRef) return;
    this.lifecycleBound = true;
    this.boundVisibility = () => {
      if (documentRef.hidden) {
        this.suspendForHiddenTab();
      } else {
        void this.resumeForVisibleTab();
      }
    };
    this.boundPageHide = () => this.unloadForPageHide();
    documentRef.addEventListener('visibilitychange', this.boundVisibility);
    windowRef.addEventListener('pagehide', this.boundPageHide);
  }

  destroy(): void {
    const { documentRef, windowRef } = this.deps;
    if (this.boundVisibility && documentRef) {
      documentRef.removeEventListener('visibilitychange', this.boundVisibility);
    }
    if (this.boundPageHide && windowRef) {
      windowRef.removeEventListener('pagehide', this.boundPageHide);
    }
    this.boundVisibility = null;
    this.boundPageHide = null;
    this.lifecycleBound = false;
    this.cancelFade();
    if (this.audio) this.audio.pause();
    this.actuallyPlaying = false;
    this.emit();
  }

  private suspendForHiddenTab(): void {
    if (!this.actuallyPlaying) return;
    this.cancelFade();
    if (this.audio) this.audio.pause();
    this.actuallyPlaying = false; // intentOn stays true — the user still wants music
    this.emit();
  }

  private resumeForVisibleTab(): Promise<void> {
    if (!this.intentOn || this.actuallyPlaying || !this.audio || !this.sourceLoaded) {
      return Promise.resolve();
    }
    return this.audio.play().then(
      () => {
        this.actuallyPlaying = true;
        this.emit();
      },
      () => {
        /* still blocked — the nav toggle lets the user retry */
      },
    );
  }

  private unloadForPageHide(): void {
    this.cancelFade();
    const audio = this.audio;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    this.sourceLoaded = false;
    this.actuallyPlaying = false;
    this.emit();
  }
}

/* ------------------------------ singleton ------------------------------ */

function defaultBrowserDeps(): MusicEngineDeps {
  const hasWindow = typeof window !== 'undefined';
  const hasDocument = typeof document !== 'undefined';
  let storage: KeyValueStorage | null = null;
  if (hasWindow) {
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
  }
  return {
    createAudioElement: () => {
      // loop/preload are enforced by MusicEngine.ensureAudio(); the factory
      // only needs to supply the element.
      return document.createElement('audio');
    },
    storage,
    documentRef: hasDocument ? document : null,
    windowRef: hasWindow ? window : null,
  };
}

let sharedInstance: MusicEngine | null = null;

/**
 * Shared engine for the gate + nav controls. Safe to call during SSR
 * (DOM/storage access is guarded); initLifecycle() no-ops without a document.
 */
export function getMusicEngine(): MusicEngine {
  if (!sharedInstance) {
    sharedInstance = new MusicEngine(defaultBrowserDeps());
  }
  return sharedInstance;
}
