/**
 * Gaia floating button size trim (owner directive 2026-11-09):
 * "Make the Gaia button a bit smaller so she isn't in the way on any
 * page." Source-shape pins, the pattern used across this repo's suites:
 * the global .gaia-fab rule carries the trimmed size, the widget keeps
 * its label/behavior, and the layout mounts exactly one instance.
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

function fabRule(css: string): string {
  const start = css.indexOf('.gaia-fab {');
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('gaia fab — smaller pill (2026-11-09)', () => {
  it('globals.css pins the trimmed font-size and padding', () => {
    const rule = fabRule(read('app/globals.css'));
    expect(rule).toContain('font-size: 0.78rem;');
    expect(rule).toContain('padding: 0.62rem 0.95rem;');
    // The pre-trim values must not survive in the fab rule.
    expect(rule).not.toContain('font-size: 0.95rem;');
    expect(rule).not.toContain('padding: 0.7rem 1.3rem;');
  });

  it('position and branding are unchanged', () => {
    const rule = fabRule(read('app/globals.css'));
    expect(rule).toContain('position: fixed;');
    expect(rule).toContain('right: 1.25rem;');
    expect(rule).toContain('bottom: 1.25rem;');
    expect(rule).toContain('border-radius: 999px;');
  });

  it('the widget keeps its label and accessible name', () => {
    const widget = read('components/chat/GaiaWidget.tsx');
    expect(widget).toContain('className="gaia-fab"');
    expect(widget).toContain('aria-label="Open Gaia chat"');
    expect(widget).toContain('✦ Gaia');
  });

  it('the layout mounts exactly one global GaiaWidget', () => {
    const layout = read('app/layout.tsx');
    expect(layout.match(/<GaiaWidget \/>/g)).toHaveLength(1);
  });
});
