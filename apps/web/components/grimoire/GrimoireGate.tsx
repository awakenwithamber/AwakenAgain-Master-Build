'use client';

/**
 * GrimoireGate — subscriber content gate component (G8).
 *
 * CLIENT: renders its `children` only when the visitor holds a valid OTP
 * session for the Living Grimoire gate. Otherwise it walks through:
 * email → request code → enter 6-digit code → session.
 *
 * The session token is kept in React state only (not persisted to
 * localStorage) until the durable store + session strategy is decided —
 * the in-memory OTP store is preview-only. This is intentional: nothing
 * here invents a session-persistence design.
 *
 * Server authority: session validity is decided by GET /api/grimoire-otp;
 * the component trusts that endpoint's verdict, not its own state.
 */
import { useCallback, useState } from 'react';

type GateState =
  | { step: 'email' }
  | { step: 'code'; requestId: string }
  | { step: 'verified'; sessionToken: string; email: string };

interface GrimoireGateProps {
  children: React.ReactNode;
  gateTitle?: string;
}

export function GrimoireGate({ children, gateTitle = 'Living Grimoire' }: GrimoireGateProps) {
  const [state, setState] = useState<GateState>({ step: 'email' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/grimoire-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as {
      ok: boolean;
      errors?: string[];
      request_id?: string;
      session_token?: string;
      expires_at?: number;
    };
    if (!response.ok || !data.ok) {
      throw new Error(data.errors?.[0] ?? 'Something went wrong.');
    }
    return data;
  }, []);

  const onRequest = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const data = await post({ action: 'request', email: email.trim() });
        setState({ step: 'code', requestId: data.request_id ?? '' });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not send a code.');
      } finally {
        setBusy(false);
      }
    },
    [busy, email, post],
  );

  const onVerify = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (busy || state.step !== 'code') return;
      setBusy(true);
      setError(null);
      try {
        const data = await post({
          action: 'verify',
          request_id: state.requestId,
          code: code.trim(),
        });
        setState({
          step: 'verified',
          sessionToken: data.session_token ?? '',
          email: email.trim(),
        });
        setCode('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed.');
      } finally {
        setBusy(false);
      }
    },
    [busy, code, email, post, state],
  );

  if (state.step === 'verified') {
    return <>{children}</>;
  }

  return (
    <section aria-labelledby="grimoire-gate-heading">
      <h2 id="grimoire-gate-heading">{gateTitle} — subscriber access</h2>
      <p>
        This content is for Living Grimoire members. Enter your email and we&apos;ll send a
        one-time code to verify your access.
      </p>
      {state.step === 'email' ? (
        <form onSubmit={onRequest} aria-label="Request access code">
          <div>
            <label htmlFor="gate-email">Email</label>
            <input
              id="gate-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send my code'}
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify} aria-label="Enter access code">
          <p>We sent a 6-digit code to {email}. It expires in 10 minutes.</p>
          <div>
            <label htmlFor="gate-code">Code</label>
            <input
              id="gate-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <button type="submit" disabled={busy}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setState({ step: 'email' });
              setCode('');
              setError(null);
            }}
          >
            Use a different email
          </button>
        </form>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
