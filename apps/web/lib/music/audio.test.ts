/**
 * WORKSTREAM B — regression tests for the ambient music lifecycle.
 *
 * Guards the Netlify-fidelity contract (source of truth §1–§2):
 * - NEVER autoplay: playback starts only via enable()/toggle()/slider.
 * - Fade 0 → target over ~4s in 33 steps; default 7%, stored honoured, capped 12%.
 * - Music choice NOT persisted; volume IS persisted to localStorage['siteVolume'].
 * - visibilitychange (hidden) pauses; pagehide pauses + unloads the source.
 *
 * Runs in plain Node (no DOM, no JSX) with fake audio/storage/document/window.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_VOLUME_PERCENT,
  FADE_DURATION_MS,
  FADE_STEPS,
  MAX_VOLUME_PERCENT,
  VOLUME_STORAGE_KEY,
  MusicEngine,
  clampVolumePercent,
  percentToGain,
  readStoredVolume,
  resolveTargetVolume,
  writeStoredVolume,
  type AudioElementLike,
  type DocumentLike,
  type KeyValueStorage,
  type MusicEngineDeps,
  type WindowLike,
} from './audio';
import { AUDIO as AUDIO_CONTRACT } from '../media/image-paths';

/* ------------------------------- fakes ------------------------------- */

class FakeStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  keys(): string[] {
    return [...this.map.keys()];
  }
}

class FakeAudio implements AudioElementLike {
  src = '';
  loop = false;
  preload = '';
  playCalls = 0;
  pauseCalls = 0;
  loadCalls = 0;
  removedAttrs: string[] = [];
  rejectPlay = false;
  private _volume = 0;
  volumeSets: number[] = [];

  get volume(): number {
    return this._volume;
  }
  set volume(v: number) {
    this._volume = v;
    this.volumeSets.push(v);
  }
  async play(): Promise<void> {
    this.playCalls += 1;
    if (this.rejectPlay) throw new Error('NotAllowedError: play() failed');
  }
  pause(): void {
    this.pauseCalls += 1;
  }
  load(): void {
    this.loadCalls += 1;
  }
  removeAttribute(name: string): void {
    this.removedAttrs.push(name);
  }
}

class FakeEmitter {
  private listeners = new Map<string, Array<() => void>>();
  addEventListener(type: string, listener: () => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type: string, listener: () => void): void {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      list.filter((l) => l !== listener),
    );
  }
  fire(type: string): void {
    for (const l of this.listeners.get(type) ?? []) l();
  }
  listenerCount(type: string): number {
    return (this.listeners.get(type) ?? []).length;
  }
}

class FakeDocument extends FakeEmitter implements DocumentLike {
  hidden = false;
}
class FakeWindow extends FakeEmitter implements WindowLike {}

interface Harness {
  deps: MusicEngineDeps;
  audio: FakeAudio;
  doc: FakeDocument;
  win: FakeWindow;
  storage: FakeStorage;
}

function makeHarness(): Harness {
  const audio = new FakeAudio();
  const doc = new FakeDocument();
  const win = new FakeWindow();
  const storage = new FakeStorage();
  const deps: MusicEngineDeps = {
    createAudioElement: () => audio,
    storage,
    documentRef: doc,
    windowRef: win,
  };
  return { deps, audio, doc, win, storage };
}

async function flushMicrotasks(times = 3): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/* ------------------------------ constants ------------------------------ */

describe('music contract constants', () => {
  it('matches the Netlify-fidelity values', () => {
    expect(VOLUME_STORAGE_KEY).toBe('siteVolume');
    expect(DEFAULT_VOLUME_PERCENT).toBe(7);
    expect(MAX_VOLUME_PERCENT).toBe(12);
    expect(FADE_DURATION_MS).toBe(4000);
    expect(FADE_STEPS).toBe(33);
  });

  it('references the shared AUDIO contract path', () => {
    expect(AUDIO_CONTRACT.ambientApothecary).toBe('/audio/ambient-apothecary.mp3');
  });
});

/* -------------------------------- helpers -------------------------------- */

