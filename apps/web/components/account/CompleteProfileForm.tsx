/**
 * Complete / update profile form — Phase 2B (spec item 6 + the owner's
 * shipping-address addition, 2026-10-30).
 *
 * Two variants over the ONE endpoint (POST /api/account/complete-profile):
 * - 'complete': the "Complete your profile" section for accounts
 *   missing registration pieces (chiefly legacy passwordless accounts):
 *   name + phone, a password when none exists yet, and the default
 *   shipping address.
 * - 'address': the shipping-address editor for complete profiles —
 *   view/edit of the saved default; orders keep their own copy, so
 *   editing here never rewrites a placed order.
 *
 * On success the route answers with the fresh profile and the page
 * refreshes from server truth (router.refresh, the admin pattern).
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  splitNormalizedPhone,
  validatePhoneNumber,
} from '../../lib/accounts/phone';
import {
  passwordsMatch,
  validatePasswordPolicy,
} from '../../lib/accounts/password-policy';
import type { ProfileView } from '../../lib/accounts/profile';
import { validateShippingAddress } from '../../lib/checkout/shipping-address';
import {
  AddressFields,
  addressFieldsFromSaved,
  addressPayload,
  type AddressFieldValues,
} from './AddressFields';
import { PhoneField } from './PhoneField';
import styles from './account.module.css';

interface CompleteProfileFormProps {
  profile: ProfileView;
  variant: 'complete' | 'address';
}

export function CompleteProfileForm({
  profile,
  variant,
}: CompleteProfileFormProps) {
  const router = useRouter();
  const split = splitNormalizedPhone(profile.phone);
  const [firstName, setFirstName] = useState(profile.first_name ?? '');
  const [lastName, setLastName] = useState(profile.last_name ?? '');
  const [phoneCountry, setPhoneCountry] = useState(split?.country.iso2 ?? 'US');
  const [phoneNumber, setPhoneNumber] = useState(split?.national ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [address, setAddress] = useState<AddressFieldValues>(
    addressFieldsFromSaved(profile.shipping_address),
  );
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const localErrors: string[] = [];
    const payload: Record<string, unknown> = {};

    if (variant === 'complete') {
      if (!firstName.trim() || !lastName.trim()) {
        localErrors.push('Please add your first and last name.');
      }
      const phone = validatePhoneNumber(phoneCountry, phoneNumber);
      if (!phone.ok) localErrors.push(phone.error as string);
      payload.first_name = firstName.trim();
      payload.last_name = lastName.trim();
      payload.phone_country = phoneCountry;
      payload.phone = phoneNumber;
      if (!profile.has_password) {
        if (password) {
          const policy = validatePasswordPolicy(password);
          if (!policy.ok) localErrors.push(...policy.errors);
          if (!passwordsMatch(password, confirm)) {
            localErrors.push('Your passwords do not match. Please try again.');
          }
          payload.password = password;
          payload.confirm_password = confirm;
        }
      }
    }

    const addr = validateShippingAddress(
      addressPayload({
        ...address,
        name:
          address.name.trim() ||
          `${firstName.trim()} ${lastName.trim()}`.trim() ||
          profile.email,
      }),
    );
    if (!addr.ok) localErrors.push(...addr.errors);
    else payload.shipping_address = addressPayload(address);

    if (localErrors.length > 0) {
      setErrors(localErrors);
      return;
    }
    setBusy(true);
    setErrors([]);
    setSaved(false);
    try {
      const res = await fetch('/api/account/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        errors?: string[];
      };
      if (!res.ok || !json.ok) {
        setErrors(json.errors ?? ['Saving did not go through. Please try again.']);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setErrors(['Saving did not go through. Please try again.']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {variant === 'complete' && (
        <>
          <div className={styles.fieldRow}>
            <label htmlFor="cp-first-name">
              First name
              <input
                id="cp-first-name"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </label>
            <label htmlFor="cp-last-name">
              Last name
              <input
                id="cp-last-name"
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </label>
          </div>
          <PhoneField
            idPrefix="cp"
            country={phoneCountry}
            number={phoneNumber}
            onChange={(c, n) => {
              setPhoneCountry(c);
              setPhoneNumber(n);
            }}
          />
          {!profile.has_password && (
            <>
              <label htmlFor="cp-password">
                Set a password (so you can sign in with it next time)
                <input
                  id="cp-password"
                  type="password"
                  autoComplete="new-password"
                  aria-describedby="cp-password-hint"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <p className={styles.hint} id="cp-password-hint">
                At least 10 characters, with a letter and a number. Leave
                blank to keep signing in with an email code.
              </p>
              <label htmlFor="cp-confirm">
                Confirm your password
                <input
                  id="cp-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
            </>
          )}
        </>
      )}
      <AddressFields
        idPrefix={variant === 'complete' ? 'cp-address' : 'addr'}
        values={address}
        onChange={setAddress}
        legend="Default shipping address"
      />
      {errors.length > 0 && (
        <ul className={styles.errors} role="alert">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
      {saved && (
        <p className={styles.successNote} role="status">
          ✦ Saved — your profile is up to date.
        </p>
      )}
      <button className="btn-primary" type="submit" disabled={busy}>
        {busy
          ? 'Saving…'
          : variant === 'complete'
            ? 'Save my details'
            : 'Save shipping address'}
      </button>
    </form>
  );
}
