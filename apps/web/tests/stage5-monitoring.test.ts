/**
 * Stage 5 monitoring — error boundaries + PostHog inertness.
 *
 * Laws:
 * - app/error.tsx and app/global-error.tsx exist, are client
 *   boundaries, render the branded fallback copy ("Something went
 *   wrong" + a Try again / reset affordance), and NEVER render the
 *   raw error message (which may embed PII or internals).
 * - global-error renders its own <html>/<body> (root layout may be
 *   the failure) with inline styling only.
 * - PostHog stays inert without the owner's key: initPostHog resolves
 *   without configuring anything when NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
 *   is unset (no token is invented in code).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import AppError from '../app/error';
import GlobalError from '../app/global-error';

const RAW_MESSAGE = 'raw failure mentioning buyer@example.com and whsec_leak';

function secretError(): Error & { digest?: string } {
  const err = new Error(RAW_MESSAGE) as Error & { digest?: string };
  err.digest = 'digest-123';
  return err;
}

describe('app error boundary (Stage 5)', () => {
  it('renders branded fallback copy + retry, without the raw error', () => {
    const html = renderToStaticMarkup(
      createElement(AppError, { error: secretError(), reset: () => {} }),
    );
    expect(html).toContain('Something went wrong');
    expect(html).toContain('Try again');
    expect(html).toContain('#d4af37'); // brand gold
    expect(html).not.toContain(RAW_MESSAGE);
    expect(html).not.toContain('buyer@example.com');
    expect(html).not.toContain('whsec_leak');
    expect(html).not.toContain('digest-123');
  });

  it('is a client component wired to reset()', () => {
    const src = readFileSync(
      join(resolve(__dirname, '..'), 'app/error.tsx'),
      'utf8',
    );
    expect(src.startsWith("'use client'")).toBe(true);
    expect(src).toContain('onClick: () => reset()');
    expect(src).toContain("createLogger('error-boundary')");
  });
});

describe('global error boundary (Stage 5)', () => {
  it('renders its own html/body with fallback copy, without the raw error', () => {
    const html = renderToStaticMarkup(
      createElement(GlobalError, { error: secretError(), reset: () => {} }),
    );
    expect(html).toContain('<html');
    expect(html).toContain('<body');
    expect(html).toContain('Something went wrong');
    expect(html).toContain('Try again');
    expect(html).toContain('#150b26'); // plum, inline (global CSS may be the failure)
    expect(html).not.toContain(RAW_MESSAGE);
    expect(html).not.toContain('buyer@example.com');
  });

  it('is a client component and self-contained (no CSS imports)', () => {
    const src = readFileSync(
      join(resolve(__dirname, '..'), 'app/global-error.tsx'),
      'utf8',
    );
    expect(src.startsWith("'use client'")).toBe(true);
    expect(src).not.toContain('.css');
    expect(src).not.toContain('globals');
  });
});

describe('PostHog inertness (Stage 5 verification — unchanged)', () => {
  it('no token is hard-coded anywhere in the analytics init', () => {
    const src = readFileSync(
      join(resolve(__dirname, '..'), 'lib/analytics/posthog.ts'),
      'utf8',
    );
    expect(src).toContain('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN');
    expect(src).not.toMatch(/phc_[A-Za-z0-9]{10,}/);
  });

  it('initPostHog resolves as a no-op without a configured token', async () => {
    const saved = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    try {
      // Server environment (no window): init must resolve immediately
      // and stay inert — the module reads the token at module load, so
      // this asserts the server-side no-op path; the client inert path
      // is guarded by isConfigured() in the same module (source above).
      const { initPostHog } = await import('../lib/analytics/posthog');
      await expect(initPostHog()).resolves.toBeUndefined();
    } finally {
      if (saved !== undefined) {
        process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = saved;
      }
    }
  });
});
