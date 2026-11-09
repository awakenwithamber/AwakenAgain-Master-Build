/**
 * Profile email send services — Gaia profile build (Phases B + C).
 *
 * Both sends route through the ONE provider factory
 * (lib/jobs/email.ts createEmailProvider): Resend when RESEND_API_KEY
 * binds it, the logging preview otherwise. HONESTY RULE (the quiz
 * rule, applied here): an outcome's `delivery` is 'resend' only when
 * the real provider accepted the send; while the preview is bound the
 * copy and the records say 'preview' — invoked is never reported as
 * delivered. Every completed send lands in the email send log with
 * its final status.
 *
 * - WELCOME (Phase C): fires exactly once per member — the first
 *   successful profile save records `account.profile_welcome_sent`
 *   in the account store, and this service refuses to send when that
 *   marker exists. The proof of delivery (owner's inbox, from
 *   preview, provider Verified) is a PREVIEW-STAGE run, reported
 *   separately — this module builds the path, it does not claim the
 *   proof.
 * - REMINDER (Phase B): OPT-IN ONLY. The pass runs for one member at
 *   a time (the scheduler binding lives outside the app, exactly like
 *   the review-reminder job); it sends only when the member opted in,
 *   a check-in is due, and no reminder was already invoked for this
 *   due cycle — then records the send in the account store so the
 *   state survives deploys.
 *
 * SERVER-ONLY.
 */
import {
  buildProfileWelcomeJob,
  buildProgressCheckinReminderJob,
  createEmailProvider,
  type EmailJob,
  type EmailProvider,
} from './email';
import { emailSendLog, type EmailSendLog } from './email-send-log';
import {
  loadAccountAsync,
  normalizeAccountEmail,
  recordProfileWelcomeSentAsync,
  recordProgressReminderSentAsync,
} from '../accounts/accounts';
import {
  progressReminderStatus,
  reminderUnsubscribeToken,
} from '../accounts/member-profile';
import { zodiacForBirthday } from '../accounts/zodiac';
import { siteUrl } from '../seo/config';

export interface ProfileEmailOutcome {
  job: EmailJob;
  status: 'sent' | 'failed';
  /** 'resend' = the real provider accepted it; 'preview' = NO real send happened. */
  delivery: 'resend' | 'preview';
  provider: string;
  provider_message_id: string | null;
  last_error: string | null;
}

export interface ProfileEmailDeps {
  provider?: EmailProvider;
  log?: EmailSendLog;
}

async function sendAndLog(
  job: EmailJob,
  deps: ProfileEmailDeps,
): Promise<ProfileEmailOutcome> {
  const provider = deps.provider ?? createEmailProvider();
  const log = deps.log ?? emailSendLog;
  const result = await provider.send(job);
  const delivery = provider.name === 'resend' ? 'resend' : 'preview';
  await log.append({
    job_id: job.id,
    to: job.to,
    template: job.template,
    provider: provider.name,
    provider_message_id: result.provider_message_id ?? null,
    status: result.ok ? 'sent' : 'failed',
    attempts: 1,
    last_error: result.ok ? null : (result.error ?? 'send failed'),
    at: new Date().toISOString(),
  });
  return {
    job,
    status: result.ok ? 'sent' : 'failed',
    delivery,
    provider: provider.name,
    provider_message_id: result.provider_message_id ?? null,
    last_error: result.ok ? null : (result.error ?? 'send failed'),
  };
}

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/* ------------------------------------------------------------------ */
/* Welcome (Phase C)                                                   */
/* ------------------------------------------------------------------ */

export type WelcomeSendResult =
  | { sent: true; outcome: ProfileEmailOutcome }
  | { sent: false; reason: 'no_profile' | 'already_welcomed' };

/**
 * Send the profile welcome email — once. Returns already_welcomed
 * without touching the provider when the store marker exists.
 */
export async function sendProfileWelcomeEmailAsync(
  emailInput: unknown,
  deps: ProfileEmailDeps = {},
): Promise<WelcomeSendResult> {
  const email = normalizeAccountEmail(emailInput);
  const state = await loadAccountAsync(email);
  if (!state.member_profile) return { sent: false, reason: 'no_profile' };
  if (state.profile_welcomed_at) return { sent: false, reason: 'already_welcomed' };
  const member = state.member_profile;
  const job = buildProfileWelcomeJob(email, {
    first_name: firstNameOf(member.full_name),
    sun_sign: zodiacForBirthday(member.birthday)?.name ?? null,
    profile_url: `${siteUrl()}/profile`,
  });
  const outcome = await sendAndLog(job, deps);
  if (outcome.status === 'sent') {
    await recordProfileWelcomeSentAsync(email, outcome.delivery);
  }
  return { sent: true, outcome };
}

/* ------------------------------------------------------------------ */
/* Progress reminder (Phase B)                                         */
/* ------------------------------------------------------------------ */

export type ReminderSendResult =
  | { sent: true; outcome: ProfileEmailOutcome; due_at: string }
  | {
      sent: false;
      reason: 'no_profile' | 'not_opted_in' | 'not_due' | 'already_reminded';
    };

/**
 * One member's reminder pass: send only when opted in + due + not yet
 * reminded for this due cycle; record the send server-side. The
 * unsubscribe link is included whenever a token can be minted.
 */
export async function runProgressReminderForEmailAsync(
  emailInput: unknown,
  deps: ProfileEmailDeps = {},
  now: Date = new Date(),
): Promise<ReminderSendResult> {
  const email = normalizeAccountEmail(emailInput);
  const state = await loadAccountAsync(email);
  if (!state.member_profile) return { sent: false, reason: 'no_profile' };
  const status = progressReminderStatus(state, now);
  if (!status.opted_in) return { sent: false, reason: 'not_opted_in' };
  if (!status.due || !status.next_due_at) return { sent: false, reason: 'not_due' };
  if (status.reminded_for_current_cycle) {
    return { sent: false, reason: 'already_reminded' };
  }
  const token = reminderUnsubscribeToken(email);
  const job = buildProgressCheckinReminderJob(email, {
    first_name: firstNameOf(state.member_profile.full_name),
    checkin_url: `${siteUrl()}/profile`,
    unsubscribe_url: token
      ? `${siteUrl()}/api/account/progress-reminder/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`
      : null,
  });
  const outcome = await sendAndLog(job, deps);
  if (outcome.status === 'sent') {
    await recordProgressReminderSentAsync(email, status.next_due_at, outcome.delivery);
  }
  return { sent: true, outcome, due_at: status.next_due_at };
}
