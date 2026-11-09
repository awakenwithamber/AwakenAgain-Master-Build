import { describe, expect, it } from 'vitest';
import {
  MAX_SEND_ATTEMPTS,
  RETRY_DELAYS_MS,
  sendQuizResultsEmail,
} from './quiz-results-send';
import {
  listFailedEmailSends,
  type EmailSendLog,
  type EmailSendRecord,
} from './email-send-log';
import type { EmailJob, EmailProvider, SendResult } from './email';
import { getQuizResult, toQuizResultSnapshot } from '../quiz/quiz';

const snapshot = toQuizResultSnapshot(getQuizResult('sleep', 'tea')!);
const noSleep = async () => {};

class MemoryLog implements EmailSendLog {
  records: EmailSendRecord[] = [];
  async append(record: EmailSendRecord): Promise<void> {
    this.records.push(record);
  }
  async readAll(): Promise<EmailSendRecord[]> {
    return this.records;
  }
}

function fakeProvider(
  name: string,
  behavior: (call: number) => SendResult,
): EmailProvider & { calls: number } {
  const provider = {
    name,
    calls: 0,
    async send(_job: EmailJob): Promise<SendResult> {
      provider.calls += 1;
      return behavior(provider.calls);
    },
  };
  return provider;
}

describe('sendQuizResultsEmail — reliability (owner spec 2026-11-07)', () => {
  it('sends exactly once on first success — never retries a success', async () => {
    const provider = fakeProvider('resend', () => ({
      ok: true,
      provider_message_id: 'msg-1',
    }));
    const log = new MemoryLog();
    const outcome = await sendQuizResultsEmail(
      'friend@example.com',
      snapshot,
      'Friend',
      { provider, log, sleep: noSleep },
    );
    expect(provider.calls).toBe(1);
    expect(outcome.status).toBe('sent');
    expect(outcome.delivery).toBe('resend');
    expect(outcome.attempts).toBe(1);
    expect(outcome.provider_message_id).toBe('msg-1');
    expect(log.records).toHaveLength(1);
    expect(log.records[0]).toMatchObject({
      to: 'friend@example.com',
      template: 'quiz_results',
      provider: 'resend',
      provider_message_id: 'msg-1',
      status: 'sent',
      attempts: 1,
      last_error: null,
    });
  });

  it('retries with backoff and succeeds — still exactly one delivered email', async () => {
    const provider = fakeProvider('resend', (call) =>
      call < 3
        ? { ok: false, error: 'resend API error (HTTP 500)' }
        : { ok: true, provider_message_id: 'msg-3' },
    );
    const log = new MemoryLog();
    const sleeps: number[] = [];
    const outcome = await sendQuizResultsEmail(
      'friend@example.com',
      snapshot,
      null,
      {
        provider,
        log,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    );
    expect(provider.calls).toBe(3);
    expect(sleeps).toEqual([...RETRY_DELAYS_MS]);
    expect(outcome.status).toBe('sent');
    expect(outcome.attempts).toBe(3);
    expect(log.records).toHaveLength(1);
    expect(log.records[0].status).toBe('sent');
    expect(log.records[0].attempts).toBe(3);
  });

  it('logs a still-failing send as failed and surfaces it', async () => {
    const provider = fakeProvider('resend', () => ({
      ok: false,
      error: 'resend API error (HTTP 422): domain not verified',
    }));
    const log = new MemoryLog();
    const outcome = await sendQuizResultsEmail(
      'friend@example.com',
      snapshot,
      null,
      { provider, log, sleep: noSleep },
    );
    expect(provider.calls).toBe(MAX_SEND_ATTEMPTS);
    expect(outcome.status).toBe('failed');
    expect(outcome.last_error).toContain('domain not verified');
    expect(log.records).toHaveLength(1);
    expect(log.records[0].status).toBe('failed');
    const failed = await listFailedEmailSends(log);
    expect(failed).toHaveLength(1);
    expect(failed[0].to).toBe('friend@example.com');
  });

  it('reports the logging provider honestly as a preview delivery', async () => {
    const provider = fakeProvider('logging', () => ({
      ok: true,
      provider_message_id: 'preview-EMAIL-TEST',
    }));
    const log = new MemoryLog();
    const outcome = await sendQuizResultsEmail(
      'friend@example.com',
      snapshot,
      null,
      { provider, log, sleep: noSleep },
    );
    expect(outcome.status).toBe('sent');
    expect(outcome.delivery).toBe('preview');
    expect(log.records[0].provider).toBe('logging');
  });

  it('a broken send log never takes down the send path', async () => {
    const provider = fakeProvider('resend', () => ({
      ok: true,
      provider_message_id: 'msg-x',
    }));
    const brokenLog: EmailSendLog = {
      async append() {
        throw new Error('disk full');
      },
      async readAll() {
        return [];
      },
    };
    const outcome = await sendQuizResultsEmail(
      'friend@example.com',
      snapshot,
      null,
      { provider, log: brokenLog, sleep: noSleep },
    );
    expect(outcome.status).toBe('sent');
  });
});
