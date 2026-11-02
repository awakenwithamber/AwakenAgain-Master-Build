/**
 * Account auth island for /account — Phase 2B registration redesign
 * (owner directive 2026-10-30), replacing the passwordless-only
 * SignInForm.
 *
 * CREATE ACCOUNT and SIGN IN are unmistakably separate (tabs with
 * clear headings). Create account: name, email, phone with country
 * code, shipping address, password + confirm — then a 6-digit email
 * verification code activates the account and signs the customer in.
 * Sign in: email + password, OR the preserved legacy path "Email me a
 * sign-in code" for passwordless accounts. Forgot password runs on the
 * same code system. Phone is collected for order contact only — no
 * text messages, no phone verification (no SMS provider exists).
 *
 * HONESTY (carried over from SignInForm): code copy never claims an
 * email was sent unless the server reports a real send — while the
 * preview mailer is bound, the screens say so plainly.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { syncDeviceToProfile } from '../../lib/accounts/client';
import { validatePhoneNumber } from '../../lib/accounts/phone';
import {
  passwordsMatch,
  validatePasswordPolicy,
} from '../../lib/accounts/password-policy';
import { validateShippingAddress } from '../../lib/checkout/shipping-address';
import {
  AddressFields,
  EMPTY_ADDRESS_FIELDS,
  addressPayload,
  type AddressFieldValues,
} from './AddressFields';
import { PhoneField } from './PhoneField';
import styles from './account.module.css';

type View =
  | 'signin'
  | 'register'
  | 'verifyEmail'
  | 'forgot'
  | 'reset'
  | 'codeEntry'
  | 'done';

interface ApiResult {
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
}

async function postJson(path: string, body: Record<string, unknown>): Promise<ApiResult> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok && json.ok === true, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: {} };
  }
}

function errorsOf(result: ApiResult, fallback: string): string[] {
  const errors = result.json.errors as string[] | undefined;
  return errors && errors.length > 0 ? errors : [fallback];
}

export function AuthForms({ available }: { available: boolean }) {
  const [view, setView] = useState<View>('signin');
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Shared identity + code state.
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [delivery, setDelivery] = useState<'sent' | 'preview' | 'failed'>('sent');
  // Resend cooldown countdown (seconds) — mirrors the server cooldown
  // so the Resend buttons explain themselves instead of dead-ending.
  const [resendWait, setResendWait] = useState(0);
  const [codeRequestId, setCodeRequestId] = useState<string | null>(null);

  // Registration state.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('US');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState<AddressFieldValues>(EMPTY_ADDRESS_FIELDS);
  const [noShipping, setNoShipping] = useState(false);
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  // Password state (sign-in / reset).
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirm, setNewConfirm] = useState('');
  const [unverifiedBlock, setUnverifiedBlock] = useState(false);

  // Focus the incoming view's heading on every step change (a11y).
  useEffect(() => {
    headingRef.current?.focus();
  }, [view, tab]);

  // Tick the resend cooldown down once a second.
  useEffect(() => {
    if (resendWait <= 0) return;
    const timer = setTimeout(
      () => setResendWait((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [resendWait]);

  const deliveryOf = (result: ApiResult): 'sent' | 'preview' | 'failed' =>
    result.json.delivery === 'sent'
      ? 'sent'
      : result.json.delivery === 'failed'
        ? 'failed'
        : 'preview';

  const startCooldown = (result: ApiResult) => {
    const retry = result.json.retry_after_seconds;
    setResendWait(
      typeof retry === 'number' && retry > 0 ? Math.ceil(retry) : 60,
    );
  };

  if (!available) {
    return (
      <div className={styles.card}>
        <h2>Profiles are opening soon</h2>
        <p>
          Accounts switch on together with email delivery, which is the
          next step for the apothecary. Until then, nothing is lost:
          your likes, quiz results, and the rest of your journey stay
          saved on this device, and they will join your profile the
          first time you sign in.
        </p>
        <p>
          New here? <Link href="/quiz">Find your herbal allies</Link> or{' '}
          <Link href="/network">explore the Awaken Network</Link>.
        </p>
      </div>
    );
  }

  const goTab = (next: 'signin' | 'register') => {
    setTab(next);
    setView(next);
    setErrors([]);
    setNotice(null);
    setUnverifiedBlock(false);
  };

  const finishSignedIn = async () => {
    // First-sign-in device sync (parity with the legacy code flow).
    await syncDeviceToProfile();
    setView('done');
    window.location.assign('/account');
  };

  /* ------------------------------ register ------------------------------ */

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const localErrors: string[] = [];
    if (!firstName.trim() || !lastName.trim()) {
      localErrors.push('Please add your first and last name.');
    }
    const phone = validatePhoneNumber(phoneCountry, phoneNumber);
    if (!phone.ok) localErrors.push(phone.error as string);
    const policy = validatePasswordPolicy(regPassword);
    if (!policy.ok) localErrors.push(...policy.errors);
    if (!passwordsMatch(regPassword, regConfirm)) {
      localErrors.push('Your passwords do not match. Please try again.');
    }
    if (!noShipping) {
      const addr = validateShippingAddress(
        addressPayload({
          ...address,
          name: address.name.trim() || `${firstName.trim()} ${lastName.trim()}`,
        }),
      );
      if (!addr.ok) localErrors.push(...addr.errors);
    }
    if (localErrors.length > 0) {
      setErrors(localErrors);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const result = await postJson('/api/account/register', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone_country: phoneCountry,
        phone: phoneNumber,
        password: regPassword,
        confirm_password: regConfirm,
        ...(noShipping
          ? { no_shipping_address: true }
          : {
              shipping_address: addressPayload({
                ...address,
                name:
                  address.name.trim() ||
                  `${firstName.trim()} ${lastName.trim()}`,
              }),
            }),
      });
      if (!result.ok) {
        setErrors(errorsOf(result, 'Registration could not be completed.'));
        if (result.json.code === 'account_exists') {
          setNotice(
            'That email already has an account — switch to Sign in above, or use Forgot password there.',
          );
        }
        return;
      }
      setDelivery(deliveryOf(result));
      startCooldown(result);
      setCode('');
      setNotice(null);
      setView('verifyEmail');
    } finally {
      setBusy(false);
    }
  };

  /* --------------------------- verify email ----------------------------- */

  const submitVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors([]);
    try {
      const result = await postJson('/api/account/verify-email', {
        email: email.trim(),
        code: code.trim(),
      });
      if (!result.ok) {
        setErrors(errorsOf(result, 'Verification failed.'));
        return;
      }
      await finishSignedIn();
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    if (busy || resendWait > 0) return;
    setBusy(true);
    setErrors([]);
    try {
      const result = await postJson('/api/account/resend-code', {
        email: email.trim(),
        purpose: 'email_verification',
      });
      if (result.ok) {
        setDelivery(deliveryOf(result));
        startCooldown(result);
        setNotice(
          result.json.delivery === 'sent'
            ? `A fresh verification code is on its way to ${email.trim()}.`
            : result.json.delivery === 'failed'
              ? `We tried to email ${email.trim()} just now and the delivery failed. Check the address for typos, then try again in a moment.`
              : 'Email delivery isn\u2019t switched on yet, so a new code can\u2019t reach your inbox today.',
        );
      } else {
        if (result.json.code === 'resend_cooldown') startCooldown(result);
        setErrors(errorsOf(result, 'Could not resend the code.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const resendSigninCode = async () => {
    if (busy || resendWait > 0) return;
    setBusy(true);
    setErrors([]);
    try {
      const result = await postJson('/api/account/resend-code', {
        email: email.trim(),
        purpose: 'account_signin',
      });
      if (!result.ok) {
        if (result.json.code === 'resend_cooldown') startCooldown(result);
        setErrors(errorsOf(result, 'Could not send a new sign-in code.'));
        return;
      }
      // A resent sign-in code verifies against its NEW request_id.
      if (typeof result.json.request_id === 'string') {
        setCodeRequestId(result.json.request_id);
      }
      setDelivery(deliveryOf(result));
      startCooldown(result);
      setCode('');
      setNotice(
        result.json.delivery === 'failed'
          ? `We tried to email ${email.trim()} just now and the delivery failed. Check the address for typos, then try again in a moment.`
          : result.json.delivery === 'sent'
            ? `A fresh sign-in code is on its way to ${email.trim()} — the code you had before no longer works.`
            : null,
      );
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------ sign in ------------------------------- */

  const submitPasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors([]);
    setUnverifiedBlock(false);
    try {
      const result = await postJson('/api/account/sign-in', {
        email: email.trim(),
        password,
      });
      if (!result.ok) {
        setErrors(errorsOf(result, 'Sign-in failed.'));
        if (result.json.code === 'email_unverified') {
          setUnverifiedBlock(true);
        }
        return;
      }
      await finishSignedIn();
    } finally {
      setBusy(false);
    }
  };

  const requestSigninCode = async () => {
    if (busy) return;
    if (!email.trim()) {
      setErrors(['Enter your email above first, then ask for a sign-in code.']);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const result = await postJson('/api/account/request-code', {
        email: email.trim(),
      });
      if (!result.ok) {
        setErrors(errorsOf(result, 'Could not send a sign-in code.'));
        return;
      }
      setCodeRequestId(result.json.request_id as string);
      setDelivery(deliveryOf(result));
      startCooldown(result);
      setCode('');
      setView('codeEntry');
    } finally {
      setBusy(false);
    }
  };

  const submitSigninCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !codeRequestId) return;
    setBusy(true);
    setErrors([]);
    try {
      const result = await postJson('/api/account/verify', {
        request_id: codeRequestId,
        code: code.trim(),
      });
      if (!result.ok) {
        setErrors(errorsOf(result, 'Verification failed.'));
        return;
      }
      await finishSignedIn();
    } finally {
      setBusy(false);
    }
  };

  /* --------------------------- forgot / reset ---------------------------- */

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors([]);
    try {
      const result = await postJson('/api/account/forgot-password', {
        email: email.trim(),
      });
      if (!result.ok) {
        setErrors(errorsOf(result, 'Could not start the reset.'));
        return;
      }
      setNotice(result.json.message as string);
      setCode('');
      setView('reset');
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const localErrors: string[] = [];
    const policy = validatePasswordPolicy(newPassword);
    if (!policy.ok) localErrors.push(...policy.errors);
    if (!passwordsMatch(newPassword, newConfirm)) {
      localErrors.push('Your passwords do not match. Please try again.');
    }
    if (localErrors.length > 0) {
      setErrors(localErrors);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const result = await postJson('/api/account/reset-password', {
        email: email.trim(),
        code: code.trim(),
        password: newPassword,
        confirm_password: newConfirm,
      });
      if (!result.ok) {
        setErrors(errorsOf(result, 'The reset could not be completed.'));
        return;
      }
      await finishSignedIn();
    } finally {
      setBusy(false);
    }
  };

  const resendReset = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await postJson('/api/account/forgot-password', { email: email.trim() });
      setNotice(
        'If an account exists for that email, a fresh reset code is on its way.',
      );
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------- render -------------------------------- */

  if (view === 'done') {
    return (
      <div className={styles.card}>
        <p className={styles.successNote}>
          ✦ You&apos;re signed in — bringing up your profile…
        </p>
      </div>
    );
  }

  const errorList =
    errors.length > 0 ? (
      <ul className={styles.errors} role="alert">
        {errors.map((err) => (
          <li key={err}>{err}</li>
        ))}
      </ul>
    ) : null;

  const codeDeliveryNote =
    delivery === 'sent' ? (
      <p className={styles.note}>
        Your code is on its way to {email} — it lasts 10 minutes. If it
        doesn&apos;t arrive within a minute or two, check your spam
        folder, then use Resend below.
      </p>
    ) : delivery === 'failed' ? (
      <p className={styles.note}>
        We tried to email {email} just now and the delivery failed —
        no code is on its way. Check the address for typos, go back and
        correct it if needed, then try again in a moment.
      </p>
    ) : (
      <p className={styles.note}>
        Email delivery isn&apos;t switched on yet, so this code can&apos;t
        reach your inbox today — everything opens fully the moment
        delivery launches, and your details stay saved until then.
      </p>
    );

  const resendLabel = (base: string) =>
    resendWait > 0 ? `${base} (${resendWait}s)` : base;

  return (
    <div className={styles.card}>
      <div className={styles.tabs} role="tablist" aria-label="Create account or sign in">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'register'}
          className={styles.tabBtn}
          onClick={() => goTab('register')}
        >
          Create account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'signin'}
          className={styles.tabBtn}
          onClick={() => goTab('signin')}
        >
          Sign in
        </button>
      </div>

      {view === 'register' && (
        <>
          <h2 ref={headingRef} tabIndex={-1}>
            Create your account
          </h2>
          <p>
            One account for your herbal allies, likes, saved searches,
            and order history — separate from Living Grimoire membership.
            We&apos;ll email you a 6-digit code to verify your email and
            finish.
          </p>
          <form className={styles.form} onSubmit={submitRegister} noValidate>
            <div className={styles.fieldRow}>
              <label htmlFor="reg-first-name">
                First name
                <input
                  id="reg-first-name"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </label>
              <label htmlFor="reg-last-name">
                Last name
                <input
                  id="reg-last-name"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </label>
            </div>
            <label htmlFor="reg-email">
              Email
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <PhoneField
              idPrefix="reg"
              country={phoneCountry}
              number={phoneNumber}
              onChange={(c, n) => {
                setPhoneCountry(c);
                setPhoneNumber(n);
              }}
            />
            {!noShipping && (
              <AddressFields
                idPrefix="reg-address"
                values={address}
                onChange={setAddress}
                legend="Shipping address (your default for orders)"
              />
            )}
            <label className={styles.checkLabel} htmlFor="reg-no-shipping">
              <input
                id="reg-no-shipping"
                type="checkbox"
                checked={noShipping}
                onChange={(e) => setNoShipping(e.target.checked)}
              />
              <span>
                I don&apos;t need shipping — I only buy digital items
                (like the Living Grimoire). I can add an address later.
              </span>
            </label>
            <label htmlFor="reg-password">
              Create a password
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                aria-describedby="reg-password-hint"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
              />
            </label>
            <p className={styles.hint} id="reg-password-hint">
              At least 10 characters, with a letter and a number.
            </p>
            <label htmlFor="reg-confirm">
              Confirm your password
              <input
                id="reg-confirm"
                type="password"
                autoComplete="new-password"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                required
              />
            </label>
            {notice ? <p className={styles.note}>{notice}</p> : null}
            {errorList}
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create my account'}
            </button>
          </form>
        </>
      )}

      {view === 'verifyEmail' && (
        <>
          <h2 ref={headingRef} tabIndex={-1}>
            Verify your email
          </h2>
          {codeDeliveryNote}
          <form className={styles.form} onSubmit={submitVerifyEmail}>
            <label htmlFor="verify-code">
              Verification code for {email}
              <input
                id="verify-code"
                className={styles.codeInput}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-describedby="verify-code-hint"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                maxLength={6}
                required
              />
            </label>
            <p className={styles.hint} id="verify-code-hint">
              Enter the 6-digit code from your email. When it matches,
              your account is activated and you&apos;re signed in. If the
              code has expired, use Resend below — no dead ends.
            </p>
            {notice ? <p className={styles.note}>{notice}</p> : null}
            {errorList}
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Verify & sign in'}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={resendVerification}
              disabled={busy || resendWait > 0}
            >
              {resendLabel('Resend verification code')}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => goTab('register')}
            >
              Start over
            </button>
          </form>
        </>
      )}

      {view === 'signin' && (
        <>
          <h2 ref={headingRef} tabIndex={-1}>
            Sign in
          </h2>
          <form className={styles.form} onSubmit={submitPasswordSignIn}>
            <label htmlFor="sign-email">
              Email
              <input
                id="sign-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label htmlFor="sign-password">
              Password
              <input
                id="sign-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {errorList}
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in with password'}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                setErrors([]);
                setView('forgot');
              }}
            >
              Forgot password?
            </button>
          </form>

          {unverifiedBlock && (
            <form
              className={styles.form}
              onSubmit={submitVerifyEmail}
              style={{ marginTop: '1.2rem' }}
            >
              <label htmlFor="sign-verify-code">
                Verification code for {email}
                <input
                  id="sign-verify-code"
                  className={styles.codeInput}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  maxLength={6}
                  required
                />
              </label>
              <button className="btn-primary" type="submit" disabled={busy}>
                {busy ? 'Checking…' : 'Verify & sign in'}
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={resendVerification}
                disabled={busy || resendWait > 0}
              >
                {resendLabel('Resend verification code')}
              </button>
              {notice ? <p className={styles.note}>{notice}</p> : null}
            </form>
          )}

          <div className={styles.divider} aria-hidden="true">
            or
          </div>
          <div className={styles.form}>
            <p className={styles.hint}>
              No password yet? Accounts from before passwords can still
              sign in the original way:
            </p>
            <button
              className="btn-secondary"
              type="button"
              onClick={requestSigninCode}
              disabled={busy}
            >
              Email me a sign-in code
            </button>
          </div>
        </>
      )}

      {view === 'codeEntry' && (
        <>
          <h2 ref={headingRef} tabIndex={-1}>
            Enter your sign-in code
          </h2>
          {codeDeliveryNote}
          {notice ? <p className={styles.note}>{notice}</p> : null}
          <form className={styles.form} onSubmit={submitSigninCode}>
            <label htmlFor="signin-code">
              6-digit code
              <input
                id="signin-code"
                className={styles.codeInput}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                maxLength={6}
                required
              />
            </label>
            {errorList}
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={resendSigninCode}
              disabled={busy || resendWait > 0}
            >
              {resendLabel('Resend sign-in code')}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                setView('signin');
                setCode('');
                setErrors([]);
              }}
            >
              Back to sign in
            </button>
          </form>
        </>
      )}

      {view === 'forgot' && (
        <>
          <h2 ref={headingRef} tabIndex={-1}>
            Forgot your password?
          </h2>
          <p>
            Enter your account email and we&apos;ll send a 6-digit reset
            code. The next screen asks for the code and your new
            password.
          </p>
          <form className={styles.form} onSubmit={submitForgot}>
            <label htmlFor="forgot-email">
              Email
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            {errorList}
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send me a reset code'}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => goTab('signin')}
            >
              Back to sign in
            </button>
          </form>
        </>
      )}

      {view === 'reset' && (
        <>
          <h2 ref={headingRef} tabIndex={-1}>
            Set a new password
          </h2>
          {notice ? <p className={styles.note}>{notice}</p> : null}
          <form className={styles.form} onSubmit={submitReset}>
            <label htmlFor="reset-code">
              Reset code for {email}
              <input
                id="reset-code"
                className={styles.codeInput}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                maxLength={6}
                required
              />
            </label>
            <label htmlFor="reset-password">
              New password
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                aria-describedby="reset-password-hint"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>
            <p className={styles.hint} id="reset-password-hint">
              At least 10 characters, with a letter and a number. If your
              code has expired, resend it below and use the fresh one.
            </p>
            <label htmlFor="reset-confirm">
              Confirm new password
              <input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                value={newConfirm}
                onChange={(e) => setNewConfirm(e.target.value)}
                required
              />
            </label>
            {errorList}
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Set password & sign in'}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={resendReset}
              disabled={busy}
            >
              Resend reset code
            </button>
          </form>
        </>
      )}
    </div>
  );
}
