/**
 * "What Can We Help You With?" — 7 goal cards deep-linking to real product pages.
 */
import styles from './home.module.css';
import { GOAL_CARDS } from './data';

export function GoalCards() {
  return (
    <section
      className={`${styles.section} ${styles.paneBg}`}
      aria-labelledby="goals-heading"
    >
      <div className={`${styles.paneInner} ${styles.container}`}>
        <div className={styles.ornament} aria-hidden="true">
          ✦ ─────────────── ✦
        </div>
        <h2 id="goals-heading" className={styles.sectionTitle}>
          What Can We Help You With?
        </h2>
        <p className={styles.sectionSub}>
          Every path begins with a question — choose the one that sounds most
          like you, and meet the formula crafted for it.
        </p>
        <ul className={styles.goalGrid}>
          {GOAL_CARDS.map((goal) => (
            <li key={goal.heading} className={styles.goalCard}>
              <span className={styles.goalEmoji} aria-hidden="true">
                {goal.emoji}
              </span>
              {goal.badge ? (
                <span className={styles.goalBadge}>{goal.badge}</span>
              ) : null}
              <h3 className={styles.goalTitle}>{goal.heading}</h3>
              <p className={styles.goalCopy}>{goal.copy}</p>
              <a className={styles.goalLink} href={goal.link.href}>
                {goal.link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
