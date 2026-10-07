/**
 * "How Our Remedies Are Made" — 4-step strip.
 */
import styles from './home.module.css';
import { HOW_MADE_STEPS } from './data';

export function HowMade() {
  return (
    <section
      className={`${styles.section} ${styles.paneBg}`}
      aria-labelledby="how-made-heading"
    >
      <div className={`${styles.paneInner} ${styles.container}`}>
        <div className={styles.ornament} aria-hidden="true">
          ✦ ─────────────── ✦
        </div>
        <h2 id="how-made-heading" className={styles.sectionTitle}>
          How Our Remedies Are Made
        </h2>
        <p className={styles.sectionSub}>
          From dried herb to your doorstep — every remedy follows the same
          careful path.
        </p>
        <ol className={styles.stepGrid}>
          {HOW_MADE_STEPS.map((step) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true" />
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepCopy}>{step.copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
