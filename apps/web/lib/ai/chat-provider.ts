/**
 * Lunna AI chat — provider-neutral contract (G11).
 *
 * The provider decision is genuinely OPEN and marked NEEDS VERIFICATION
 * (CONVERSION_MAP §8 row 97: the legacy Vercel AI Gateway binding is
 * provider-specific and must not be assumed). This module defines the
 * provider INTERFACE the future binding will implement; the only provider
 * shipped now is a safe canned-response preview.
 *
 * HARD GUARDRAILS (owner compliance, CONVERSION_MAP §14 row 115):
 * - Lunna NEVER diagnoses, treats, cures, or prescribes. Any message that
 *   asks for diagnosis/treatment/cure/dosage-for-a-condition gets the
 *   refusal path — always.
 * - Scope is conservative herbal education (traditional uses, general
 *   product discovery, site navigation) with a disclaimer on EVERY reply.
 * - No health claims are invented: replies describe traditional uses and
 *   general education, never efficacy.
 * - Message content is never sent to analytics (see platform-events.ts).
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  /** Provider that produced the reply. */
  provider_id: string;
  /** Disclaimer rendered with every reply. */
  disclaimer: string;
  /** True until the owner picks a real provider. */
  provider_binding_needs_verification: boolean;
}

export interface ChatProvider {
  readonly id: string;
  readonly kind: 'canned_preview' | 'llm';
  respond(messages: ChatMessage[]): Promise<ChatResponse>;
}

export const LUNNA_DISCLAIMER =
  'Lunna is a concierge preview for Amber\u2019s Alchemy Apothecary — herbal education ' +
  'only, not medical advice. Herbal products complement but never replace professional ' +
  'medical guidance. If you have a health concern, please talk to a qualified professional.';

/**
 * Refusal intent detection — conservative keyword set. Anything that smells
 * like a request for diagnosis, treatment, cure, or dosing-for-a-condition
 * refuses. False positives are acceptable; false negatives are not.
 */
const REFUSAL_PATTERNS: RegExp[] = [
  /diagnos/i,
  /\bcure[sd]?\b/i,
  /\btreat(ment|ing|s)?\b/i,
  /\bprescri/i,
  /\bdosage\b/i,
  /\bdose\b/i,
  /\bcancer\b/i,
  /\bdiabetes\b/i,
  /\bpregnan/i,
  /\bbreastfeed/i,
  /\bmedication\b/i,
  /\bdrug interaction/i,
  /\bshould i take\b/i,
  /\bwhat should i (use|take) for\b/i,
  /\bheal\b/i,
  /\bdisease\b/i,
  /\bsymptom/i,
];

export function isRefusalIntent(content: string): boolean {
  return REFUSAL_PATTERNS.some((re) => re.test(content));
}

const REFUSAL_REPLY =
  'I can\u2019t help with diagnosis, treatment, or dosing — that\u2019s outside my ' +
  'role as your apothecary concierge. I\u2019m here for herbal education, product ' +
  'discovery, and helping you find your way around the shop. If you have a health ' +
  'concern, please speak with a qualified professional. Is there something about ' +
  'our botanicals, soaps, or the shop I can help you explore?';

interface TopicReply {
  match: RegExp;
  reply: string;
}

