/**
 * Member profile — the Gaia build's hard rules, locked in (JSONL
 * driver, tmp ledger):
 * - create/save/load round-trip + the automatic star chart;
 * - 13+ age gate for profile creation (both sides);
 * - 18+ gate for before/after photos (both sides, from the SAVED
 *   birthday), with EXIF stripped from the stored check-in photo;
 * - privacy: the public composition refuses private feeds, never
 *   carries address/phone/birthday, and excludes progress photos
 *   unless separately shared;
 * - feed composition with and without favorites/allies (honest
 *   empties, nothing invented);
 * - welcome email invoked once, with the right content, labeled
 *   honestly ('preview' while no real provider is bound);
 * - reminder math (14 days), opt-in gating, server-side reminder
 *   state, and the token unsubscribe.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureAccountAsync,
  loadAccountAsync,
  saveQuizResultAsync,
  setLikesAsync,
} from './accounts';
import {
  submitProgressCheckinAsync,
  optOutProgressRemindersAsync,
  progressReminderStatus,
  reminderUnsubscribeToken,
  saveMemberProfileAsync,
  verifyReminderUnsubscribeToken,
  type MemberProfileInput,
} from './member-profile';
import { getOwnMemberFeedAsync, getPublicMemberFeedAsync } from './member-feed';
import {
  runProgressReminderForEmailAsync,
  sendProfileWelcomeEmailAsync,
} from '../jobs/profile-emails';
import {
  LoggingEmailProvider,
  renderEmailMessage,
  type EmailJob,
  type EmailProvider,
  type SendResult,
} from '../jobs/email';
import type { QuizResultSnapshot } from '../quiz/quiz';

const EMAIL = 'gardener@example.com';
const NOW = new Date('2026-11-08T12:00:00Z');

/** Tiny valid JPEG data URL (SOI + APP0 + SOF0 + SOS + EOI skeleton). */
function jpegDataUrl(withExif = false): string {
  const bytes: number[] = [0xff, 0xd8];
  const segment = (marker: number, payload: number[]) => {
    const length = payload.length + 2;
    bytes.push(0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload);
  };
  segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  if (withExif) {
    segment(0xe1, [...Buffer.from('Exif\0\0GPS:40.7608,-111.8910', 'latin1')]);
  }
  segment(0xc0, [8, 0, 16, 0, 16, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  segment(0xda, [3, 1, 0, 2, 0x11, 1, 3, 0x11, 1, 0, 63, 0]);
  bytes.push(0x11, 0x22, 0xff, 0xd9);
  return `data:image/jpeg;base64,${Buffer.from(new Uint8Array(bytes)).toString('base64')}`;
}

function validInput(overrides: MemberProfileInput = {}): MemberProfileInput {
  return {
    full_name: 'Rowan Gardener',
    birthday: '1992-11-17',
    bio: 'Herbalist in training, keeper of bees.',
    photo_data_url: jpegDataUrl(),
    phone_country: 'US',
    phone_number: '801-555-0142',
    address: {
      name: 'Rowan Gardener',
      street: '239 S 1200 W',
      city: 'Salt Lake City',
      state: 'UT',
      postal_code: '84104',
      country: 'US',
    },
    socials: { instagram: '@rowan.grows' },
    ...overrides,
  };
}

class CapturingProvider implements EmailProvider {
  readonly name = 'logging';
  jobs: EmailJob[] = [];
  async send(job: EmailJob): Promise<SendResult> {
    this.jobs.push(job);
    return { ok: true, provider_message_id: `preview-${job.id}` };
  }
}

const SNAPSHOT: QuizResultSnapshot = {
  concernId: 'stress',
  concernLabel: 'Stress',
  formId: 'tea',
  formLabel: 'Tea',
  allies: [
    { name: 'Lemon Balm', latin: 'Melissa officinalis', evidence: 'traditional', note: 'Calming.' },
  ],
  productHandles: ['chill-pill-capsules'],
  productReason: 'Because stress.',
};

let dir: string;
let savedLedger: string | undefined;
let savedLogDir: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'aa-member-'));
  savedLedger = process.env.ACCOUNTS_LEDGER_PATH;
  savedLogDir = process.env.EMAIL_SEND_LOG_DIR;
  process.env.ACCOUNTS_LEDGER_PATH = join(dir, 'accounts.jsonl');
  process.env.EMAIL_SEND_LOG_DIR = join(dir, 'email-sends');
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  if (savedLedger === undefined) delete process.env.ACCOUNTS_LEDGER_PATH;
  else process.env.ACCOUNTS_LEDGER_PATH = savedLedger;
  if (savedLogDir === undefined) delete process.env.EMAIL_SEND_LOG_DIR;
  else process.env.EMAIL_SEND_LOG_DIR = savedLogDir;
});

