/**
 * Security headers — config contract test (Phase 2 audit remediation).
 *
 * Asserts the headers() block emitted by next.config.mjs carries every
 * required header, that the CSP allows exactly the origins evidenced in
 * this codebase (PostHog hosts, Google Fonts, the two herb-image CDNs,
 * the Vimeo player), and that 'unsafe-eval' appears nowhere in it.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs config, no type declarations.
import nextConfig from '../next.config.mjs';

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

describe('security headers (next.config headers())', () => {
  it('emits every required header with its required value', async () => {
    const headers = await emittedHeaders();
    expect(headers.get('Strict-Transport-Security')).toBe(
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
    expect(headers.has('Content-Security-Policy')).toBe(true);
  });

  it('CSP locks down the base directives', async () => {
    const csp = (await emittedHeaders()).get('Content-Security-Policy')!;
    expect(directive(csp, 'default-src')).toBe("default-src 'self'");
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(csp, 'form-action')).toBe("form-action 'self'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
  });

  it('CSP allows the evidenced origins — and no unsafe-eval', async () => {
    const csp = (await emittedHeaders()).get('Content-Security-Policy')!;
    expect(csp).not.toContain('unsafe-eval');

    const scriptSrc = directive(csp, 'script-src');
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("'unsafe-inline'");
    // posthog-js lazy feature modules.
    expect(scriptSrc).toContain('https://us-assets.i.posthog.com');

    const styleSrc = directive(csp, 'style-src');
    expect(styleSrc).toContain("'self'");
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

    expect(directive(csp, 'frame-src')).toContain('https://player.vimeo.com');
    expect(directive(csp, 'media-src')).toBe("media-src 'self'");
  });
});
