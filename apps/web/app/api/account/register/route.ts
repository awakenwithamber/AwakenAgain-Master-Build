/**
 * POST /api/account/register — create a profile (Phase 2B, owner
 * registration-redesign directive 2026-10-30).
 *
 * Collects first + last name, email, phone (with country code), a
 * password (scrypt-hashed — lib/accounts/password.ts; never plaintext),
 * and the default shipping address (owner addition 2026-10-30). The
 * account is created UNVERIFIED; a 6-digit verification code (purpose
 * 'email_verification', durable store) is emailed, and activation
 * hinges on that code alone — POST /api/account/verify-email finishes
 * the signup and signs the customer in.
 *
 * DUPLICATES (spec item 6): an email that already has a live account
 * gets 409 { code: 'account_exists' } and NO second account — the UI
 * routes the person to sign-in / password reset. A tombstoned email is
 * refused (403), exactly like the other account routes.
 *
 * ADDRESS JUDGMENT CALL (flagged in the Phase-2 report): the address
 * is part of the form per the owner's direction, but a customer who
 * only ever buys digital goods (e.g. the Grimoire) can tick "I don't
 * need shipping" (no_shipping_address: true) and register without one
 * — registration stays completable; the address can be added later
 * from the profile, and checkout asks for it whenever an order ships.
 *
 * Fail-closed like the other auth routes: with the session secret
 * unconfigured, registration is unavailable (503) and nothing is
 * written — an account nobody could ever activate would be a trap.
 */
import { NextResponse } from 'next/server';
import {
  appendRegistrationDetailsAsync,
  ensureAccountAsync,
  loadAccountAsync,
  setAccountPasswordAsync,
  setAccountShippingAddressAsync,
} from '../../../../lib/accounts/accounts';
import {
  accountFail,
  isRecordBody,
  readJsonBody,
  SIGNIN_UNAVAILABLE_MESSAGE,
} from '../../../../lib/accounts/http';
import {
  ACCOUNT_OTP_TTL_SECONDS,
  getAccountOtpStore,
  requestCode,
} from '../../../../lib/accounts/otp';
import { hashPassword, passwordsMatch, validatePasswordPolicy } from '../../../../lib/accounts/password';
import { validatePhoneNumber } from '../../../../lib/accounts/phone';
import { accountSessionsConfigured } from '../../../../lib/accounts/session';
import {
  validateShippingAddress,
  type ShippingAddress,
} from '../../../../lib/checkout/shipping-address';
import {
  buildAccountVerificationCodeJob,
  createEmailProvider,
  emailDeliveryIsPreview,
} from '../../../../lib/jobs/email';
import { sanitizeEmail, sanitizePlainText } from '../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';
import { createLogger } from '../../../../lib/observability/logger';

const log = createLogger('api:account-register');

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'account-auth');
  if (limited) return limited;

  if (!accountSessionsConfigured()) {
    return accountFail([SIGNIN_UNAVAILABLE_MESSAGE], 503);
  }

  const body = await readJsonBody(request);
  if (!isRecordBody(body)) {
    return accountFail(['Request body must be a JSON object.'], 400);
  }

  const firstName = sanitizePlainText(body.first_name, 80);
  const lastName = sanitizePlainText(body.last_name, 80);
  const email = sanitizeEmail(body.email);
  if (!firstName || !lastName) {
    return accountFail(['Please add your first and last name.']);
  }
  if (!email) {
    return accountFail(['Please provide a valid email address.']);
  }

  const phone = validatePhoneNumber(body.phone_country, body.phone);
  if (!phone.ok) {
    return accountFail([phone.error ?? 'Please add a valid phone number.']);
  }

  const policy = validatePasswordPolicy(body.password);
  if (!policy.ok) {
    return accountFail(policy.errors);
  }
  if (!passwordsMatch(body.password, body.confirm_password)) {
    return accountFail(['Your passwords do not match. Please try again.']);
  }

  // Shipping address — required unless the customer opts out as
  // digital-only (see header). Validated by the ONE shared validator.
  let address: ShippingAddress | null = null;
  if (body.no_shipping_address !== true) {
    const validated = validateShippingAddress(body.shipping_address);
    if (!validated.ok) {
      return accountFail(validated.errors);
    }
    address = validated.address;
  }

  const existing = await loadAccountAsync(email);
  if (existing.deleted) {
    return accountFail(
      [
        'This account was deleted, so it can no longer be used. ' +
          'If this was a mistake, reach out through the contact page.',
      ],
      403,
    );
  }
  if (existing.exists) {
    return NextResponse.json(
      {
        ok: false,
        code: 'account_exists',
        errors: [
          'An account already exists for this email. Sign in below — ' +
            'or use "Forgot password" if you need to reset your password.',
        ],
      },
      { status: 409 },
    );
  }

  await ensureAccountAsync(email, `${firstName} ${lastName}`);
  await appendRegistrationDetailsAsync(email, {
    first_name: firstName,
    last_name: lastName,
    phone: phone.normalized as string,
  });
  await setAccountPasswordAsync(email, hashPassword(body.password as string));
  if (address) {
    await setAccountShippingAddressAsync(email, address);
  }

  // Verification code — durable store, delivered through the provider
  // abstraction only; the code is never logged or returned.
  const issued = await requestCode(
    getAccountOtpStore(),
    email,
    'email_verification',
  );
  let delivery: 'preview' | 'sent' = emailDeliveryIsPreview() ? 'preview' : 'sent';
  try {
    const job = buildAccountVerificationCodeJob(email, {
      code: issued.code,
      expires_in_minutes: Math.floor(ACCOUNT_OTP_TTL_SECONDS / 60),
    });
    const result = await createEmailProvider().send(job);
    if (!result.ok) delivery = 'preview';
  } catch (err) {
    log.error('verification code delivery failed', { error: err });
    delivery = 'preview';
  }

  return NextResponse.json(
    {
      ok: true,
      email,
      verification_required: true,
      expires_in_seconds: issued.request.expires_in_seconds,
      delivery,
    },
    { status: 201 },
  );
}
