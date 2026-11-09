/**
 * Experience Package 1 (2026-11-08) — page positioning + music control
 * wiring guards (source-shape assertions, the pattern used across this
 * repo's suites).
 *
 * Owner defect reports behind these pins:
 * - "Pages open halfway down": the global `scroll-behavior: smooth`
 *   animated the router's scroll-to-top on every navigation. The fix is
 *   the Next.js-sanctioned pattern — `data-scroll-behavior="smooth"` on
 *   <html> (the router forces instant behavior during transitions, so
 *   new pages open at the top and back restores position) with the
 *   smooth rule scoped to that attribute so anchors stay smooth.
 * - "Music slider jumps to off": the 90px/60px slider made the gentle
 *   low end unusable. The slider is widened, gains a visible % readout
 *   and an explicit mute button (engine behaviour itself is pinned in
 *   lib/music/audio.test.ts).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');

function read(rel: string): string {
  return readFileSync(join(webRoot, rel), 'utf8');
}

describe('scroll policy — top-of-page on navigation (Package 1)', () => {
  it('layout sets data-scroll-behavior="smooth" on <html>', () => {
    const layout = read('app/layout.tsx');
    expect(layout).toContain('<html lang="en" data-scroll-behavior="smooth">');
  });

  it('globals.css scopes smooth scrolling to the attribute selector only', () => {
    const css = read('app/globals.css');
    // The smooth rule exists under the attribute selector…
    expect(css).toContain('html[data-scroll-behavior="smooth"]');
    const scoped = css.slice(css.indexOf('html[data-scroll-behavior="smooth"]'));
    expect(scoped.slice(0, 120)).toContain('scroll-behavior: smooth');
    // …and NO bare html rule carries scroll-behavior (that was the defect).
    const bareHtmlBlocks = [...css.matchAll(/(?:^|\n)html\s*\{([^}]*)\}/g)].map(
      (m) => m[1] as string,
    );
    expect(bareHtmlBlocks.length).toBeGreaterThan(0);
    for (const block of bareHtmlBlocks) {
      expect(block).not.toContain('scroll-behavior');
    }
  });

  it('reduced-motion users get instant scrolling (override beats the scoped rule)', () => {
    const css = read('app/globals.css');
    const mediaStart = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(mediaStart).toBeGreaterThan(-1);
    const mediaBlock = css.slice(mediaStart, mediaStart + 800);
    // The override must name the attribute selector — a bare `html` rule
    // loses on specificity to html[data-scroll-behavior="smooth"], which
    // would leave reduced-motion users with smooth scrolling.
    expect(mediaBlock).toContain('html[data-scroll-behavior="smooth"]');
    expect(mediaBlock).toContain('scroll-behavior: auto');
  });

  it('the styled visible scrollbar is preserved', () => {
    const css = read('app/globals.css');
    expect(css).toContain('::-webkit-scrollbar');
    expect(css).toContain('scrollbar-color:');
  });

  it('entry gates focus their primary action with preventScroll', () => {
    expect(read('components/music/MusicGate.tsx')).toContain(
      'focus({ preventScroll: true })',
    );
    expect(read('components/auth/EntryAuthGate.tsx')).toContain(
      'focus({ preventScroll: true })',
    );
  });
});

describe('music controls wiring (Package 1)', () => {
  it('controls render an explicit mute toggle and a visible % readout', () => {
    const controls = read('components/music/MusicControls.tsx');
    expect(controls).toContain('engine.toggleMute()');
    expect(controls).toContain('aria-pressed={muted}');
    expect(controls).toContain('styles.volumeReadout');
    expect(controls).toContain('{snapshot.volumePercent}%');
  });

  it('the mute toggle carries a screen-reader label that tracks its state', () => {
    const controls = read('components/music/MusicControls.tsx');
    expect(controls).toContain(
      "aria-label={muted ? 'Unmute music' : 'Mute music'}",
    );
  });

  it('the slider is widened on desktop and mobile', () => {
    const css = read('components/music/music.module.css');
    expect(css).toContain('width: 160px');
    expect(css).toContain('width: 110px');
    expect(css).not.toContain('width: 90px');
    expect(css).not.toContain('width: 60px');
  });
});