const TOPIC_REPLIES: TopicReply[] = [
  {
    match: /lavender/i,
    reply:
      'Lavender is one of the most beloved botanicals in the apothecary — traditionally ' +
      'used in evening and bedtime rituals, and the heart of our Moonlit Lavender ' +
      'signature scent. You\u2019ll find it in several soaps and in the soap builder\u2019s ' +
      'scent step. Would you like me to point you to the lavender-scented soaps?',
  },
  {
    match: /chamomile|calendula/i,
    reply:
      'Chamomile and calendula are classic gentle botanicals, long used in traditional ' +
      'skincare rituals for their soothing reputation. Both appear as botanical options ' +
      'in the custom soap builder. They\u2019re lovely choices if you enjoy soft, ' +
      'floral-herbal profiles.',
  },
  {
    match: /soap|builder|custom/i,
    reply:
      'The custom soap builder is the heart of the shop: pick a base, a shape, a scent ' +
      '(a signature recipe or your own blend of up to 3 oils), a botanical, and a color — ' +
      'then watch your creation come together in the live preview. Every bar is handmade ' +
      'in small batches by Amber.',
  },
  {
    match: /shipping|delivery/i,
    reply:
      'Shipping is free on orders over $100 (over $75 for subscribers), and orders are ' +
      'fulfilled in about 3–5 business days. Amber confirms every order personally.',
  },
  {
    match: /price|cost|much/i,
    reply:
      'Soaps are priced by shape and size — from $5.77 for a Small Rose to $11.77 for the ' +
      'large bars — and the five-style Alchemy Soap Collection is $35.77. Standard ' +
      'botanical capsules are $19.77 for a 2-week supply or $47.77 for 30 days. All ' +
      'prices are computed server-side at checkout, so what you see is what you pay.',
  },
  {
    match: /grimoire/i,
    reply:
      'The Living Grimoire is the membership circle — $7.77/month with 10% off storewide, ' +
      'monthly articles and rituals, exclusive recipes, and early access to new creations. ' +
      'Safety information is never paywalled.',
  },
  {
    match: /quiz/i,
    reply:
      'The Herbal Allies Quiz matches you with botanicals that suit your ritual style — ' +
      'a lovely starting point if you\u2019re new to the apothecary.',
  },
];

const DEFAULT_REPLY =
  'Welcome to the apothecary! I\u2019m Lunna, your concierge preview — I can help you ' +
  'explore botanicals, find a soap or scent, learn about the custom soap builder, or ' +
  'answer questions about shipping and the shop. What are you curious about today?';

/**
 * Canned preview provider — the ONLY provider shipped until the owner picks
 * a real one. Deterministic, safe, and honest: it never pretends to be a
 * general AI and never answers health questions.
 */
export class CannedPreviewProvider implements ChatProvider {
  readonly id = 'canned-preview';
  readonly kind = 'canned_preview' as const;

  async respond(messages: ChatMessage[]): Promise<ChatResponse> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const content = lastUser?.content ?? '';
    const reply = isRefusalIntent(content)
      ? REFUSAL_REPLY
      : (TOPIC_REPLIES.find((t) => t.match.test(content))?.reply ?? DEFAULT_REPLY);
    return {
      reply,
      provider_id: this.id,
      disclaimer: LUNNA_DISCLAIMER,
      provider_binding_needs_verification: true,
    };
  }
}

/**
 * Provider registry — returns the active provider. Today this is always the
 * canned preview; a future owner-approved LLM provider registers here behind
 * the provider decision (NEEDS VERIFICATION).
 */
export function getChatProvider(): ChatProvider {
  return new CannedPreviewProvider();
}

/** Request validation shared by the route handler and its tests. */
export const CHAT_MAX_MESSAGES = 10;
export const CHAT_MAX_MESSAGE_CHARS = 500;

export function validateChatRequest(body: unknown): { ok: true; messages: ChatMessage[] } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }
  const { messages } = body as { messages?: unknown };
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: 'messages must be a non-empty array.' };
  }
  if (messages.length > CHAT_MAX_MESSAGES) {
    return { ok: false, error: `messages is limited to ${CHAT_MAX_MESSAGES} entries.` };
  }
  const clean: ChatMessage[] = [];
  for (const m of messages) {
    if (typeof m !== 'object' || m === null) {
      return { ok: false, error: 'Each message must be an object with role and content.' };
    }
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      return { ok: false, error: 'Each message needs role ("user" | "assistant") and string content.' };
    }
    if (content.length === 0 || content.length > CHAT_MAX_MESSAGE_CHARS) {
      return { ok: false, error: `Message content must be 1–${CHAT_MAX_MESSAGE_CHARS} characters.` };
    }
    clean.push({ role, content });
  }
  if (!clean.some((m) => m.role === 'user')) {
    return { ok: false, error: 'At least one user message is required.' };
  }
  return { ok: true, messages: clean };
}
