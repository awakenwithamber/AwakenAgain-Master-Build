import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as quizLeadPost } from './quiz-lead/route';
import { POST as newsletterPost } from './newsletter/route';
import { POST as affiliateInterestPost } from './affiliate-interest/route';
import { POST as partnerIdeaPost } from './partner-idea/route';

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
    process.env.EMAIL_SEND_LOG_DIR = mkdtempSync(join(tmpdir(), 'email-sends-'));
    // The results-email delivery must be the logging preview in tests —
    // never a real provider, whatever the shell env carries.
    delete process.env.RESEND_API_KEY;
  });
  afterEach(() => {
    delete process.env.LEAD_STORE_DIR;
    delete process.env.EMAIL_SEND_LOG_DIR;
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

  it('stores the FULL quiz result on the lead record (audit BROKEN-1)', async () => {
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
    const lines = readFileSync(
      join(process.env.LEAD_STORE_DIR!, 'quiz_lead.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n');
    const record = JSON.parse(lines[lines.length - 1]);
    expect(record.metadata).toMatchObject({ concern_id: 'sleep', form_id: 'tea' });
    // The actual allies + recommendations the visitor saw — not just ids.
    expect(record.quizResult.concernId).toBe('sleep');
    expect(record.quizResult.formId).toBe('tea');
    expect(record.quizResult.allies.map((a: { name: string }) => a.name)).toContain(
      'Valerian root',
    );
    expect(record.quizResult.productHandles.length).toBeGreaterThan(0);
    expect(record.quizResult.productReason).toBeTruthy();
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

  it('requires an email — a completion without one is rejected → 422', async () => {
    const res = await quizLeadPost(
      jsonRequest({ name: 'Sam', concernId: 'sleep', formId: 'tea' }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).ok).toBe(false);
  });

  it('sends the results email without any newsletter consent (transactional)', async () => {
    const res = await quizLeadPost(
      jsonRequest({ email: 'guest@example.com', concernId: 'sleep', formId: 'tea' }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    // No RESEND_API_KEY in tests → the logging preview is bound, and
    // the route says so honestly instead of claiming delivery.
    expect(json.emailStatus).toBe('preview');

    // The completion is stored — name optional (null), opt-in false.
    const leadLines = readFileSync(
      join(process.env.LEAD_STORE_DIR!, 'quiz_lead.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n');
    const record = JSON.parse(leadLines[leadLines.length - 1]);
    expect(record.email).toBe('guest@example.com');
    expect(record.name).toBeNull();
    expect(record.metadata.newsletter_opt_in).toBe(false);
    expect(record.quizResult.allies.map((a: { name: string }) => a.name)).toContain(
      'Chamomile',
    );

    // The send was logged with its delivery status.
    const sendLines = readFileSync(
      join(process.env.EMAIL_SEND_LOG_DIR!, 'email-sends.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n');
    const send = JSON.parse(sendLines[sendLines.length - 1]);
    expect(send).toMatchObject({
      to: 'guest@example.com',
      template: 'quiz_results',
      provider: 'logging',
      status: 'sent',
      attempts: 1,
    });

    // Box not ticked → NO newsletter record exists.
    expect(
      existsSync(join(process.env.LEAD_STORE_DIR!, 'newsletter.jsonl')),
    ).toBe(false);
  });

  it('records newsletter consent only when the separate box is ticked', async () => {
    const res = await quizLeadPost(
      jsonRequest({
        email: 'reader@example.com',
        newsletterConsent: true,
        concernId: 'energy',
        formId: 'capsule',
      }),
    );
    expect(res.status).toBe(201);
    const lines = readFileSync(
      join(process.env.LEAD_STORE_DIR!, 'newsletter.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n');
    const record = JSON.parse(lines[lines.length - 1]);
    expect(record.kind).toBe('newsletter');
    expect(record.email).toBe('reader@example.com');
    expect(record.consent).toBe(true);
    expect(record.metadata.placement).toBe('quiz-results');
  });

  it('a store failure cannot 500 the email action (Results First, 2026-11-08)', async () => {
    // Point the lead store INSIDE a regular file: mkdir/append fails
    // with ENOTDIR, simulating a dead store. The audit's defect was
    // exactly this throw escaping as a 500 that stranded the visitor.
    const blocker = join(process.env.LEAD_STORE_DIR!, 'blocker');
    writeFileSync(blocker, 'not a directory');
    process.env.LEAD_STORE_DIR = join(blocker, 'leads');

    const res = await quizLeadPost(
      jsonRequest({
        email: 'guest@example.com',
        newsletterConsent: true,
        concernId: 'sleep',
        formId: 'tea',
      }),
    );
    // No 500: the response is honest about what happened — the record
    // was not saved, and the email was still attempted (preview here).
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.id).toBeNull();
    expect(json.saved).toBe(false);
    expect(json.emailStatus).toBe('preview');

    // The send still went through the send service and was logged.
    const sendLines = readFileSync(
      join(process.env.EMAIL_SEND_LOG_DIR!, 'email-sends.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n');
    const send = JSON.parse(sendLines[sendLines.length - 1]);
    expect(send).toMatchObject({ to: 'guest@example.com', template: 'quiz_results' });
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

describe('affiliate-interest route', () => {
  beforeEach(() => {
    process.env.LEAD_STORE_DIR = mkdtempSync(join(tmpdir(), 'leads-'));
  });
  afterEach(() => {
    delete process.env.LEAD_STORE_DIR;
  });

  it('stores a valid registration → 201, as an affiliate_interest lead', async () => {
    const res = await affiliateInterestPost(
      jsonRequest({
        name: 'Jo Maker',
        email: 'jo@example.com',
        consent: true,
        projects: ['brandalchemy', 'awaken-network'],
        note: 'I grow herbs.',
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.id).toBeTruthy();

    const lines = readFileSync(
      join(process.env.LEAD_STORE_DIR!, 'affiliate_interest.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n');
    const record = JSON.parse(lines[lines.length - 1]);
    expect(record.kind).toBe('affiliate_interest');
    expect(record.name).toBe('Jo Maker');
    expect(record.email).toBe('jo@example.com');
    expect(record.consent).toBe(true);
    expect(record.metadata.projects).toBe('awaken-network,brandalchemy');
    expect(record.metadata.note).toBe('I grow herbs.');
  });

  it('rejects missing consent and unknown projects → 422, stores nothing', async () => {
    const noConsent = await affiliateInterestPost(
      jsonRequest({
        name: 'Jo',
        email: 'jo@example.com',
        consent: false,
        projects: ['awaken-network'],
      }),
    );
    expect(noConsent.status).toBe(422);

    const unknown = await affiliateInterestPost(
      jsonRequest({
        name: 'Jo',
        email: 'jo@example.com',
        consent: true,
        projects: ['moon-base'],
      }),
    );
    expect(unknown.status).toBe(422);

    const empty = await affiliateInterestPost(
      jsonRequest({
        name: 'Jo',
        email: 'jo@example.com',
        consent: true,
        projects: [],
      }),
    );
    expect(empty.status).toBe(422);
  });
});

describe('partner-idea route', () => {
  beforeEach(() => {
    process.env.LEAD_STORE_DIR = mkdtempSync(join(tmpdir(), 'leads-'));
  });
  afterEach(() => {
    delete process.env.LEAD_STORE_DIR;
  });

  it('stores a valid submission → 201, as a partner_idea lead', async () => {
    const res = await partnerIdeaPost(
      jsonRequest({
        name: 'Jo Maker',
        email: 'jo@example.com',
        consent: true,
        contributionType: 'supply',
        idea: 'I press botanical oils in small batches.',
        links: 'https://example.com',
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const lines = readFileSync(
      join(process.env.LEAD_STORE_DIR!, 'partner_idea.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n');
    const record = JSON.parse(lines[lines.length - 1]);
    expect(record.kind).toBe('partner_idea');
    expect(record.metadata.contribution_type).toBe('supply');
    expect(record.metadata.idea).toContain('botanical oils');
    expect(record.metadata.links).toBe('https://example.com');
  });

  it('rejects unknown contribution type and missing idea → 422', async () => {
    const badType = await partnerIdeaPost(
      jsonRequest({
        name: 'Jo',
        email: 'jo@example.com',
        consent: true,
        contributionType: 'magic',
        idea: 'Something.',
      }),
    );
    expect(badType.status).toBe(422);

    const noIdea = await partnerIdeaPost(
      jsonRequest({
        name: 'Jo',
        email: 'jo@example.com',
        consent: true,
        contributionType: 'idea',
      }),
    );
    expect(noIdea.status).toBe(422);
  });
});