async function createAccount() {
  await ensureAccountAsync(EMAIL, 'Rowan');
}

describe('profile create / save / load round-trip', () => {
  it('saves a valid profile and loads it back whole', async () => {
    await createAccount();
    const saved = await saveMemberProfileAsync(EMAIL, validInput(), NOW);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.created).toBe(true);

    const state = await loadAccountAsync(EMAIL);
    expect(state.member_profile?.full_name).toBe('Rowan Gardener');
    expect(state.member_profile?.birthday).toBe('1992-11-17');
    expect(state.member_profile?.phone).toBe('+18015550142');
    expect(state.member_profile?.address?.city).toBe('Salt Lake City');
    expect(state.member_profile?.feed_visibility).toBe('public'); // default
    expect(state.member_profile?.progress_photos_visibility).toBe('private'); // default
    expect(state.member_profile?.progress_reminders_opt_in).toBe(false); // default
    expect(state.member_profile?.socials.instagram).toBe('@rowan.grows');
  });

  it('rejects missing required fields with plain-language errors', async () => {
    await createAccount();
    const saved = await saveMemberProfileAsync(EMAIL, { full_name: 'Rowan' }, NOW);
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    const all = saved.errors.join(' ');
    expect(all).toMatch(/birthday/i);
    expect(all).toMatch(/bio/i);
    expect(all).toMatch(/photo/i);
    const state = await loadAccountAsync(EMAIL);
    expect(state.member_profile).toBeNull(); // nothing partial was stored
  });
});

describe('star chart — automatic on save', () => {
  it('computes and stores the chart at profile creation; the feed reflects it', async () => {
    await createAccount();
    await saveMemberProfileAsync(EMAIL, validInput(), NOW);
    const state = await loadAccountAsync(EMAIL);
    expect(state.star_chart).not.toBeNull();
    expect(state.star_chart?.sun_sign_id).toBe('scorpio'); // Nov 17
    expect(state.star_chart?.has_birth_details).toBe(false);
    expect(state.star_chart?.moon_phase.name.length).toBeGreaterThan(0);

    const feed = await getOwnMemberFeedAsync(EMAIL);
    expect(feed?.star_chart?.chart_saved).toBe(true);
    expect(feed?.star_chart?.sun_sign.name).toBe('Scorpio');
    expect(feed?.star_chart?.moon_phase?.name).toBe(state.star_chart?.moon_phase.name);
  });

  it('recomputes when birth details are added', async () => {
    const LATER = new Date('2026-11-09T12:00:00Z');
    await createAccount();
    await saveMemberProfileAsync(EMAIL, validInput(), NOW);
    const before = (await loadAccountAsync(EMAIL)).star_chart;
    const saved = await saveMemberProfileAsync(
      EMAIL,
      validInput({ birth_time: '07:30', birth_place: 'Provo, Utah' }),
      LATER,
    );
    expect(saved.ok).toBe(true);
    const after = (await loadAccountAsync(EMAIL)).star_chart;
    expect(after?.has_birth_details).toBe(true);
    expect(after?.computed_from.birth_place).toBe('Provo, Utah');
    expect(after?.computed_at).not.toBe(before?.computed_at ?? '');
    // An unrelated edit does NOT recompute (inputs unchanged).
    await saveMemberProfileAsync(EMAIL, validInput({ birth_time: '07:30', birth_place: 'Provo, Utah', bio: 'New bio.' }), LATER);
    const again = (await loadAccountAsync(EMAIL)).star_chart;
    expect(again?.computed_at).toBe(after?.computed_at);
  });
});

