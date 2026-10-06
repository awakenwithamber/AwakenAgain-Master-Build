/**
 * REGRESSION SUITE — form-relay job contract (G5 / §§85, 89).
 *
 * Laws under test:
 * - buildFormRelayJob is PURE: describes the Zapier/email handoff as a
 *   typed job (form type, record, payload, destination env-var NAME,
 *   delivery policy, fallback) without I/O or env reads, and NEVER embeds
 *   the webhook URL (values stay in the environment).
 * - attemptFormRelay posts exactly the job envelope to the configured
 *   webhook with an 8s timeout; unconfigured webhook → no fetch, explicit
 *   'webhook_unconfigured' result, and the record stays in the local
 *   durable store (fallback 'local_store_manual_followup').
 * - Every RelayFormType maps to its ZAPIER_*_WEBHOOK env var (legacy
 *   contract preserved, names only).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  FORM_RELAY_MAX_ATTEMPTS,
  FORM_RELAY_TIMEOUT_MS,
  RELAY_WEBHOOK_ENV,
  attemptFormRelay,
  buildFormRelayJob,
  resolveRelayWebhook,
  type FormRelayJob,
  type RelayFormType,
} from './form-relay';

const INPUT = {
  form_type: 'contact' as RelayFormType,
  record_id: 'MSG-20261005-ABC123',
  payload: { name: 'Test Customer', message: 'hello' },
  received_at: '2026-10-05T23:00:00.000Z',
};

function stubFetch(status: number): {
  fetchImpl: typeof fetch;
  calls: { url: string; init: RequestInit }[];
} {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init: init ?? {} });
    return { ok: status >= 200 && status < 300, status } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('buildFormRelayJob', () => {
  it('describes the handoff as a typed, pure job', () => {
    const job = buildFormRelayJob(INPUT);
    expect(job.job).toBe('form-relay');
    expect(job.job_id).toMatch(/^relay_/);
    expect(job.form_type).toBe('contact');
    expect(job.record_id).toBe(INPUT.record_id);
    expect(job.payload).toEqual(INPUT.payload);
    expect(job.received_at).toBe(INPUT.received_at);
    expect(job.destination).toEqual({
      kind: 'webhook',
      env_var: 'ZAPIER_CONTACT_WEBHOOK',
    });
    expect(job.policy.timeout_ms).toBe(FORM_RELAY_TIMEOUT_MS);
    expect(job.policy.max_attempts).toBe(FORM_RELAY_MAX_ATTEMPTS);
    expect(job.policy.retry).toBe('manual');
    expect(job.fallback).toBe('local_store_manual_followup');
  });

  it('never embeds the webhook URL — even when the env var is set', () => {
    const secret = 'https://hooks.example.com/secret-webhook-abc123';
    process.env.ZAPIER_CONTACT_WEBHOOK = secret;
    const job = buildFormRelayJob(INPUT);
    expect(JSON.stringify(job)).not.toContain(secret);
    expect(JSON.stringify(job)).not.toContain('hooks.example.com');
    delete process.env.ZAPIER_CONTACT_WEBHOOK;
  });

  it('maps every legacy form type to its ZAPIER_*_WEBHOOK env var', () => {
    expect(RELAY_WEBHOOK_ENV).toEqual({
      contact: 'ZAPIER_CONTACT_WEBHOOK',
      consultation: 'ZAPIER_CONSULTATION_WEBHOOK',
      'soap-order': 'ZAPIER_SOAP_ORDER_WEBHOOK',
      order: 'ZAPIER_ORDER_WEBHOOK',
    });
  });
});

describe('attemptFormRelay', () => {
  beforeEach(() => {
    delete process.env.ZAPIER_CONTACT_WEBHOOK;
  });
  afterEach(() => {
    delete process.env.ZAPIER_CONTACT_WEBHOOK;
    vi.restoreAllMocks();
  });

  it('returns webhook_unconfigured without fetching when no webhook is set', async () => {
    const { fetchImpl, calls } = stubFetch(200);
    const result = await attemptFormRelay(buildFormRelayJob(INPUT), fetchImpl);
    expect(result).toEqual({ ok: false, error: 'webhook_unconfigured' });
    expect(calls).toHaveLength(0);
  });

  it('posts the job envelope to the configured webhook', async () => {
    process.env.ZAPIER_CONTACT_WEBHOOK = 'https://hooks.example.com/relay';
    const { fetchImpl, calls } = stubFetch(200);
    const job: FormRelayJob = buildFormRelayJob(INPUT);
    const result = await attemptFormRelay(job, fetchImpl);
    expect(result).toEqual({ ok: true, status: 200 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://hooks.example.com/relay');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.headers).toEqual({
      'Content-Type': 'application/json',
    });
    const sent = JSON.parse(String(calls[0]?.init.body)) as Record<
      string,
      unknown
    >;
    expect(sent.form_type).toBe('contact');
    expect(sent.record_id).toBe(INPUT.record_id);
    expect(sent.received_at).toBe(INPUT.received_at);
    expect(sent.payload).toEqual(INPUT.payload);
  });

  it('surfaces HTTP errors without throwing', async () => {
    process.env.ZAPIER_CONTACT_WEBHOOK = 'https://hooks.example.com/relay';
    const { fetchImpl } = stubFetch(500);
    const result = await attemptFormRelay(buildFormRelayJob(INPUT), fetchImpl);
    expect(result).toEqual({ ok: false, status: 500, error: 'http_error' });
  });

  it('surfaces network failures without throwing', async () => {
    process.env.ZAPIER_CONTACT_WEBHOOK = 'https://hooks.example.com/relay';
    const failing = (async () => {
      throw new Error('socket hangup');
    }) as unknown as typeof fetch;
    const result = await attemptFormRelay(buildFormRelayJob(INPUT), failing);
    expect(result).toEqual({ ok: false, error: 'network_error' });
  });

  it('resolveRelayWebhook reads the env var at attempt time', () => {
    const job = buildFormRelayJob(INPUT);
    expect(resolveRelayWebhook(job)).toBeNull();
    process.env.ZAPIER_CONTACT_WEBHOOK = 'https://hooks.example.com/relay';
    expect(resolveRelayWebhook(job)).toBe('https://hooks.example.com/relay');
  });
});
