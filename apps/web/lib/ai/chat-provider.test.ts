/**
 * Tests — Gaia chat provider contract (G11).
 * Laws: diagnosis/treatment/cure intents always refuse; EVERY reply carries
 * the disclaimer; provider is the canned preview with binding marked
 * NEEDS_VERIFICATION; request validation rejects malformed payloads.
 */
import { describe, expect, it } from 'vitest';
import {
  CannedPreviewProvider,
  GAIA_DISCLAIMER,
  getChatProvider,
  isRefusalIntent,
  validateChatRequest,
} from './chat-provider';

const provider = new CannedPreviewProvider();

async function replyTo(content: string): Promise<string> {
  const r = await provider.respond([{ role: 'user', content }]);
  return r.reply;
}

describe('refusal guardrails', () => {
  it.each([
    'Can you diagnose my rash?',
    'Will this cure my anxiety?',
    'How should I treat my insomnia with herbs?',
    'What dosage should I take for diabetes?',
    'Is this safe with my cancer medication?',
    'I am pregnant, should I take this?',
  ])('refuses: %s', async (content) => {
    const reply = await replyTo(content);
    expect(reply).toMatch(/can.t help with diagnosis/i);
  });

  it('isRefusalIntent flags the intent set', () => {
    expect(isRefusalIntent('diagnose me')).toBe(true);
    expect(isRefusalIntent('cure for headaches')).toBe(true);
    expect(isRefusalIntent('tell me about lavender')).toBe(false);
    expect(isRefusalIntent('where is my order')).toBe(false);
  });
});

describe('canned preview provider', () => {
  it('answers in educational scope for safe topics', async () => {
    const reply = await replyTo('Tell me about lavender');
    expect(reply).toMatch(/lavender/i);
    expect(reply).not.toMatch(/diagnos|cure/i);
  });

  it('every response carries the disclaimer and preview flags', async () => {
    const r = await provider.respond([{ role: 'user', content: 'hi' }]);
    expect(r.disclaimer).toBe(GAIA_DISCLAIMER);
    expect(r.provider_id).toBe('canned-preview');
    expect(r.provider_binding_needs_verification).toBe(true);
  });

  it('registry returns the canned preview provider', () => {
    const p = getChatProvider();
    expect(p.id).toBe('canned-preview');
    expect(p.kind).toBe('canned_preview');
  });

  it('never fabricates medical efficacy claims', async () => {
    const replies = await Promise.all(
      ['lavender', 'soap builder', 'shipping', 'grimoire'].map(replyTo),
    );
    for (const r of replies) {
      expect(r).not.toMatch(/will cure|treats |heals |clinically proven/i);
    }
  });
});

describe('request validation', () => {
  it('accepts a valid request', () => {
    const v = validateChatRequest({ messages: [{ role: 'user', content: 'hi' }] });
    expect(v.ok).toBe(true);
  });

  it('rejects non-object, empty, and oversized payloads', () => {
    expect(validateChatRequest(null).ok).toBe(false);
    expect(validateChatRequest({ messages: [] }).ok).toBe(false);
    expect(
      validateChatRequest({ messages: [{ role: 'user', content: 'x'.repeat(501) }] }).ok,
    ).toBe(false);
    expect(
      validateChatRequest({
        messages: Array.from({ length: 11 }, () => ({ role: 'user', content: 'hi' })),
      }).ok,
    ).toBe(false);
  });

  it('rejects bad roles and non-string content', () => {
    expect(validateChatRequest({ messages: [{ role: 'bot', content: 'hi' }] }).ok).toBe(false);
    expect(validateChatRequest({ messages: [{ role: 'user', content: 42 }] }).ok).toBe(false);
  });

  it('requires at least one user message', () => {
    expect(
      validateChatRequest({ messages: [{ role: 'assistant', content: 'hello' }] }).ok,
    ).toBe(false);
  });
});