describe('age gates', () => {
  it('13+ for profiles: 12 refused (nothing stored), exactly 13 accepted', async () => {
    await createAccount();
    const twelve = await saveMemberProfileAsync(EMAIL, validInput({ birthday: '2014-06-15' }), NOW);
    expect(twelve.ok).toBe(false);
    if (!twelve.ok) expect(twelve.errors.join(' ')).toMatch(/13/);
    expect((await loadAccountAsync(EMAIL)).member_profile).toBeNull();

    const thirteen = await saveMemberProfileAsync(EMAIL, validInput({ birthday: '2013-11-08' }), NOW);
    expect(thirteen.ok).toBe(true);
  });

  it('18+ for progress photos: 17 refused at POST-service level, 18 allowed', async () => {
    await createAccount();
    await saveMemberProfileAsync(EMAIL, validInput({ birthday: '2008-11-09' }), NOW); // 17 at NOW
    const refused = await submitProgressCheckinAsync(EMAIL, { kind: 'before', photo_data_url: jpegDataUrl() }, NOW);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.status).toBe(403);
    expect((await loadAccountAsync(EMAIL)).progress_checkins).toHaveLength(0);

    await saveMemberProfileAsync(EMAIL, validInput({ birthday: '2008-11-08' }), NOW); // exactly 18
    const allowed = await submitProgressCheckinAsync(EMAIL, { kind: 'before', photo_data_url: jpegDataUrl() }, NOW);
    expect(allowed.ok).toBe(true);
    expect((await loadAccountAsync(EMAIL)).progress_checkins).toHaveLength(1);
  });

  it('check-in photos are stored EXIF-stripped', async () => {
    await createAccount();
    await saveMemberProfileAsync(EMAIL, validInput(), NOW);
    const added = await submitProgressCheckinAsync(EMAIL, { kind: 'before', photo_data_url: jpegDataUrl(true) }, NOW);
    expect(added.ok).toBe(true);
    const state = await loadAccountAsync(EMAIL);
    const stored = state.progress_checkins[0].photo_data_url;
    const bytes = Buffer.from(stored.split(',')[1], 'base64').toString('latin1');
    expect(bytes).not.toContain('Exif');
    expect(bytes).not.toContain('GPS');
    expect(bytes).not.toContain('40.7608');
  });
});

