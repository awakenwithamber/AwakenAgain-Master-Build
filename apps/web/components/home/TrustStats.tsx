/**
 * "Why People Trust Amber's Alchemy" — trust stats band.
 */
import styles from './home.module.css';
import { TRUST_STATS } from './data';

export function TrustStats() {
  return (
    <section className={styles.section} aria-labelledby="trust-heading">
      <div className={styles.container}>
        <div className={styles.ornament} aria-hidden="true">
          ✦ ─────────────── ✦
        </div>
        <h2 id="trust-heading" className={styles.sectionTitle}>
          Why People Trust Amber&apos;s Alchemy
        </h2>
        <ul className={styles.trustGrid}>
          {TRUST_STATS.map((stat) => (
            <li key={stat.label} className={styles.trustStat}>
              <div className={styles.trustValue}>{stat.value}</div>
              <div className={styles.trustLabel}>{stat.label}</div>
              <p className={styles.trustCopy}>{stat.copy}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
