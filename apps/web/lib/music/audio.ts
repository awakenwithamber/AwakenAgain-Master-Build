/**
 * WORKSTREAM B — ambient music lifecycle for Amber's Alchemy Apothecary.
 *
 * Fidelity target: the Netlify site's #bgMusic behaviour
 * (docs/launch-readiness/NETLIFY_SOURCE_OF_TRUTH.md §1–§2).
 *
 * HARD RULES (do not weaken):
 * - NEVER autoplay. Playback starts only from an explicit user gesture:
 *   "Get the Full Experience" (entry gate) or the nav toggle / volume slider.
 * - Music *choice* is NOT persisted across sessions — the entry gate
 *   reappears on every new visit. WITHIN a session the on/off intent IS
 *   kept in sessionStorage (audit 2026-10-15 GAP-3): a full-page load
 *   (refresh, typed URL) used to kill playback permanently because the
 *   fresh engine booted with intent off. Now a restored "on" intent
 *   re-arms playback on the visitor's FIRST gesture in the new document
 *   — still never audible autoplay.
 * - Volume IS persisted to localStorage['siteVolume'] (0–100 slider scale).
 * - Fade-in target: stored volume if present, capped at 12%; default 7%.
 * - RESTORED volume is clamped to the same gentle cap (Experience
 *   Package 1, 2026-11-08): a stale loud value saved by an old session
 *   (or by the pre-fix uncapped slider) can never come back as the
 *   slider's starting position — the visitor raises it deliberately,
 *   in this session, or not at all.
 * - Slider moves and mute/unmute RAMP the gain (never an instant jump);
 *   sliding above 0 resumes playback under the same ramp.
 * - Tab hidden → pause. pagehide → pause + unload the audio source.
 */
import { AUDIO } from '../media/image-paths';

/** localStorage key for the persisted volume slider value (0–100). */
export const VOLUME_STORAGE_KEY = 'siteVolume';
/** sessionStorage key for the session-scoped music intent ('on' | 'off'). */
export const INTENT_STORAGE_KEY = 'aaMusicIntent';
/** Fade-in target when no stored volume exists. */
export const DEFAULT_VOLUME_PERCENT = 7;
/** Stored volumes are honoured but capped at this percent for the fade-in. */
export const MAX_VOLUME_PERCENT = 12;
/** "Get the Full Experience" fades 0 → target over ~4s… */
export const FADE_DURATION_MS = 4000;
/** …in this many steps (matches the Netlify implementation). */
export const FADE_STEPS = 33;
/** Slider-driven volume changes ramp over this long — no instant jumps. */
export const SLIDER_FADE_DURATION_MS = 600;
/** …in this many steps. */
export const SLIDER_FADE_STEPS = 12;
/** Mute/unmute ramps are quicker — a near-immediate but soft duck/restore. */
export const MUTE_FADE_DURATION_MS = 250;
/** …in this many steps. */
export const MUTE_FADE_STEPS = 5;

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
  /** sessionStorage (session-scoped intent) — separate from `storage`. */
  sessionStorage?: KeyValueStorage | null;
  documentRef: DocumentLike | null;
  windowRef: WindowLike | null;
}

/**
 * Read the session-scoped music intent: 'on' | 'off' | null (no choice
 * made this session, or storage unavailable).
 */
export function readStoredIntent(
  session: KeyValueStorage | null | undefined,
): 'on' | 'off' | null {
  if (!session) return null;
  try {
    const raw = session.getItem(INTENT_STORAGE_KEY);
    return raw === 'on' || raw === 'off' ? raw : null;
  } catch {
    return null;
  }
}

/** Persist the session-scoped intent. Never throws. */
export function writeStoredIntent(
  session: KeyValueStorage | null | undefined,
  intent: 'on' | 'off',
): void {
  if (!session) return;
  try {
    session.setItem(INTENT_STORAGE_KEY, intent);
  } catch {
    /* storage unavailable — intent simply isn't restored after full loads */
  }
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
 * Resolve the gentle volume for a restore or fade-in: the stored
 * preference honoured, capped at 12%; default 7%. Used for the
 * "Get the Full Experience" fade-in target AND for the slider's
 * initial position, so a stale loud stored value is clamped before
 * it can ever be displayed or heard (Package 1, 2026-11-08).
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
  /** Muted via the explicit mute control (gain ducked to 0; playback continues). */
  muted: boolean;
}

