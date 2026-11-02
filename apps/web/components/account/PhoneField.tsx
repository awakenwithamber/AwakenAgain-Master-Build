/**
 * Phone field with country-code selection — Phase 2B (spec items 1+3).
 *
 * Country selector + national number, validated by
 * lib/accounts/phone.ts (the same module the server uses). The copy is
 * explicit about the binding phone rule: the number is collected for
 * order contact only — phone verification is NOT offered, and no text
 * messages are sent (no SMS provider is configured).
 */
'use client';

import { PHONE_COUNTRIES } from '../../lib/accounts/phone';
import styles from './account.module.css';

interface PhoneFieldProps {
  idPrefix: string;
  country: string;
  number: string;
  onChange: (country: string, number: string) => void;
}

export function PhoneField({
  idPrefix,
  country,
  number,
  onChange,
}: PhoneFieldProps) {
  return (
    <>
      <div className={styles.fieldRow}>
        <label htmlFor={`${idPrefix}-phone-country`}>
          Country code
          <select
            id={`${idPrefix}-phone-country`}
            value={country}
            onChange={(e) => onChange(e.target.value, number)}
            autoComplete="tel-country-code"
          >
            {PHONE_COUNTRIES.map((c) => (
              <option key={c.iso2} value={c.iso2}>
                {c.name} (+{c.dial})
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${idPrefix}-phone`}>
          Phone number
          <input
            id={`${idPrefix}-phone`}
            type="tel"
            autoComplete="tel-national"
            value={number}
            onChange={(e) => onChange(country, e.target.value)}
            required
          />
        </label>
      </div>
      <p className={styles.hint} id={`${idPrefix}-phone-hint`}>
        For order questions only. We don&apos;t send text messages, and
        phone verification isn&apos;t offered — your email is how we
        verify your account.
      </p>
    </>
  );
}
