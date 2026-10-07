/**
 * "Learn About Herbal Medicine" — links to the free educational resources.
 */
import styles from './home.module.css';

const RESOURCES = [
  {
    emoji: '📖',
    title: 'Articles & Guides',
    copy: 'In-depth guides on herbs for sleep, stress, digestion, and hormones.',
    href: '/journal',
    linkLabel: 'Read the guides →',
  },
  {
    emoji: '🌿',
    title: 'Herb Encyclopedia',
    copy: 'Browse 316+ botanicals — benefits, traditional uses, and how they work.',
    href: '/herb-index',
    linkLabel: 'Explore the encyclopedia →',
  },
];

export function LearnSection() {
  return (
    <section className={styles.section} aria-labelledby="learn-heading">
      <div className={styles.container}>
        <div className={styles.ornament} aria-hidden="true">
          ✦ ─────────────── ✦
        </div>
        <h2 id="learn-heading" className={styles.sectionTitle}>
          Learn About Herbal Medicine
        </h2>
        <p className={styles.sectionSub}>
          Explore our free educational resources.
        </p>
        <div className={styles.learnGrid}>
          {RESOURCES.map((resource) => (
            <article key={resource.title} className={styles.learnCard}>
              <div className={styles.learnIcon} aria-hidden="true">
                {resource.emoji}
              </div>
              <h3 className={styles.learnTitle}>{resource.title}</h3>
              <p className={styles.learnCopy}>{resource.copy}</p>
              <a className={styles.btnSecondary} href={resource.href}>
                {resource.linkLabel}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