type SnapshotListener = (snapshot: MusicStateSnapshot) => void;

export class MusicEngine {
  private audio: AudioElementLike | null = null;
  private sourceLoaded = false;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private volumePercent: number;
  private muted = false;
  private intentOn = false;
  private actuallyPlaying = false;
  private lifecycleBound = false;
  private boundVisibility: (() => void) | null = null;
  private boundPageHide: (() => void) | null = null;
  private boundGesture: (() => void) | null = null;
  private listeners = new Set<SnapshotListener>();
  private snapshot: MusicStateSnapshot;

  constructor(private readonly deps: MusicEngineDeps) {
    // Restore CLAMP (Package 1, 2026-11-08): the slider boots at the
    // gentle capped value — never at a stale loud stored preference.
    // Playback itself still only ever starts from a gesture, faded.
    this.volumePercent = resolveTargetVolume(readStoredVolume(deps.storage));
    // Restore the SESSION intent (audit GAP-3): after a full-page load the
    // visitor's earlier "music on" choice survives; playback itself only
    // resumes on their first gesture (see initLifecycle) — never autoplay.
    this.intentOn = readStoredIntent(deps.sessionStorage) === 'on';
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
      muted: this.muted,
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

  /**
   * Ramp the element gain from wherever it is now to the target over
   * the given duration — the single mechanism behind every volume
   * transition (gate fade-in, slider moves, mute/unmute), so the level
   * NEVER jumps instantly (Package 1, 2026-11-08).
   */
  private rampVolumeTo(targetPercent: number, durationMs: number, steps: number): void {
    const audio = this.audio;
    if (!audio) return;
    this.cancelFade();
    const startGain = audio.volume;
    const gainTarget = percentToGain(targetPercent);
    if (steps <= 1 || durationMs <= 0 || startGain === gainTarget) {
      audio.volume = gainTarget;
      return;
    }
    let step = 0;
    const stepMs = durationMs / steps;
    this.fadeTimer = setInterval(() => {
      step += 1;
      const el = this.audio;
      if (!el) {
        this.cancelFade();
        return;
      }
      el.volume = startGain + ((gainTarget - startGain) * step) / steps;
      if (step >= steps) {
        el.volume = gainTarget;
        this.cancelFade();
        this.emit();
      }
    }, stepMs);
  }

  private startFade(targetPercent: number): void {
    this.rampVolumeTo(targetPercent, FADE_DURATION_MS, FADE_STEPS);
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
    // A fresh start is never muted — the fade-in must be audible.
    this.muted = false;
    writeStoredIntent(this.deps.sessionStorage, 'on');
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

  /** Nav toggle OFF. Persisted for the session only — never across visits. */
  disable(): void {
    this.cancelFade();
    this.intentOn = false;
    writeStoredIntent(this.deps.sessionStorage, 'off');
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
   * The gain RAMPS to the new level over SLIDER_FADE_DURATION_MS —
   * it never jumps instantly (Package 1, 2026-11-08). A deliberate
   * slider move also clears any mute: the visitor is taking direct
   * control of the level.
   */
  setVolumeFromSlider(percent: number): void {
    const next = clampVolumePercent(percent);
    this.cancelFade();
    this.volumePercent = next;
    this.muted = false;
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
    writeStoredIntent(this.deps.sessionStorage, 'on');
    const wasPlaying = this.actuallyPlaying;
    this.actuallyPlaying = true; // optimistic; corrected below if refused
    this.emit();
    if (wasPlaying) {
      // Already audible: start the ramp now rather than waiting on the
      // (already-resolved) play() promise below.
      this.rampVolumeTo(next, SLIDER_FADE_DURATION_MS, SLIDER_FADE_STEPS);
    }
    void audio.play().then(
      () => {
        this.actuallyPlaying = true;
        // Resume-from-pause path: ramp from the element's current
        // (silent or stale) gain to the chosen level.
        this.rampVolumeTo(next, SLIDER_FADE_DURATION_MS, SLIDER_FADE_STEPS);
        this.emit();
      },
      () => {
        this.actuallyPlaying = false;
        this.emit();
      },
    );
  }

  /**
   * Explicit mute (Package 1, 2026-11-08): duck the gain to 0 over
   * MUTE_FADE_DURATION_MS while playback continues — standard mute
   * semantics, distinct from the on/off toggle. The slider level
   * itself is untouched, so unmute returns to exactly that level.
   */
  mute(): void {
    if (this.muted) return;
    this.muted = true;
    if (this.audio && this.actuallyPlaying) {
      this.rampVolumeTo(0, MUTE_FADE_DURATION_MS, MUTE_FADE_STEPS);
    }
    this.emit();
  }

  /** Undo mute(): ramp back to the current slider level. */
  unmute(): void {
    if (!this.muted) return;
    this.muted = false;
    if (this.audio && this.actuallyPlaying) {
      this.rampVolumeTo(this.volumePercent, MUTE_FADE_DURATION_MS, MUTE_FADE_STEPS);
    }
    this.emit();
  }

  toggleMute(): void {
    if (this.muted) {
      this.unmute();
    } else {
      this.mute();
    }
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
    // Session-intent restore (audit GAP-3): this document was freshly
    // loaded and the visitor had music ON. Browsers forbid audible
    // autoplay, so re-arm on the FIRST gesture anywhere in the document;
    // the gesture itself makes play() legal, and enable() fades in from
    // silence at the capped gentle volume.
    if (this.intentOn && !this.actuallyPlaying) {
      this.armGestureResume();
    }
  }

  /**
   * One-shot resume on the visitor's next gesture, for the moments when
   * playback is wanted (intent on) but cannot start right now: a fresh
   * document whose session intent was restored (GAP-3), or a return to
   * the tab after pagehide unloaded the source and the browser refused
   * a direct resume. The gesture itself makes play() legal — this never
   * autoplays. Idempotent: at most one listener pair is ever armed.
   */
  private armGestureResume(): void {
    const { windowRef } = this.deps;
    if (!windowRef || this.boundGesture) return;
    this.boundGesture = () => {
      this.disarmGestureResume();
      if (this.intentOn && !this.actuallyPlaying) void this.enable();
    };
    windowRef.addEventListener('pointerdown', this.boundGesture);
    windowRef.addEventListener('keydown', this.boundGesture);
  }

  private disarmGestureResume(): void {
    const { windowRef } = this.deps;
    if (this.boundGesture && windowRef) {
      windowRef.removeEventListener('pointerdown', this.boundGesture);
      windowRef.removeEventListener('keydown', this.boundGesture);
    }
    this.boundGesture = null;
  }

  destroy(): void {
    const { documentRef, windowRef } = this.deps;
    if (this.boundVisibility && documentRef) {
      documentRef.removeEventListener('visibilitychange', this.boundVisibility);
    }
    if (this.boundPageHide && windowRef) {
      windowRef.removeEventListener('pagehide', this.boundPageHide);
    }
    this.disarmGestureResume();
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
    if (!this.intentOn || this.actuallyPlaying || !this.audio) {
      return Promise.resolve();
    }
    if (!this.sourceLoaded) {
      // pagehide unloaded the source while the tab was away — e.g. the
      // visitor switched to their mail app to fetch a sign-in code
      // (owner report 2026-11-02: the music never came back). Reload
      // the source and try to resume below; if the browser refuses
      // without a fresh gesture, the armed gesture resume brings the
      // music back on the visitor's next tap or keypress instead of
      // leaving it dead until the nav toggle.
      this.ensureAudio();
      this.armGestureResume();
    }
    const audio = this.audio;
    return audio.play().then(
      () => {
        this.disarmGestureResume();
        this.actuallyPlaying = true;
        this.emit();
      },
      () => {
        // Still blocked: stay armed for the next gesture (when this
        // resume followed a pagehide unload) — the nav toggle also
        // lets the user retry at any time.
        this.armGestureResume();
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
  let sessionStorage: KeyValueStorage | null = null;
  if (hasWindow) {
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    try {
      sessionStorage = window.sessionStorage;
    } catch {
      sessionStorage = null;
    }
  }
  return {
    createAudioElement: () => {
      // loop/preload are enforced by MusicEngine.ensureAudio(); the factory
      // only needs to supply the element.
      return document.createElement('audio');
    },
    storage,
    sessionStorage,
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
