'use client';

/**
 * App-segment error boundary (Stage 5 — none existed; an unhandled
 * render error had no in-app fallback or reporting path).
 *
 * Branded fallback on the plum + gold design system. The UI shows NO
 * stack, NO raw error message, and NO PII — only a plain apology and a
 * retry button (reset). The error itself is logged through the
 * structured logger (lib/observability/logger.ts — isomorphic and
 * redacting, so it is safe to import client-side) with its name and
 * the Next error digest, never rendered.
 *
 * Written with createElement (repo convention for test-importable
 * components — vitest does not transform JSX).
 */
import { createElement, useEffect } from 'react';
import { createLogger } from '../lib/observability/logger';

const log = createLogger('error-boundary');

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error('app error boundary caught a render error', {
      error_name: error?.name ?? 'Error',
      digest: error?.digest ?? null,
    });
  }, [error]);

  return createElement(
    'main',
    {
      id: 'main-content',
      style: {
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '3rem 1.5rem',
        gap: '1rem',
      },
    },
    createElement(
      'h1',
      { style: { color: '#d4af37', margin: 0 } },
      'Something went wrong',
    ),
    createElement(
      'p',
      { style: { maxWidth: '34rem', margin: 0 } },
      'This page ran into an unexpected problem. Nothing you were doing ' +
        'was charged or saved incorrectly — please try again, and if it ' +
        'keeps happening, reach us through the contact page.',
    ),
    createElement(
      'button',
      {
        type: 'button',
        onClick: () => reset(),
        style: {
          marginTop: '0.5rem',
          padding: '0.65rem 1.5rem',
          borderRadius: '999px',
          border: '1px solid #d4af37',
          background: 'transparent',
          color: '#d4af37',
          cursor: 'pointer',
          fontSize: '1rem',
        },
      },
      'Try again',
    ),
  );
}
