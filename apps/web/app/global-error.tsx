'use client';

/**
 * Root error boundary (Stage 5). This replaces the root layout when
 * the layout itself fails, so it MUST render its own <html>/<body>
 * and be fully self-contained: global CSS may be the thing that
 * failed, so all styling here is minimal and inline, and nothing is
 * imported beyond React and the (isomorphic, redacting) logger.
 *
 * The UI shows NO stack, NO raw error message, and NO PII.
 *
 * Written with createElement (repo convention for test-importable
 * components — vitest does not transform JSX).
 */
import { createElement, useEffect } from 'react';
import { createLogger } from '../lib/observability/logger';

const log = createLogger('global-error-boundary');

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error('global error boundary caught a root render error', {
      error_name: error?.name ?? 'Error',
      digest: error?.digest ?? null,
    });
  }, [error]);

  return createElement(
    'html',
    { lang: 'en' },
    createElement(
      'body',
      {
        style: {
          margin: 0,
          minHeight: '100vh',
          background: '#150b26',
          color: '#f3ead8',
          fontFamily: 'Georgia, serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '3rem 1.5rem',
          gap: '1rem',
          boxSizing: 'border-box',
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
        'The site ran into an unexpected problem. Please try again — ' +
          'if it keeps happening, try returning to the homepage in a ' +
          'few minutes.',
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
    ),
  );
}
