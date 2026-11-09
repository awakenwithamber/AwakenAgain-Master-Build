/**
 * /profile — the member's home feed (owner view; Gaia profile build
 * 2026-11-08).
 *
 * Server-rendered from the account session: favorites, herbal allies
 * (saved quiz results + linked leads), the auto-computed star chart,
 * the privacy gates, and the progress garden (reminder banner +
 * check-in form; the 18+ gate is composed server-side and enforced
 * again at POST). No profile yet → Gaia's invitation to create one.
 * No session → the sign-in path.
 *
 * When the allies shelf is still empty, Gaia's quiz invitation stands
 * prominent here too (the quiz is what fills it).
 */
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  ACCOUNT_SESSION_COOKIE,
  resolveAccountSession,
} from '../../lib/accounts/session';
import { getOwnMemberFeedAsync } from '../../lib/accounts/member-feed';
import { GAIA_QUIZ_INVITATION } from '../../lib/chat/gaia-profile';
import { MemberFeed } from '../../components/account/MemberFeed';
import {
  CheckinForm,
  PrivacyControls,
} from '../../components/account/ProfileControls';
import { siteUrl, BRAND_NAME } from '../../lib/seo/config';
import styles from '../../components/account/account.module.css';
import memberStyles from '../../components/account/member.module.css';

export const metadata: Metadata = {
  title: 'Your garden — home feed',
  description: `Your ${BRAND_NAME} home feed: favorites, herbal allies, your star chart, and your progress garden.`,
  alternates: { canonical: '/profile' },
};

export default async function ProfileFeedPage() {
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
        <h1>Your garden</h1>
        <p>
          Everything that is yours in the apothecary, in one sunny place — your
          favorites, your herbal allies, your stars, and your progress.
        </p>
      </div>

      {!identity && (
        <div className={styles.card}>
          <p>
            Your garden is behind your account gate. Sign in, and if you have not
            planted your profile yet, Gaia will walk you through it.
          </p>
          <p className={styles.actions}>
            <Link className="btn-primary" href="/account">
              Sign in →
            </Link>{' '}
            <Link className="btn-secondary" href="/profile/create">
              Create my profile
            </Link>
          </p>
        </div>
      )}

      {identity && !feed && (
        <div className={styles.card}>
          <div className={memberStyles.gaiaBubble}>
            <p className={memberStyles.gaiaName}>Gaia</p>
            <p>
              Your plot is marked out and the soil is ready — you just have not planted
              your profile yet. Two minutes with me, and this page becomes your garden.
            </p>
          </div>
          <p className={styles.actions}>
            <Link className="btn-primary" href="/profile/create">
              Create my profile — with Gaia →
            </Link>
          </p>
        </div>
      )}

      {feed && (
        <>
          <MemberFeed
            feed={feed}
            publicUrl={
              feed.feed_visibility === 'public'
                ? `${siteUrl()}${feed.public_path}`
                : null
            }
            chartHref="/profile/star-chart"
          />
          {feed.allies.length === 0 && (
            <div className={memberStyles.reminderBanner} role="status" style={{ marginTop: '1.25rem' }}>
              <strong>{GAIA_QUIZ_INVITATION.heading}</strong>
              <p>{GAIA_QUIZ_INVITATION.body}</p>
              <p className={styles.actions}>
                <a className="btn-primary" href={GAIA_QUIZ_INVITATION.ctaHref}>
                  {GAIA_QUIZ_INVITATION.ctaLabel}
                </a>
              </p>
            </div>
          )}
          <div className={memberStyles.feedGrid}>
            <PrivacyControls feed={feed} />
            <CheckinForm feed={feed} />
          </div>
          <p className={styles.note} style={{ marginTop: '1rem' }}>
            <Link href="/profile/create">Edit your profile details →</Link> ·{' '}
            <Link href="/account">Account, orders, and sign-in settings →</Link>
          </p>
        </>
      )}
    </main>
  );
}