describe('volume helpers', () => {
  it('readStoredVolume returns null for missing/invalid storage', () => {
    expect(readStoredVolume(null)).toBeNull();
    expect(readStoredVolume(undefined)).toBeNull();
    const s = new FakeStorage();
    expect(readStoredVolume(s)).toBeNull();
    s.setItem(VOLUME_STORAGE_KEY, 'not-a-number');
    expect(readStoredVolume(s)).toBeNull();
  });

  it('readStoredVolume clamps to 0–100', () => {
    const s = new FakeStorage();
    s.setItem(VOLUME_STORAGE_KEY, '7');
    expect(readStoredVolume(s)).toBe(7);
    s.setItem(VOLUME_STORAGE_KEY, '250');
    expect(readStoredVolume(s)).toBe(100);
    s.setItem(VOLUME_STORAGE_KEY, '-5');
    expect(readStoredVolume(s)).toBe(0);
  });

  it('writeStoredVolume persists a rounded, clamped value and never throws', () => {
    const s = new FakeStorage();
    writeStoredVolume(s, 7.6);
    expect(s.getItem(VOLUME_STORAGE_KEY)).toBe('8');
    writeStoredVolume(s, 140);
    expect(s.getItem(VOLUME_STORAGE_KEY)).toBe('100');
    expect(() => writeStoredVolume(null, 7)).not.toThrow();
  });

  it('resolveTargetVolume defaults to 7, honours stored, caps at 12', () => {
    expect(resolveTargetVolume(null)).toBe(7);
    expect(resolveTargetVolume(9)).toBe(9);
    expect(resolveTargetVolume(12)).toBe(12);
    expect(resolveTargetVolume(80)).toBe(12);
    expect(resolveTargetVolume(0)).toBe(0);
  });

  it('percentToGain maps 0–100 to 0–1', () => {
    expect(percentToGain(7)).toBeCloseTo(0.07, 5);
    expect(percentToGain(0)).toBe(0);
    expect(percentToGain(100)).toBe(1);
  });

  it('clampVolumePercent guards non-finite input', () => {
    expect(clampVolumePercent(Number.NaN)).toBe(DEFAULT_VOLUME_PERCENT);
  });
});

/* --------------------------------- engine --------------------------------- */

