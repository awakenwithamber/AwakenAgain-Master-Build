/**
 * /profile/star-chart — the member's dedicated star-chart page
 * (owner addition 2026-11-08).
 *
 * The chart is computed AUTOMATICALLY at profile-save time from the
 * stored birth data (lib/accounts/star-chart.ts) and stored on the
 * profile — this page reads that stored chart (recomputing is never
 * a manual step). What is shown is exactly what can be honestly
 * computed: the sun sign with its element/modality/qualities and the
 * moon's phase at birth. When birth time/place are missing, the page
 * shows the chart that CAN be computed and invites the member to add
 * them — it never fakes the rest: ascendant, houses, and planetary
 * positions need an ephemeris engine and are PLANNED, named as such.
 *
 * Privacy: the exact birthday is never printed here or anywhere
 * public — the chart speaks in signs and phases.
 */
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  ACCOUNT_SESSION_COOKIE,
  resolveAccountSession,
} from '../../../lib/accounts/session';
import { loadAccountAsync } from '../../../lib/accounts/accounts';
import { zodiacForBirthday } from '../../../lib/accounts/zodiac';
import { BRAND_NAME } from '../../../lib/seo/config';
import styles from '../../../components/account/account.module.css';
import memberStyles from '../../../components/account/member.module.css';

export const metadata: Metadata = {
  title: 'Your star chart',
  description: `Your ${BRAND_NAME} star chart — sun sign, qualities, and the moon's phase on your day, computed from your profile.`,
  alternates: { canonical: '/profile/star-chart' },
};

export default async function StarChartPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value;
  const identity = token ? await resolveAccountSession(token) : null;
  const state = identity ? await loadAccountAsync(identity.email) : null;
  const member = state?.member_profile ?? null;
  const chart = state?.star_chart ?? null;
  const sun = member ? zodiacForBirthday(member.birthday) : null;

  return (
    <main id="main-content" className={styles.pageMain}>
      <div className={styles.hero}>
        <p className="section-ornament" aria-hidden="true">
          ✧
        </p>
        <h1>Your star chart</h1>
        <p>
          Drawn from your birth data the moment your profile was planted — and redrawn
          automatically whenever your birth details change.
        </p>
      </div>

      {!identity && (
        <div className={styles.card}>
          <p>Your chart lives behind your account gate.</p>
          <p className={styles.actions}>
            <Link className="btn-primary" href="/account">
              Sign in →
            </Link>
          </p>
        </div>
      )}

      {identity && !member && (
        <div className={styles.card}>
          <div className={memberStyles.gaiaBubble}>
            <p className={memberStyles.gaiaName}>Gaia</p>
            <p>
              No chart yet — your chart is drawn from your birthday the moment your
              profile is planted. Shall we?
            </p>
          </div>
          <p className={styles.actions}>
            <Link className="btn-primary" href="/profile/create">
              Create my profile — with Gaia →
            </Link>
          </p>
        </div>
      )}

      {member && sun && (
        <div className={styles.card}>
          <p className={memberStyles.starSign}>
            {sun.symbol} {sun.name}
          </p>
          <p>
            <strong>Sun sign:</strong> {sun.name} ({sun.datesLabel}) — a {sun.element} sign of{' '}
            {sun.modality} quality, traditionally ruled by {sun.ruler}.
          </p>
          <p>{sun.qualities}</p>
          {chart ? (
            <p>
              <strong>Moon at your birth:</strong> a {chart.moon_phase.name}, about{' '}
              {Math.round(chart.moon_phase.illumination * 100)}% lit,{' '}
              {chart.moon_phase.age_days} days into her cycle. (Computed from the moon's
              own synodic rhythm — sound for the phase; the moon's sign needs a true
              ephemeris and is not guessed here.)
            </p>
          ) : (
            <p>Your moon phase is being drawn — save your profile once more and it will appear.</p>
          )}

          {chart?.has_birth_details ? (
            <p>
              <strong>Birth details on file:</strong> {member.birth_time} · {member.birth_place}.
              The fuller chart they seed — ascendant, houses, planetary placements — is
              being prepared with a true ephemeris; when it opens, it opens here, from
              the details already saved.
            </p>
          ) : (
            <div className={memberStyles.reminderBanner} role="status">
              <strong>Your chart can grow fuller.</strong>
              <p>
                Add your birth <em>time</em> and <em>place</em> and the chart gains the
                seeds of its fuller form — the ascendant and houses are drawn from
                exactly those. What is shown above is everything that can be honestly
                computed from your birthday alone; nothing here is guessed.
              </p>
              <p className={styles.actions}>
                <Link className="btn-primary" href="/profile/create">
                  Add birth time &amp; place →
                </Link>
              </p>
            </div>
          )}
          <p className={styles.note}>
            Your exact birthday is never printed — here, or anywhere public. Charts speak
            in signs and phases.
          </p>
          <p className={styles.actions}>
            <Link className="btn-secondary" href="/profile">
              ← Back to your garden
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}
