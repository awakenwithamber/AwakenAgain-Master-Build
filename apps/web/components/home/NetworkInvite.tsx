/**
 * Homepage invitation to /network (owner order 2026-10-15).
 *
 * One section only: the apothecary is a pane of the wider AWAKEN
 * series. Copy states where the series stands — most of it is still
 * in the making — and points at the project pane and the partnerships
 * page. No dates, rates, or availability are promised.
 */
import Link from 'next/link';
import styles from './home.module.css';

export function NetworkInvite() {
  return (
    <section
      className={`${styles.section} ${styles.paneBg}`}
      aria-labelledby="network-invite-heading"
    >
      <div className={`${styles.paneInner} ${styles.container}`}>
        <p className={styles.ornament} aria-hidden="true">
          ✦ ✦ ✦
        </p>
        <h2 id="network-invite-heading" className={styles.sectionTitle}>
          One Pane of the Awaken Network
        </h2>
        <p className={styles.sectionSub}>
          This apothecary belongs to a wider series growing under Awaken
          With Amber LLC — a community platform, a mobile service, a
          growth studio, AI agents, eco-villages, and brand tools, most
          still in the making. See where each project stands, register
          your interest in becoming an affiliate, or bring an idea of
          your own.
        </p>
        <p style={{ textAlign: 'center', margin: 0 }}>
          <Link href="/network" className={styles.btnPrimary}>
            Explore the Awaken Network ✦
          </Link>{' '}
          <Link href="/partner" className={styles.btnSecondary}>
            Partner With Us
          </Link>
        </p>
      </div>
    </section>
  );
}
