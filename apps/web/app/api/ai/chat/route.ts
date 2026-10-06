/**
 * Lunna AI chat Route Handler (G11) — provider-neutral contract.
 *
 * POST /api/ai/chat { messages: [{ role, content }] } →
 *   { ok: true, reply, provider_id, provider_binding_needs_verification, disclaimer }
 *
 * The provider decision is NEEDS VERIFICATION: today the only provider is
 * the canned preview (lib/ai/chat-provider.ts). A future owner-approved
 * provider implements the ChatProvider interface and registers in
 * getChatProvider() — the route contract does not change.
 *
 * Guardrails: request validation caps message count/length; the provider
 * refuses diagnosis/treatment/cure intents; message content is never sent
 * to analytics.
 *
 * NOTE: only HTTP handlers and route config may be exported from a route
 * module — provider logic lives in lib/ai/chat-provider.ts.
 */
import { NextResponse } from 'next/server';
import { getChatProvider, validateChatRequest } from '../../../../lib/ai/chat-provider';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['Request body must be valid JSON.'] }, { status: 400 });
  }

  const validated = validateChatRequest(body);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, errors: [validated.error] }, { status: 422 });
  }

  const provider = getChatProvider();
  const response = await provider.respond(validated.messages);

  return NextResponse.json({
    ok: true,
    reply: response.reply,
    provider_id: response.provider_id,
    provider_binding_needs_verification: response.provider_binding_needs_verification,
    disclaimer: response.disclaimer,
  });
}
