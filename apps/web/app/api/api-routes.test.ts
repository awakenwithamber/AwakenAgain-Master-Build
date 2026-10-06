import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as quizLeadPost } from './quiz-lead/route';
import { POST as newsletterPost } from './newsletter/route';

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('quiz-lead route', () => {
  beforeEach(() => {
    process.env.LEAD_STORE_DIR = mkdtempSync(join(tmpdir(), 'leads-'));
  });
  afterEach(() => {
    delete process.env.LEAD_STORE_DIR;
  });

  it('stores a valid lead → 201, no PII in analytics', async () => {
    const res = await quizLeadPost(
      jsonRequest({
        name: 'Amber',
        email: 'friend@example.com',
        consent: true,
        concernId: 'sleep',
        formId: 'tea',
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.id).toBeTruthy();
  });

  it('rejects invalid payloads → 422, and bad JSON → 400', async () => {
    const bad = await quizLeadPost(jsonRequest({ name: 'x' }));
    expect(bad.status).toBe(422);
    const badJson = await bad.json();
    expect(badJson.ok).toBe(false);
    expect(badJson.errors.length).toBeGreaterThan(0);

    const nonJson = await quizLeadPost(
      new Request('http://localhost/api/x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json{',
      }),
    );
    expect(nonJson.status).toBe(400);
  });
});

describe('newsletter route', () => {
  beforeEach(() => {
    process.env.LEAD_STORE_DIR = mkdtempSync(join(tmpdir(), 'leads-'));
  });
  afterEach(() => {
    delete process.env.LEAD_STORE_DIR;
  });

  it('stores a valid signup → 201', async () => {
    const res = await newsletterPost(
      jsonRequest({ email: 'reader@example.com', consent: true, placement: 'footer' }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('rejects missing consent → 422', async () => {
    const res = await newsletterPost(
      jsonRequest({ email: 'reader@example.com', consent: false }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).ok).toBe(false);
  });
});
