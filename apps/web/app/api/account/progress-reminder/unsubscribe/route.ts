/**
 * GET /api/account/progress-reminder/unsubscribe — one-click opt-out
 * from progress check-in reminder emails (Gaia profile build, Phase B:
 * "easy unsubscribe in every reminder email").
 *
 * No sign-in: the link carries an HMAC token over the member's email
 * (lib/accounts/member-profile.ts), verified constant-time. A valid
 * token flips ONLY the reminders opt-in — nothing else about the
 * profile — and the answer is a plain confirmation page. An invalid
 * or missing token changes nothing and says so plainly.
 */
import { NextResponse } from 'next/server';
import {
  optOutProgressRemindersAsync,
  verifyReminderUnsubscribeToken,
} from '../../../../../lib/accounts/member-profile';
import { normalizeAccountEmail } from '../../../../../lib/accounts/accounts';

function page(title: string, body: string, status = 200): NextResponse {
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    `<title>${title} · Awaken Again</title></head>` +
    '<body style="background:#1f1336;color:#f4e8d0;font-family:Georgia,serif;padding:40px 24px;max-width:640px;margin:0 auto;">' +
    `<h1 style="color:#e6c766;">${title}</h1><p>${body}</p>` +
    '<p><a style="color:#e6c766;" href="/profile">Return to your profile</a></p>' +
    '</body></html>';
  return new NextResponse(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = normalizeAccountEmail(url.searchParams.get('email'));
  const token = url.searchParams.get('token');
  if (!email || !verifyReminderUnsubscribeToken(email, token)) {
    return page(
      'That link did not check out',
      'This unsubscribe link is incomplete or no longer valid, so nothing was changed. You can turn reminder emails off any time from your profile’s privacy settings.',
      400,
    );
  }
  const done = await optOutProgressRemindersAsync(email);
  if (!done) {
    return page(
      'No profile found',
      'We could not find a member profile for that email, so there were no reminders to stop.',
      404,
    );
  }
  return page(
    'Reminders off',
    'Done — progress check-in reminder emails are off for your profile. Your check-ins themselves are untouched, and you can turn reminders back on any time in your profile.',
  );
}
