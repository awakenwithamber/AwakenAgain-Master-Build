/**
 * Authorize.net Webhook — POST /api/webhooks/authorizenet
 * (card checkout build 2026-11-09, shop orders only).
 *
 * The ONLY path that can mark an Authorize.net shop order paid,
 * failed, or refunded. All processing lives in
 * lib/payments/authorizenet-webhook.ts (signature verification
 * before any state change, notification-claim idempotency,
 * re-fetched amount verification); this route is the HTTP shell:
 *
 * - webhook not configured → 503 (fail closed, never a silent 200)
 * - bad HMAC-SHA512 signature / unparseable payload → 400
 * - processing failure → 400 (Authorize.net retries; a paid order
 *   is never silently dropped)
 * - concurrent duplicate in flight → 503 + Retry-After
 * - processed (or already-processed duplicate) → 200
 */
import { NextResponse } from 'next/server';
import {
  createAuthorizeNetClient,
  getAuthorizeNetConfig,
} from '../../../../lib/payments/authorizenet';
import { processAuthorizeNetWebhook } from '../../../../lib/payments/authorizenet-webhook';
import { createLogger } from '../../../../lib/observability/logger';

const log = createLogger('api:webhooks:authorizenet');

export async function POST(request: Request) {
  const config = getAuthorizeNetConfig();

  if (!config.webhookConfigured) {
    log.warn('webhook hit while Authorize.net webhook is not configured');
    return NextResponse.json(
      { error: 'Authorize.net webhook is not configured.' },
      { status: 503 },
    );
  }

  const client = createAuthorizeNetClient();
  if (!client) {
    return NextResponse.json(
      { error: 'Authorize.net API is not configured.' },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-anet-signature');

  try {
    const result = await processAuthorizeNetWebhook(rawBody, signature, {
      config,
      client,
    });
    if (result.status !== 200) {
      log.warn('webhook delivery not processed', {
        outcome: result.outcome,
        status: result.status,
      });
    }
    return NextResponse.json(
      {
        received: result.status === 200,
        outcome: result.outcome,
        event_type: result.eventType,
        order_id: result.orderId,
      },
      {
        status: result.status,
        ...(result.outcome === 'duplicate_in_flight'
          ? { headers: { 'retry-after': '30' } }
          : {}),
      },
    );
  } catch (err) {
    log.error('webhook processing failed', { error: err });
    return NextResponse.json(
      { error: 'Webhook processing failed.' },
      { status: 400 },
    );
  }
}
