/**
 * Security headers — config contract test (Phase 2 audit remediation,
 * updated for the Aikido 845087258 nonce-CSP fix).
 *
 * Target location in repo: apps/web/tests/security-headers.test.ts
 * (replaces the current file; paths below assume that location —
 * `../next.config.mjs` and `../lib/security/csp`.)
 *
 * Asserts:
 * - next.config headers() still emits HSTS + the other static headers,
 *   and no longer emits a Content-Security-Policy (it is per-request now).
 * - The CSP built by lib/security/csp.ts carries the caller's nonce in
 *   script-src with 'strict-dynamic', contains NO 'unsafe-inline' and NO
 *   'unsafe-eval' in script-src, locks down the base directives, and keeps
 *   exactly the origins evidenced in this codebase.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs config, no type declarations.
import nextConfig from '../next.config.mjs';
import {
  buildContentSecurityPolicy,
  STRICT_TRANSPORT_SECURITY,
} from '../lib/security/csp';

interface HeaderEntry {
  key: string;
  value: string;
}

async function emittedHeaders(): Promise<Map<string, string>> {
  const rules = (await nextConfig.headers()) as {
    source: string;
    headers: HeaderEntry[];
  }[];
  const all = new Map<string, string>();
  for (const rule of rules) {
    expect(rule.source).toBe('/:path*');
    for (const h of rule.headers) all.set(h.key, h.value);
  }
  return all;
}

function directive(csp: string, name: string): string {
  const found = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  if (!found) throw new Error(`CSP directive missing: ${name}`);
  return found;
}

const NONCE = 'test-nonce-value';

describe('security headers (next.config headers())', () => {
  it('emits every required static header with its required value', async () => {
    const headers = await emittedHeaders();
    expect(headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains',
    );
    expect(STRICT_TRANSPORT_SECURITY).toBe(
      'max-age=63072000; includeSubDomains',
    );
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    const permissions = headers.get('Permissions-Policy') ?? '';
    expect(permissions).toContain('camera=()');
    expect(permissions).toContain('microphone=()');
    expect(permissions).toContain('geolocation=()');
  });

  it('does NOT emit a static Content-Security-Policy (per-request in middleware)', async () => {
    const headers = await emittedHeaders();
    expect(headers.has('Content-Security-Policy')).toBe(false);
  });
});

describe('Content-Security-Policy (lib/security/csp, nonce-based)', () => {
  const csp = buildContentSecurityPolicy(NONCE);

  it('authorises inline scripts by nonce only — no unsafe-inline / unsafe-eval', () => {
    const scriptSrc = directive(csp, 'script-src');
    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('CSP locks down the base directives', () => {
    expect(directive(csp, 'default-src')).toBe("default-src 'self'");
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(csp, 'form-action')).toBe("form-action 'self'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
  });

  it('CSP allows the evidenced origins', () => {
    expect(directive(csp, 'script-src')).toContain(
      'https://us-assets.i.posthog.com',
    );

    const styleSrc = directive(csp, 'style-src');
    expect(styleSrc).toContain("'self'");
    // Style attributes only — not flagged by Aikido, cannot execute script.
    expect(styleSrc).toContain("'unsafe-inline'");
    expect(styleSrc).toContain('https://fonts.googleapis.com');

    expect(directive(csp, 'font-src')).toContain('https://fonts.gstatic.com');

    const imgSrc = directive(csp, 'img-src');
    expect(imgSrc).toContain("'self'");
    expect(imgSrc).toContain('data:');
    expect(imgSrc).toContain('blob:');
    expect(imgSrc).toContain('https://d2xsxph8kpxj0f.cloudfront.net');
    expect(imgSrc).toContain('https://files.manuscdn.com');

    const connectSrc = directive(csp, 'connect-src');
    expect(connectSrc).toContain("'self'");
    expect(connectSrc).toContain('https://us.posthog.com');
    expect(connectSrc).toContain('https://us.i.posthog.com');
    expect(connectSrc).toContain('https://us-assets.i.posthog.com');

    expect(directive(csp, 'frame-src')).toContain('https://player.vimeo.com');
    expect(directive(csp, 'media-src')).toBe("media-src 'self'");
  });
});
