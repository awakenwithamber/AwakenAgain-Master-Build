'use client';

/**
 * PERMANENT_UNLOCK panel — CLIENT (Phase 2, Workstream 3: the manual
 * payment rail, decision packet 2026-10-24).
 *
 * Shows the unlock offer with its full terms (owner decision
 * 2026-10-21 §13(2), scope widened by owner decision 2026-11-02
 * WS4): $8.88 one-time, scope = the full composed Living Grimoire —
 * the complete 333-page edition together with the collected works
 * (1,389 pages in all) plus all future chapters/revisions of this
 * composed edition (separate future editions/add-ons not included),
 * no renewal, and a refund/chargeback revokes access.
 *
 * The flow is honest about being manual: the customer requests the
 * unlock with their email → a pending request is recorded → they pay
 * $8.88 by emailed Bookipi invoice or Venmo / Cash App with the
 * request ID as reference → access activates when Amber confirms the
 * payment (she grants it in admin and the customer gets a confirmation
 * email). Requesting grants nothing by itself — the panel says so,
 * and "Check my access" reads the real state from the server.
 */
import { useCallback, useState } from 'react';
import {
  GRIMOIRE_EDITION_NAME,
  GRIMOIRE_UNLOCK_SCOPE,
} from '../../lib/grimoire/edition';

interface PaymentInstructions {
  request_id: string;
  amount: string;
  payment_method: string;
  cash_app?: string;
  venmo?: string;
  reference: string;
  note: string;
}

type PanelState =
  | { step: 'form' }
  | { step: 'pending'; instructions: PaymentInstructions; message: string }
  | { step: 'active'; message: string };

export function UnlockPurchase() {
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState<'bookipi_invoice' | 'cash_app_or_venmo'>(
    'bookipi_invoice',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [state, setState] = useState<PanelState>({ step: 'form' });

  const post = useCallback(
    async (path: string, body: Record<string, unknown>) => {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      return { response, data };
    },
    [],
  );

  const onRequest = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const { response, data } = await post('/api/grimoire-unlock/request', {
          email: email.trim(),
          payment_method: method,
        });
        if (!response.ok || data.ok !== true) {
          const errors = data.errors as string[] | undefined;
          throw new Error(errors?.[0] ?? 'Could not record your request.');
        }
        if (data.state === 'already_unlocked') {
          setState({
            step: 'active',
            message: data.message as string,
          });
          return;
        }
        setState({
          step: 'pending',
          instructions: data.payment as PaymentInstructions,
          message: data.message as string,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not record your request.',
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, email, method, post],
  );

  const onCheck = useCallback(async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/grimoire-unlock/status?email=${encodeURIComponent(email.trim())}`,
      );
      const data = (await response.json()) as {
        ok: boolean;
        state?: string;
        errors?: string[];
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.errors?.[0] ?? 'Could not check your access.');
      }
      if (data.state === 'active') {
        setState({
          step: 'active',
          message:
            'Your permanent unlock is active — the full composed Living Grimoire (the complete 333-page edition together with the collected works) is open to this email.',
        });
      } else if (data.state === 'pending') {
        setNotice(
          'Your request is recorded and waiting for payment. Once Amber confirms your payment, your unlock activates and you\u2019ll get an email.',
        );
      } else if (data.state === 'revoked') {
        setNotice(
          'The unlock for this email was revoked after a refund or chargeback. If that seems wrong, contact Amber and she\u2019ll look into it.',
        );
      } else {
        setNotice(
          'No unlock or request found for this email yet — request the unlock below and it will appear here.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check your access.');
    } finally {
      setBusy(false);
    }
  }, [busy, email]);

  return (
    <section aria-labelledby="grimoire-unlock-heading">
      <h2 id="grimoire-unlock-heading">
        Permanent unlock — $8.88 one-time ({GRIMOIRE_EDITION_NAME})
      </h2>
      <p>
        <strong>Price:</strong> $8.88, paid once. No renewal, no
        subscription.
      </p>
      <p>
        <strong>Scope:</strong> {GRIMOIRE_UNLOCK_SCOPE}
      </p>
      <p>
        <strong>How it works:</strong> request the unlock with your
        email, then pay $8.88 by emailed invoice (pay by ACH bank
        transfer, Venmo, or Cash App) or send Venmo / Cash App directly
        — always with your request ID as the reference. Your unlock
        activates when Amber confirms your payment, and you&apos;ll get
        an email the moment it&apos;s active. If the payment is refunded
        or charged back, the unlock is revoked. Permanent rights are
        yours even if you later subscribe and cancel — subscribing never
        removes them.
      </p>

      {state.step === 'active' ? (
        <p role="status">
          <strong>✦ {state.message}</strong>{' '}
          <a href="/grimoire">Open the Living Grimoire →</a>
        </p>
      ) : state.step === 'pending' ? (
        <div aria-live="polite">
          <p role="status">
            <strong>Request recorded.</strong> {state.message}
          </p>
          <p>
            <strong>Pay $8.88</strong>
            {state.instructions.payment_method === 'bookipi_invoice'
              ? ' — your invoice will be emailed to you. Pay it by ACH bank transfer to Bluevine, or with:'
              : ' — send it with:'}
          </p>
          <ul>
            <li>
              <strong>Venmo:</strong> {state.instructions.venmo}
            </li>
            <li>
              <strong>Cash App:</strong> {state.instructions.cash_app}
            </li>
          </ul>
          <p>
            Reference: <code>{state.instructions.reference}</code> —
            include it in your payment note so Amber can match it to your
            request.
          </p>
          <p>{state.instructions.note}</p>
          <button type="button" onClick={onCheck} disabled={busy}>
            {busy ? 'Checking…' : 'Check my access'}
          </button>
          {notice ? <p role="status">{notice}</p> : null}
          {error ? <p role="alert">{error}</p> : null}
        </div>
      ) : (
        <form onSubmit={onRequest} aria-label="Request the permanent Grimoire unlock">
          <div>
            <label htmlFor="unlock-email">Email for your unlock</label>
            <input
              id="unlock-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="unlock-method">How you&apos;d like to pay</label>
            <select
              id="unlock-method"
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as 'bookipi_invoice' | 'cash_app_or_venmo')
              }
            >
              <option value="bookipi_invoice">
                Email me an invoice (pay by ACH, Venmo, or Cash App)
              </option>
              <option value="cash_app_or_venmo">
                I&apos;ll send Venmo / Cash App directly
              </option>
            </select>
          </div>
          <button type="submit" disabled={busy}>
            {busy ? 'Recording…' : 'Request my unlock — $8.88'}
          </button>
          <button type="button" onClick={onCheck} disabled={busy || !email.trim()}>
            Check my access
          </button>
          {notice ? <p role="status">{notice}</p> : null}
          {error ? <p role="alert">{error}</p> : null}
        </form>
      )}
    </section>
  );
}
