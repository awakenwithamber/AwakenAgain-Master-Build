/**
 * Member feed — the shared rendering of a member's garden (Gaia
 * profile build). Used by the owner's /profile and the public
 * /members/[member] page with the SAME component but DIFFERENT data:
 * the public page passes the public composition (whose type carries
 * no address, phone, or birthday at all — privacy by construction).
 *
 * Empty collections render as honest empty states. Social entries are
 * profile LINKS (Phase D: links + share buttons; platform login is
 * app-review-gated and deliberately not built).
 */
import type {
  FeedAlly,
  FeedFavorite,
  StarChartView,
} from '../../lib/accounts/member-feed';
import type {
  MemberSocialLinks,
  ProgressCheckin,
} from '../../lib/accounts/accounts';
import styles from './member.module.css';
import accountStyles from './account.module.css';

export interface FeedDisplayData {
  full_name: string;
  bio: string;
  photo_data_url: string;
  socials: MemberSocialLinks;
  favorites: FeedFavorite[];
  allies: FeedAlly[];
  star_chart: StarChartView | null;
  progress_checkins: ProgressCheckin[];
}

/** Turn a stored handle/URL into the network profile link. */
export function socialProfileUrl(network: 'facebook' | 'tiktok' | 'instagram', value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, '').replace(/\/$/, '');
  if (network === 'facebook') return `https://www.facebook.com/${handle}`;
  if (network === 'tiktok') return `https://www.tiktok.com/@${handle}`;
  return `https://www.instagram.com/${handle}`;
}

const SOCIAL_LABELS = { facebook: 'Facebook', tiktok: 'TikTok', instagram: 'Instagram' } as const;

export function MemberFeed({
  feed,
  publicUrl,
  chartHref,
}: {
  feed: FeedDisplayData;
  /** Absolute public URL when the feed is public — enables share buttons. */
  publicUrl?: string | null;
  /** Owner-only link to the dedicated star-chart page. */
  chartHref?: string | null;
}) {
  const socialEntries = (
    Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]
  ).filter((network) => feed.socials[network]);

  return (
    <div>
      <div className={styles.feedHeader}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.profilePhoto} src={feed.photo_data_url} alt={`${feed.full_name} — profile photo`} />
        <div>
          <h2 style={{ margin: '0 0 0.35rem' }}>{feed.full_name}</h2>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{feed.bio}</p>
          {socialEntries.length > 0 && (
            <p style={{ margin: '0.5rem 0 0' }}>
              {socialEntries.map((network, i) => (
                <span key={network}>
                  {i > 0 && ' · '}
                  <a href={socialProfileUrl(network, feed.socials[network]!)} target="_blank" rel="noreferrer">
                    {SOCIAL_LABELS[network]}
                  </a>
                </span>
              ))}
            </p>
          )}
          {publicUrl && (
            <div className={styles.shareRow}>
              <a
                className="btn-secondary"
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`}
                target="_blank"
                rel="noreferrer"
              >
                Share on Facebook
              </a>
              <a className="btn-secondary" href={publicUrl}>
                Your public feed link
              </a>
            </div>
          )}
        </div>
      </div>

      <div className={styles.feedGrid}>
        <section className={accountStyles.card} aria-label="Favorites">
          <h3>✦ Favorites</h3>
          {feed.favorites.length > 0 ? (
            <ul className={accountStyles.list}>
              {feed.favorites.map((favorite) => (
                <li key={favorite.handle} className={accountStyles.listRow}>
                  <a href={`/shop/${favorite.handle}`}>{favorite.title}</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyState}>
              No favorites yet — tap the heart on anything in the shop and it will live here.
            </p>
          )}
        </section>

        <section className={accountStyles.card} aria-label="Herbal allies">
          <h3>🌿 Herbal allies</h3>
          {feed.allies.length > 0 ? (
            <ul className={accountStyles.allyList}>
              {feed.allies.map((ally) => (
                <li key={ally.name}>
                  <strong>{ally.name}</strong>
                  {ally.latin ? ` (${ally.latin})` : ''}
                  {ally.note ? ` — ${ally.note}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyState}>
              No allies yet — take the Guided Wellness Quiz and the plants that match you will
              gather here.
            </p>
          )}
        </section>

        <section className={accountStyles.card} aria-label="Star chart">
          <h3>✧ Star chart</h3>
          {feed.star_chart ? (
            <>
              <p className={styles.starSign}>
                {feed.star_chart.sun_sign.symbol} {feed.star_chart.sun_sign.name}
              </p>
              <p>
                {feed.star_chart.sun_sign.datesLabel} · {feed.star_chart.sun_sign.element} sign ·{' '}
                {feed.star_chart.sun_sign.modality} quality · ruled by {feed.star_chart.sun_sign.ruler}
              </p>
              <p>{feed.star_chart.sun_sign.qualities}</p>
              {feed.star_chart.moon_phase && (
                <p>
                  🌙 Born under a {feed.star_chart.moon_phase.name} — the moon was{' '}
                  {Math.round(feed.star_chart.moon_phase.illumination * 100)}% lit on that day
                  (approximate, from the moon's own cycle).
                </p>
              )}
              {chartHref && (
                <p>
                  <a href={chartHref}>See your full star chart →</a>
                </p>
              )}
              {feed.star_chart.birth_time || feed.star_chart.birth_place ? (
                <p className={accountStyles.meta}>
                  Born {feed.star_chart.birth_time ?? ''}
                  {feed.star_chart.birth_place ? ` in ${feed.star_chart.birth_place}` : ''} — the
                  fuller chart (ascendant, houses) is being drawn and will open here.
                </p>
              ) : (
                <p className={accountStyles.meta}>
                  Add your birth time and place to your profile to seed your fuller chart.
                </p>
              )}
            </>
          ) : (
            <p className={styles.emptyState}>Your star chart appears once your birthday is saved.</p>
          )}
        </section>

        <section className={accountStyles.card} aria-label="Progress photos">
          <h3>🌱 Progress</h3>
          {feed.progress_checkins.length > 0 ? (
            <div className={styles.checkinGrid}>
              {feed.progress_checkins.map((checkin) => (
                <figure key={checkin.id} className={styles.checkinFigure}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={checkin.photo_data_url} alt={`Progress check-in — ${checkin.kind}`} />
                  <figcaption>
                    {checkin.kind === 'before'
                      ? 'Before'
                      : checkin.kind === 'after'
                        ? 'After'
                        : 'Check-in'}{' '}
                    · {new Date(checkin.recorded_at).toLocaleDateString()}
                    {checkin.note ? ` — ${checkin.note}` : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>
              No progress photos here — check-ins appear when the member adds them (and shares
              them, for public gardens).
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
