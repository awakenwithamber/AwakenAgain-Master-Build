/**
 * Shipping-address field group — Phase 2 (Workstreams 1a + 2B).
 *
 * The account-side address form (registration, complete-profile,
 * profile edit): renders inside the account .form styling. The fields
 * map 1:1 onto lib/checkout/shipping-address's ShippingAddress, and
 * the shared validator is the authority — this component only renders
 * and collects. State selection appears for US addresses; other
 * countries get a free-text region field, exactly like the validator.
 */
'use client';

import {
  ADDRESS_COUNTRIES,
  US_STATES,
  type ShippingAddress,
} from '../../lib/checkout/shipping-address';

export interface AddressFieldValues {
  name: string;
  street: string;
  street2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export const EMPTY_ADDRESS_FIELDS: AddressFieldValues = {
  name: '',
  street: '',
  street2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'US',
};

export function addressFieldsFromSaved(
  saved: ShippingAddress | null | undefined,
): AddressFieldValues {
  if (!saved) return EMPTY_ADDRESS_FIELDS;
  return {
    name: saved.name ?? '',
    street: saved.street ?? '',
    street2: saved.street2 ?? '',
    city: saved.city ?? '',
    state: saved.state ?? '',
    postal_code: saved.postal_code ?? '',
    country: saved.country ?? 'US',
  };
}

/** Field-values → validator payload (street2 omitted when blank). */
export function addressPayload(values: AddressFieldValues) {
  return {
    name: values.name.trim(),
    street: values.street.trim(),
    ...(values.street2.trim() ? { street2: values.street2.trim() } : {}),
    city: values.city.trim(),
    state: values.state.trim(),
    postal_code: values.postal_code.trim(),
    country: values.country,
  };
}

interface AddressFieldsProps {
  /** Unique id prefix (multiple address forms can share a page). */
  idPrefix: string;
  values: AddressFieldValues;
  onChange: (values: AddressFieldValues) => void;
  /** Heading shown above the group. */
  legend?: string;
}

export function AddressFields({
  idPrefix,
  values,
  onChange,
  legend = 'Shipping address',
}: AddressFieldsProps) {
  const set = (patch: Partial<AddressFieldValues>) =>
    onChange({ ...values, ...patch });
  const id = (name: string) => `${idPrefix}-${name}`;
  const isUs = values.country === 'US';

  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend
        style={{
          color: 'var(--parchment)',
          fontSize: '0.95rem',
          padding: 0,
          marginBottom: '0.35rem',
        }}
      >
        {legend}
      </legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <label htmlFor={id('name')}>
          Name for delivery
          <input
            id={id('name')}
            type="text"
            autoComplete="shipping name"
            value={values.name}
            onChange={(e) => set({ name: e.target.value })}
            required
          />
        </label>
        <label htmlFor={id('street')}>
          Street address
          <input
            id={id('street')}
            type="text"
            autoComplete="shipping street-address"
            value={values.street}
            onChange={(e) => set({ street: e.target.value })}
            required
          />
        </label>
        <label htmlFor={id('street2')}>
          Apartment, suite, or unit (optional)
          <input
            id={id('street2')}
            type="text"
            autoComplete="shipping address-line2"
            value={values.street2}
            onChange={(e) => set({ street2: e.target.value })}
          />
        </label>
        <label htmlFor={id('country')}>
          Country
          <select
            id={id('country')}
            autoComplete="shipping country"
            value={values.country}
            onChange={(e) => set({ country: e.target.value, state: '' })}
          >
            {ADDRESS_COUNTRIES.map((c) => (
              <option key={c.iso2} value={c.iso2}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={id('city')}>
          City
          <input
            id={id('city')}
            type="text"
            autoComplete="shipping address-level2"
            value={values.city}
            onChange={(e) => set({ city: e.target.value })}
            required
          />
        </label>
        {isUs ? (
          <label htmlFor={id('state')}>
            State
            <select
              id={id('state')}
              autoComplete="shipping address-level1"
              value={values.state}
              onChange={(e) => set({ state: e.target.value })}
              required
            >
              <option value="">Choose a state…</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label htmlFor={id('state')}>
            State, province, or region
            <input
              id={id('state')}
              type="text"
              autoComplete="shipping address-level1"
              value={values.state}
              onChange={(e) => set({ state: e.target.value })}
              required
            />
          </label>
        )}
        <label htmlFor={id('postal')}>
          {isUs ? 'ZIP code' : 'Postal code'}
          <input
            id={id('postal')}
            type="text"
            autoComplete="shipping postal-code"
            value={values.postal_code}
            onChange={(e) => set({ postal_code: e.target.value })}
            required
          />
        </label>
      </div>
    </fieldset>
  );
}
