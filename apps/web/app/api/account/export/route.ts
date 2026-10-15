/**
 * GET /api/account/export — download everything stored for the account
 * (Phase 3 Step 3).
 *
 * The complete file, assembled from the authoritative stores
 * (lib/accounts/profile.ts): folded profile, every lead record for the
 * email, every order record for the email. Served as a JSON attachment
 * to the signed-in owner of the data — nobody else can reach it.
 */
import { NextResponse } from 'next/server';
import {
  accountFail,
  requireAccountSession,
} from '../../../../lib/accounts/http';
import { buildAccountExportAsync } from '../../../../lib/accounts/profile';
import { captureContentServerEventSoon } from '../../../../lib/analytics/content-posthog-server';
import { resolveServerDistinctId } from '../../../../lib/analytics/posthog-server';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, 'account-read');
  if (limited) return limited;

  const session = await requireAccountSession(request);
  if (!session.ok) return session.response;

  const data = await buildAccountExportAsync(session.identity.email);
  if (!data) {
    return accountFail(['No account data was found for this sign-in.'], 404);
  }

  captureContentServerEventSoon(
    'account_export_downloaded',
    { lead_count: data.leads.length, order_count: data.orders.length },
    resolveServerDistinctId(
      request.headers.get('cookie'),
      `account-session:${session.identity.session_id.slice(0, 12)}`,
    ),
  );

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="awaken-account-export.json"',
      'Cache-Control': 'no-store',
    },
  });
}
