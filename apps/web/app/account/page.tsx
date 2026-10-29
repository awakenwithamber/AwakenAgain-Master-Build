/**
 * /account — My Account (Phase 3 Step 3, owner spec 2026-10-15).
 *
 * Server-rendered from the session cookie: a live session renders the
 * profile (account fold + linked quiz leads + order history, composed
 * by lib/accounts/profile.ts); no session renders the email-code
 * sign-in. When sign-in is not configured on this server, the sign-in
 * island shows the honest not-yet-open state instead of a dead form.
 *
 * The Grimoire keeps its own gate (OTP + entitlement); this page
 * additionally SHOWS the member's subscription state (Stage 3:
 * active / past-due grace / cancelling / lapsed, composed by
 * lib/accounts/profile.ts) and offers Stripe Customer Portal
 * management for card subscribers. Display never grants entitlement.
 */
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import {
  ACCOUNT_SESSION_COOKIE,
  accountSessionsConfigured,
  resolveAccountSession,
} from '../../lib/accounts/session';
import { getProfileViewAsync } from '../../lib/accounts/profile';
import { SignInForm } from '../../components/account/SignInForm';
import { AccountProfile } from '../../components/account/AccountProfile';
import { BRAND_NAME } from '../../lib/seo/config';
import styles from '../../components/account/account.module.css';

export const metadata: Metadata = {
  title: 'My Profile',
  description: `Your ${BRAND_NAME} profile: saved herbal allies, likes, searches, and order history — sign in with an email code, no password.`,
  alternates: { canonical: '/account' },
};

export default async function AccountPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value;
  const identity = token ? await resolveAccountSession(token) : null;
  const profile = identity ? await getProfileViewAsync(identity.email) : null;

  return (
    <main id="main-content" className={styles.pageMain}>
      <div className={styles.hero}>
        <p className="section-ornament" aria-hidden="true">
          ✦
        </p>
        <h1>My Profile</h1>
        <p>
          Your corner of the apothecary: the herbal allies you&apos;ve
          found, the products you love, the searches you keep, and the
          orders you&apos;ve placed — saved to a profile that follows
          your email, not just this device.
        </p>
      </div>

      {profile ? (
        <AccountProfile profile={profile} />
      ) : (
        <SignInForm available={accountSessionsConfigured()} />
      )}
    </main>
  );
}