describe('MusicEngine', () => {
  it('does NOT autoplay on construction', () => {
    const { deps, audio } = makeHarness();
    const engine = new MusicEngine(deps);
    expect(audio.playCalls).toBe(0);
    expect(engine.getSnapshot()).toEqual({
      enabled: false,
      playing: false,
      volumePercent: 7,
    });
  });

  it('initialises the slider from the stored volume', () => {
    const { deps, storage } = makeHarness();
    storage.setItem(VOLUME_STORAGE_KEY, '42');
    const engine = new MusicEngine(deps);
    expect(engine.getSnapshot().volumePercent).toBe(42);
  });

  it('enable() plays the contract audio file and fades 0 → 7% over ~4s in 33 steps', async () => {
    const { deps, audio, storage } = makeHarness();
    const engine = new MusicEngine(deps);

    await engine.enable();
    expect(audio.playCalls).toBe(1);
    expect(audio.src).toBe('/audio/ambient-apothecary.mp3');
    expect(audio.loop).toBe(true);
    expect(audio.preload).toBe('auto');
    expect(audio.volume).toBe(0); // fade starts at silence

    vi.advanceTimersByTime(FADE_DURATION_MS);
    await flushMicrotasks();

    expect(audio.volumeSets.length).toBeGreaterThanOrEqual(FADE_STEPS);
    expect(audio.volume).toBeCloseTo(0.07, 5);
    // volumeSets[0] is the initial silence (audio.volume = 0 before play());
    // the fade itself must then climb monotonically toward the target.
    const fadeSteps = audio.volumeSets.filter((v) => v > 0);
    expect(fadeSteps.length).toBeGreaterThanOrEqual(FADE_STEPS);
    const firstStep = fadeSteps[0] as number;
    expect(firstStep).toBeGreaterThan(0);
    expect(firstStep).toBeLessThan(0.07);
    for (let i = 1; i < fadeSteps.length; i += 1) {
      expect(fadeSteps[i] as number).toBeGreaterThanOrEqual(fadeSteps[i - 1] as number);
    }
    expect(engine.getSnapshot()).toEqual({
      enabled: true,
      playing: true,
      volumePercent: 7,
    });
    expect(storage.getItem(VOLUME_STORAGE_KEY)).toBe('7');
  });

  it('enable() honours a stored volume but caps the fade target at 12%', async () => {
    const { deps, audio, storage } = makeHarness();
    storage.setItem(VOLUME_STORAGE_KEY, '80');
    const engine = new MusicEngine(deps);

    await engine.enable();
    vi.advanceTimersByTime(FADE_DURATION_MS);
    await flushMicrotasks();

    expect(audio.volume).toBeCloseTo(0.12, 5);
    expect(engine.getSnapshot().volumePercent).toBe(12);
    expect(storage.getItem(VOLUME_STORAGE_KEY)).toBe('12');
  });

  it('enable() honours a stored volume under the cap exactly', async () => {
    const { deps, audio } = makeHarness();
    const { storage } = { storage: (deps.storage as FakeStorage) };
    storage.setItem(VOLUME_STORAGE_KEY, '9');
    const engine = new MusicEngine(deps);

    await engine.enable();
    vi.advanceTimersByTime(FADE_DURATION_MS);
    await flushMicrotasks();

    expect(audio.volume).toBeCloseTo(0.09, 5);
    expect(engine.getSnapshot().volumePercent).toBe(9);
  });

  it('enable() stays silent and fade-free when play() is refused', async () => {
    const { deps, audio } = makeHarness();
    audio.rejectPlay = true;
    const engine = new MusicEngine(deps);

    await engine.enable();
    vi.advanceTimersByTime(FADE_DURATION_MS * 2);
    await flushMicrotasks();

    expect(engine.getSnapshot().playing).toBe(false);
    expect(audio.volume).toBe(0);
    expect(audio.volumeSets.length).toBe(1); // only the initial silence set
  });

  it('disable() pauses and does NOT persist the music choice', async () => {
    const { deps, audio, storage } = makeHarness();
    const engine = new MusicEngine(deps);
    await engine.enable();
    vi.advanceTimersByTime(FADE_DURATION_MS);
    await flushMicrotasks();

    engine.disable();
    expect(audio.pauseCalls).toBe(1);
    expect(engine.getSnapshot()).toEqual({
      enabled: false,
      playing: false,
      volumePercent: 7,
    });
    // Only the volume key exists — no "music choice" key is ever written.
    expect(storage.keys()).toEqual([VOLUME_STORAGE_KEY]);
  });

  it('toggle() starts and stops playback', async () => {
    const { deps, audio } = makeHarness();
    const engine = new MusicEngine(deps);

    engine.toggle(); // → enable
    await flushMicrotasks();
    expect(audio.playCalls).toBe(1);

    engine.toggle(); // → disable
    expect(audio.pauseCalls).toBe(1);
    expect(engine.getSnapshot().playing).toBe(false);
  });

  it('slider to 0 pauses; slider above 0 resumes and persists', async () => {
    const { deps, audio, storage } = makeHarness();
    const engine = new MusicEngine(deps);
    await engine.enable();
    vi.advanceTimersByTime(FADE_DURATION_MS);
    await flushMicrotasks();

    engine.setVolumeFromSlider(0);
    expect(audio.pauseCalls).toBe(1);
    expect(engine.getSnapshot().playing).toBe(false);
    expect(storage.getItem(VOLUME_STORAGE_KEY)).toBe('0');

    engine.setVolumeFromSlider(30);
    await flushMicrotasks();
    expect(audio.playCalls).toBe(2);
    expect(audio.volume).toBeCloseTo(0.3, 5);
    expect(engine.getSnapshot()).toEqual({
      enabled: true,
      playing: true,
      volumePercent: 30,
    });
    expect(storage.getItem(VOLUME_STORAGE_KEY)).toBe('30');
  });

  it('visibilitychange hidden pauses; visible resumes only when wanted', async () => {
    const { deps, audio, doc } = makeHarness();
    const engine = new MusicEngine(deps);
    engine.initLifecycle();
    await engine.enable();
    vi.advanceTimersByTime(FADE_DURATION_MS);
    await flushMicrotasks();
    expect(engine.getSnapshot().playing).toBe(true);

    doc.hidden = true;
    doc.fire('visibilitychange');
    expect(audio.pauseCalls).toBe(1);
    expect(engine.getSnapshot().playing).toBe(false);
    expect(engine.getSnapshot().enabled).toBe(true); // intent retained

    doc.hidden = false;
    doc.fire('visibilitychange');
    await flushMicrotasks();
    expect(audio.playCalls).toBe(2);
    expect(engine.getSnapshot().playing).toBe(true);
  });

  it('visibilitychange visible does NOT autoplay when music was never enabled', async () => {
    const { deps, audio, doc } = makeHarness();
    const engine = new MusicEngine(deps);
    engine.initLifecycle();

    doc.hidden = false;
    doc.fire('visibilitychange');
    await flushMicrotasks();
    expect(audio.playCalls).toBe(0);
  });

  it('pagehide pauses and unloads the source; next enable() reloads it', async () => {
    const { deps, audio, win } = makeHarness();
    const engine = new MusicEngine(deps);
    engine.initLifecycle();
    await engine.enable();
    vi.advanceTimersByTime(FADE_DURATION_MS);
    await flushMicrotasks();
    const loadsBefore = audio.loadCalls;

    win.fire('pagehide');
    expect(audio.pauseCalls).toBe(1);
    expect(audio.removedAttrs).toContain('src');
    expect(audio.loadCalls).toBeGreaterThan(loadsBefore);
    expect(engine.getSnapshot().playing).toBe(false);

    await engine.enable();
    expect(audio.src).toBe('/audio/ambient-apothecary.mp3');
    expect(audio.playCalls).toBe(2);
  });

  it('initLifecycle is idempotent and destroy() removes listeners', () => {
    const { deps, doc, win } = makeHarness();
    const engine = new MusicEngine(deps);
    engine.initLifecycle();
    engine.initLifecycle();
    expect(doc.listenerCount('visibilitychange')).toBe(1);
    expect(win.listenerCount('pagehide')).toBe(1);
    engine.destroy();
    expect(doc.listenerCount('visibilitychange')).toBe(0);
    expect(win.listenerCount('pagehide')).toBe(0);
  });

  it('subscribe notifies on state changes and the snapshot reference is stable', async () => {
    const { deps } = makeHarness();
    const engine = new MusicEngine(deps);
    const seen: boolean[] = [];
    const unsubscribe = engine.subscribe((s) => seen.push(s.playing));
    const first = engine.getSnapshot();
    expect(engine.getSnapshot()).toBe(first); // stable reference between emits

    await engine.enable();
    expect(seen).toContain(true);
    const second = engine.getSnapshot();
    expect(second).not.toBe(first);

    unsubscribe();
    engine.disable();
    const countAfterUnsub = seen.length;
    engine.toggle();
    expect(seen.length).toBe(countAfterUnsub);
  });
});
