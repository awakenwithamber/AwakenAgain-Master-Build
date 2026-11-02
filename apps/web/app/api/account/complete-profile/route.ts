/**
 * POST /api/account/complete-profile — fill in registration details on
 * an existing account (Phase 2B, spec item 6 + the owner's
 * shipping-address addition).
 *
 * Session-required (the caller is already signed in — typically a
 * legacy passwordless account that arrived by sign-in code). Accepts
 * any combination of:
 * - first_name + last_name + phone (country code + number) → one
 *   'account.registration_details' event;
 * - password + confirm_password → sets a password ONLY when the
 *   account has none (changing an existing password goes through the
 *   forgot-password flow, which proves inbox possession);
 * - shipping_address → the default shipping address (validated by the
 *   shared validator), also the profile page's address edit path.
 *
 * Everything is validated BEFORE anything is written — a rejected
 * field never leaves a partial profile behind.
 *
 * Legacy verification inheritance: a pre-2B account had no
 * registration record, so it counted as verified without an explicit
 * event (it proved inbox possession to exist at all). Once details
 * exist, only the explicit 'account.email_verified' event settles
 * verification — so when details are written for an account lacking
 * the event, the event is recorded here: the session holder reached
 * this form through that same inbox, and completing a profile must
 * never retroactively un-verify a legacy account.
 *
 * Answers with the refreshed profile view so the page re-renders from
 * server truth.
 */
import { NextResponse } from 'next/server';
import {
  appendRegistrationDetailsAsync,
  loadAccountAsync,
  markAccountEmailVerifiedAsync,
  setAccountPasswordAsync,
  setAccountShippingAddressAsync,
} from '../../../../lib/accounts/accounts';
import {
  accountFail,
  isRecordBody,
  readJsonBody,
  requireAccountSession,
} from '../../../../lib/accounts/http';
import { hashPassword, passwordsMatch, validatePasswordPolicy } from '../../../../lib/accounts/password';
import { validatePhoneNumber } from '../../../../lib/accounts/phone';
import { getProfileViewAsync } from '../../../../lib/accounts/profile';
import {
  validateShippingAddress,
  type ShippingAddress,
} from '../../../../lib/checkout/shipping-address';
import { sanitizePlainText } from '../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'account-auth');
  if (limited) return limited;

  const session = await requireAccountSession(request);
  if (!session.ok) return session.response;
  const email = session.identity.email;

  const body = await readJsonBody(request);
  if (!isRecordBody(body)) {
    return accountFail(['Request body must be a JSON object.'], 400);
  }

  const state = await loadAccountAsync(email);
  if (!state.exists || state.deleted) {
    return accountFail(['Please sign in to continue.'], 401);
  }

  /* ---- validate everything first ---- */

  // Name + phone travel together — a partial details update would
  // store a misleading registration record.
  let details: {
    first_name: string;
    last_name: string;
    phone: string;
  } | null = null;
  const wantsDetails =
    body.first_name !== undefined ||
    body.last_name !== undefined ||
    body.phone !== undefined;
  if (wantsDetails) {
    const firstName = sanitizePlainText(body.first_name, 80);
    const lastName = sanitizePlainText(body.last_name, 80);
    if (!firstName || !lastName) {
      return accountFail(['Please add your first and last name.']);
    }
    const phone = validatePhoneNumber(body.phone_country, body.phone);
    if (!phone.ok) {
      return accountFail([phone.error ?? 'Please add a valid phone number.']);
    }
    details = {
      first_name: firstName,
      last_name: lastName,
      phone: phone.normalized as string,
    };
  }

  let passwordHash: string | null = null;
  if (body.password !== undefined) {
    if (state.password_hash) {
      return accountFail([
        'You already have a password. To change it, sign out and use ' +
          '"Forgot password" so we can verify it’s you.',
      ]);
    }
    const policy = validatePasswordPolicy(body.password);
    if (!policy.ok) {
      return accountFail(policy.errors);
    }
    if (!passwordsMatch(body.password, body.confirm_password)) {
      return accountFail(['Your passwords do not match. Please try again.']);
    }
    passwordHash = hashPassword(body.password as string);
  }

  let address: ShippingAddress | null = null;
  if (body.shipping_address !== undefined && body.shipping_address !== null) {
    const validated = validateShippingAddress(body.shipping_address);
    if (!validated.ok) {
      return accountFail(validated.errors);
    }
    address = validated.address;
  }

  if (!details && !passwordHash && !address) {
    return accountFail(['Nothing to update — the form was empty.']);
  }

  /* ---- then write ---- */

  if (details) await appendRegistrationDetailsAsync(email, details);
  if (passwordHash) await setAccountPasswordAsync(email, passwordHash);
  if (address) await setAccountShippingAddressAsync(email, address);

  // Legacy verification inheritance (see header).
  if (details && !state.email_verified_at) {
    await markAccountEmailVerifiedAsync(email);
  }

  const profile = await getProfileViewAsync(email);
  return NextResponse.json({ ok: true, profile });
}
