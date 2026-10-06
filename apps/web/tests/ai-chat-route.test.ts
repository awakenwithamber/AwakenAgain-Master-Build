/**
 * Route tests — POST /api/ai/chat (G11).
 * Laws: valid requests get a disclaimer-bearing reply from the canned
 * preview; malformed bodies are rejected; the route never claims a real
 * provider.
 */
import { describe, expect, it } from 'vitest';
import { POST } from '../app/api/ai/chat/route';

function req(body: unknown): Request {
  return new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/ai/chat', () => {
  it('responds to a valid message with the canned preview', async () => {
    const res = await POST(req({ messages: [{ role: 'user', content: 'Tell me about the soap builder' }] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.provider_id).toBe('canned-preview');
    expect(data.provider_binding_needs_verification).toBe(true);
    expect(typeof data.disclaimer).toBe('string');
    expect(data.disclaimer.length).toBeGreaterThan(20);
    expect(data.reply).toMatch(/soap builder/i);
  });

  it('refuses diagnosis requests at the route level', async () => {
    const res = await POST(req({ messages: [{ role: 'user', content: 'Can you diagnose my rash?' }] }));
    const data = await res.json();
    expect(data.reply).toMatch(/can.t help with diagnosis/i);
  });

  it('rejects invalid JSON with 400', async () => {
    const res = await POST(req('not json{'));
    expect(res.status).toBe(400);
  });

  it('rejects malformed payloads with 422', async () => {
    const res = await POST(req({ messages: [] }));
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });
});