describe('privacy — the public composition', () => {
  it('public feed carries NO address, phone, or birthday — by field or by value', async () => {
    await createAccount();
    await saveMemberProfileAsync(EMAIL, validInput(), NOW);
    const pub = await getPublicMemberFeedAsync(EMAIL);
    expect(pub).not.toBeNull();
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toContain('239 S 1200 W');
    expect(serialized).not.toContain('+18015550142');
    expect(serialized).not.toContain('8015550142');
    expect(serialized).not.toContain('1992-11-17');
    expect(serialized).not.toContain('84104');
    expect(Object.keys(pub!)).not.toContain('address');
    expect(Object.keys(pub!)).not.toContain('phone');
    expect(Object.keys(pub!)).not.toContain('birthday');
    // …while the public things ARE there:
    expect(pub!.full_name).toBe('Rowan Gardener');
    expect(pub!.star_chart?.sun_sign.name).toBe('Scorpio');
  });

  it('private toggle refuses public rendering entirely', async () => {
    await createAccount();
    await saveMemberProfileAsync(EMAIL, validInput({ feed_visibility: 'private' }), NOW);
    expect(await getPublicMemberFeedAsync(EMAIL)).toBeNull();
    // …and the owner still sees their own garden.
    expect(await getOwnMemberFeedAsync(EMAIL)).not.toBeNull();
  });

  it('progress photos stay out of the public feed unless separately shared', async () => {
    await createAccount();
    await saveMemberProfileAsync(EMAIL, validInput(), NOW);
    await submitProgressCheckinAsync(EMAIL, { kind: 'before', photo_data_url: jpegDataUrl() }, NOW);
    const pubDefault = await getPublicMemberFeedAsync(EMAIL);
    expect(pubDefault!.progress_shared).toBe(false);
    expect(pubDefault!.progress_checkins).toHaveLength(0);

    await saveMemberProfileAsync(EMAIL, validInput({ progress_photos_visibility: 'shared' }), NOW);
    const pubShared = await getPublicMemberFeedAsync(EMAIL);
    expect(pubShared!.progress_shared).toBe(true);
    expect(pubShared!.progress_checkins).toHaveLength(1);
  });

  it('feed composes favorites + allies, and honest empties without them', async () => {
    await createAccount();
    await saveMemberProfileAsync(EMAIL, validInput(), NOW);
    const empty = await getOwnMemberFeedAsync(EMAIL);
    expect(empty!.favorites).toEqual([]);
    expect(empty!.allies).toEqual([]);

    await setLikesAsync(EMAIL, ['gaias-rose-soap']);
    await saveQuizResultAsync(EMAIL, SNAPSHOT);
    const full = await getOwnMemberFeedAsync(EMAIL);
    expect(full!.favorites).toEqual([{ handle: 'gaias-rose-soap', title: expect.any(String) }]);
    expect(full!.allies.map((a) => a.name)).toContain('Lemon Balm');
    const pub = await getPublicMemberFeedAsync(EMAIL);
    expect(pub!.allies.map((a) => a.name)).toContain('Lemon Balm');
  });
});

describe('welcome email (Phase C)', () => {
  it('is invoked once with the right content, and never twice', async () => {
    await createAccount();
    await saveMemberProfileAsync(EMAIL, validInput(), NOW);
    const provider = new CapturingProvider();
    const first = await sendProfileWelcomeEmailAsync(EMAIL, { provider });
    expect(first.sent).toBe(true);
    expect(provider.jobs).toHaveLength(1);
    const job = provider.jobs[0];
    expect(job.template).toBe('profile_welcome');
    expect(job.to).toBe(EMAIL);
    if (first.sent) expect(first.outcome.delivery).toBe('preview'); // logging provider — honest label
    const rendered = renderEmailMessage(job);
    expect(rendered.subject).toMatch(/Welcome/);
    expect(rendered.text).toContain('Rowan');
    expect(rendered.text).toContain('Scorpio');
    expect(rendered.text).toMatch(/never shown publicly/); // privacy explained
    expect(rendered.text).toMatch(/private by default/); // photo check-ins explained

    const second = await sendProfileWelcomeEmailAsync(EMAIL, { provider });
    expect(second.sent).toBe(false);
    if (!second.sent) expect(second.reason).toBe('already_welcomed');
    expect(provider.jobs).toHaveLength(1);
  });

  it('the default provider path runs through the logging preview honestly', async () => {
    await createAccount();
    await saveMemberProfileAsync(EMAIL, validInput(), NOW);
    const result = await sendProfileWelcomeEmailAsync(EMAIL);
    expect(result.sent).toBe(true);
    if (result.sent) {
      expect(result.outcome.provider).toBe(new LoggingEmailProvider().name);
      expect(result.outcome.delivery).toBe('preview');
    }
  });
});

