/**
 * Health endpoint (Stage 5) — laws:
 * - GET returns exactly { status: 'ok', time: <ISO>, database:
 *   'configured' | 'not-configured' }.
 * - The database field reflects env PRESENCE only; no connection
 *   string, host, key, version, or error detail can appear.
 * - Responses are no-store.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { GET } from './route';

const saved = process.env.DATABASE_URL;

afterEach(() => {
  if (saved === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = saved;
});

describe('GET /api/health', () => {
  it('returns ok + ISO time + not-configured without DATABASE_URL', async () => {
    delete process.env.DATABASE_URL;
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(typeof body.time).toBe('string');
    expect(new Date(body.time as string).toISOString()).toBe(body.time);
    expect(body.database).toBe('not-configured');
    expect(Object.keys(body).sort()).toEqual(['database', 'status', 'time']);
  });

  it('reports configured from env presence only and leaks nothing of the value', async () => {
    process.env.DATABASE_URL =
      'postgres://user:supersecret@db.internal.example:5432/neon';
    const res = GET();
    const text = await res.text();
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(body.database).toBe('configured');
    for (const leaked of ['supersecret', 'db.internal.example', 'postgres', '5432']) {
      expect(text).not.toContain(leaked);
    }
  });
});
