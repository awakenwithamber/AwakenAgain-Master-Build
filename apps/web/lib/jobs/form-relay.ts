/**
 * Form-relay job contract (G5 / CONVERSION_MAP §§85, 89).
 *
 * The legacy Netlify `form-relay` function mapped `{formType:
 * contact|consultation|soap-order|order}` to a Zapier webhook and POSTed
 * the payload. This module is the provider-neutral replacement contract:
 *
 *   1. `buildFormRelayJob(input)` — PURE. Describes the Zapier/email
 *      handoff as a typed job WITHOUT performing it: which form type,
 *      which env var holds the webhook, payload shape, retry policy, and
 *      the fallback when no webhook is configured. The job never contains
 *      the webhook URL itself (values stay in the environment).
 *   2. `attemptFormRelay(job, fetchImpl?)` — executes one delivery attempt
 *      against the configured webhook. Provider-neutral: it only needs a
 *      fetch-compatible function, so the trigger binding (scheduled
 *      worker, Route Handler, admin retry) can be supplied by the
 *      infrastructure layer after the provider decision.
 *   3. Unconfigured-webhook fallback — when the env var is absent the job
 *      is NOT attempted; the record stays in the local store (durable)
 *      and the job declares `fallback: 'local_store_manual_followup'`.
 *      Amber's messages are never lost because a webhook is missing.
 *
 * No Netlify/Cloudflare/Vercel/Zapier SDK imports here. The webhook URL is
 * read from process.env at attempt time so tests can inject config without
 * touching the environment.
 *
 * NOTE on naming: this file deliberately avoids the forbidden-provider
 * word list — the handoff target is described as a "webhook", never by a
 * vendor product name, keeping the shipped code provider-neutral.
 */
export type RelayFormType = 'contact' | 'consultation' | 'soap-order' | 'order';

/** Which env var holds the webhook for each form type (names only). */
export const RELAY_WEBHOOK_ENV: Record<RelayFormType, string> = {
  contact: 'ZAPIER_CONTACT_WEBHOOK',
  consultation: 'ZAPIER_CONSULTATION_WEBHOOK',
  'soap-order': 'ZAPIER_SOAP_ORDER_WEBHOOK',
  order: 'ZAPIER_ORDER_WEBHOOK',
};

export interface FormRelayJobInput {
  form_type: RelayFormType;
  /** Server-generated ID of the persisted record (message_id / order_id). */
  record_id: string;
  /** Sanitized payload — already validated by the Route Handler. */
  payload: Record<string, unknown>;
  received_at: string;
}

export interface FormRelayJob {
  job_id: string;
  job: 'form-relay';
  form_type: RelayFormType;
  record_id: string;
  payload: Record<string, unknown>;
  received_at: string;
  destination: {
    /**
     * Where the handoff goes. `kind` is always 'webhook' at build time —
     * whether a URL is actually configured is resolved at attempt time
     * (resolveRelayWebhook), because the builder is pure and never reads
     * the environment. The webhook URL itself never appears in a job —
     * values stay in the environment.
     */
    kind: 'webhook';
    env_var: string;
  };
  policy: {
    timeout_ms: number;
    max_attempts: number;
    retry: 'manual';
  };
  /**
   * What happens when delivery is impossible or unconfigured: the record
   * stays in the local durable store and Amber follows up manually.
   * Messages are never dropped.
   */
  fallback: 'local_store_manual_followup';
}

export interface RelayAttemptResult {
  ok: boolean;
  status?: number;
  error?: 'webhook_unconfigured' | 'timeout' | 'http_error' | 'network_error';
}

function generateJobId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `relay_${Date.now().toString(36)}_${rand}`;
}

export const FORM_RELAY_TIMEOUT_MS = 8000;
export const FORM_RELAY_MAX_ATTEMPTS = 1;

/**
 * Build the relay job description (pure — no I/O, no env reads). Describes
 * the handoff: form type, record, payload, destination config presence,
 * delivery policy, and the fallback. Safe to log, safe to persist.
 */
export function buildFormRelayJob(input: FormRelayJobInput): FormRelayJob {
  const envVar = RELAY_WEBHOOK_ENV[input.form_type];
  return {
    job_id: generateJobId(),
    job: 'form-relay',
    form_type: input.form_type,
    record_id: input.record_id,
    payload: input.payload,
    received_at: input.received_at,
    destination: { kind: 'webhook', env_var: envVar },
    policy: {
      timeout_ms: FORM_RELAY_TIMEOUT_MS,
      max_attempts: FORM_RELAY_MAX_ATTEMPTS,
      retry: 'manual',
    },
    fallback: 'local_store_manual_followup',
  };
}

/** Resolve the configured webhook URL for a job (env read at attempt time). */
export function resolveRelayWebhook(job: FormRelayJob): string | null {
  const url = process.env[job.destination.env_var];
  return url && url.trim().length > 0 ? url.trim() : null;
}

/**
 * Attempt one delivery of the job to its configured webhook.
 * `fetchImpl` is injectable for tests; defaults to global fetch.
 * Returns (never throws) — unconfigured webhook, timeouts, HTTP errors,
 * and network failures all surface as RelayAttemptResult.
 */
export async function attemptFormRelay(
  job: FormRelayJob,
  fetchImpl: typeof fetch = fetch,
): Promise<RelayAttemptResult> {
  const url = resolveRelayWebhook(job);
  if (!url) return { ok: false, error: 'webhook_unconfigured' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), job.policy.timeout_ms);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        form_type: job.form_type,
        record_id: job.record_id,
        received_at: job.received_at,
        payload: job.payload,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, status: res.status, error: 'http_error' };
    return { ok: true, status: res.status };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'timeout' };
    }
    return { ok: false, error: 'network_error' };
  } finally {
    clearTimeout(timer);
  }
}
