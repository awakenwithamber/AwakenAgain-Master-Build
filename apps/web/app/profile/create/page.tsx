/**
 * /profile/create — Gaia-guided profile creation (owner spec
 * 2026-11-08: "Create my profile" lands HERE, with Gaia).
 *
 * Signed-in members get the flow (skip-or-tour choice, then the
 * guided steps or the plain form). Signed-out visitors meet Gaia's
 * greeting and a clear path: create the account / sign in first at
 * /account (accounts are the identity; the member profile grows on
 * one), then return — Gaia keeps the door open, she does not invent
 * a second sign-in.
 */
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  ACCOUNT_SESSION_COOKIE,
  resolveAccountSession,
} from '../../../lib/accounts/session';
import { getOwnMemberFeedAsync } from '../../../lib/accounts/member-feed';
import { GAIA_PROFILE_GREETING } from '../../../lib/chat/gaia-profile';
import { GaiaProfileFlow } from '../../../components/account/GaiaProfileFlow';
import { BRAND_NAME } from '../../../lib/seo/config';
import styles from '../../../components/account/account.module.css';
import memberStyles from '../../../components/account/member.module.css';

export const metadata: Metadata = {
  title: 'Create your profile — with Gaia',
  description: `Gaia guides you through creating your ${BRAND_NAME} profile: your favorites, herbal allies, star chart, and progress garden.`,
  alternates: { canonical: '/profile/create' },
};

export default async function CreateProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value;
  const identity = token ? await resolveAccountSession(token) : null;
  const feed = identity ? await getOwnMemberFeedAsync(identity.email) : null;

  return (
    <main id="main-content" className={styles.pageMain}>
      <div className={styles.hero}>
        <p className="section-ornament" aria-hidden="true">
          ✦
        </p>
        <h1>{feed ? 'Tend your profile' : 'Create your profile'}</h1>
        <p>
          Gaia is waiting to walk with you — or to hand you the form and step aside.
          Either way, the same garden grows.
        </p>
      </div>

      {identity ? (
        <GaiaProfileFlow initial={feed} />
      ) : (
        <div className={styles.card}>
          <div className={memberStyles.gaiaBubble}>
            <p className={memberStyles.gaiaName}>Gaia</p>
            <p>{GAIA_PROFILE_GREETING}</p>
            <p>
              One thing first: your profile grows on your account, so I need you signed
              in before we plant. If you are new, creating your account takes a moment —
              then come right back here and we will begin.
            </p>
          </div>
          <p className={styles.actions}>
            <Link className="btn-primary" href="/account">
              Create your account / sign in →
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}