describe('reminder math + opt-in (Phase B)', () => {
  it('first check-in is due at once; after a check-in the next is +14 days', async () => {
    await createAccount();
    await saveMemberProfileAsync(EMAIL, validInput(), NOW);
    let state = await loadAccountAsync(EMAIL);
    // The first due date is the account's own creation anchor.
    expect(progressReminderStatus(state, new Date(state.created_at ?? Date.now())).due).toBe(true);

    await submitProgressCheckinAsync(EMAIL, { kind: 'before', photo_data_url: jpegDataUrl() }, NOW);
    state = await loadAccountAsync(EMAIL);
    const status13 = progressReminderStatus(state, new Date('2026-11-21T12:00:00Z'));
    expect(status13.due).toBe(false);
    expect(status13.next_due_at).toBe('2026-11-22T12:00:00.000Z');
    const status14 = progressReminderStatus(state, new Date('2026-11-22T12:00:00Z'));
    expect(status14.due).toBe(true);
  });

  it('email reminder fires only when opted in + due, once per cycle, and records state server-side', async () => {
    process.env.ACCOUNT_SESSION_SECRET = 'test-secret-for-reminder-tokens';
    try {
      await createAccount();
      await saveMemberProfileAsync(EMAIL, validInput(), NOW); // opt-in defaults OFF
      const provider = new CapturingProvider();
      const off = await runProgressReminderForEmailAsync(EMAIL, { provider }, NOW);
      expect(off.sent).toBe(false);
      if (!off.sent) expect(off.reason).toBe('not_opted_in');
      expect(provider.jobs).toHaveLength(0);

      await saveMemberProfileAsync(EMAIL, validInput({ progress_reminders_opt_in: true }), NOW);
      // Evaluate just after the account's real creation anchor.
      const justAfterCreation = new Date(Date.now() + 60_000);
      const sent = await runProgressReminderForEmailAsync(EMAIL, { provider }, justAfterCreation);
      expect(sent.sent).toBe(true);
      expect(provider.jobs).toHaveLength(1);
      expect(provider.jobs[0].template).toBe('progress_checkin_reminder');
      const rendered = renderEmailMessage(provider.jobs[0]);
      // Every reminder carries the one-click unsubscribe link.
      expect(rendered.text).toContain('/api/account/progress-reminder/unsubscribe?email=');
      expect(rendered.text).toMatch(/unsubscribe/i);

      const state = await loadAccountAsync(EMAIL);
      expect(state.last_progress_reminder).not.toBeNull(); // server-side state
      const again = await runProgressReminderForEmailAsync(EMAIL, { provider }, justAfterCreation);
      expect(again.sent).toBe(false);
      if (!again.sent) expect(again.reason).toBe('already_reminded');
      expect(provider.jobs).toHaveLength(1);
    } finally {
      delete process.env.ACCOUNT_SESSION_SECRET;
    }
  });

  it('unsubscribe token verifies, and opting out flips only the opt-in', async () => {
    process.env.ACCOUNT_SESSION_SECRET = 'test-secret-for-reminder-tokens';
    try {
      await createAccount();
      await saveMemberProfileAsync(EMAIL, validInput({ progress_reminders_opt_in: true }), NOW);
      const token = reminderUnsubscribeToken(EMAIL);
      expect(token).toBeTruthy();
      expect(verifyReminderUnsubscribeToken(EMAIL, token)).toBe(true);
      expect(verifyReminderUnsubscribeToken(EMAIL, 'bogus-token-value')).toBe(false);
      expect(verifyReminderUnsubscribeToken('other@example.com', token)).toBe(false);

      expect(await optOutProgressRemindersAsync(EMAIL)).toBe(true);
      const state = await loadAccountAsync(EMAIL);
      expect(state.member_profile?.progress_reminders_opt_in).toBe(false);
      expect(state.member_profile?.full_name).toBe('Rowan Gardener'); // nothing else touched
    } finally {
      delete process.env.ACCOUNT_SESSION_SECRET;
    }
  });
});
