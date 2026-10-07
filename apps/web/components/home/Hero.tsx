/**
 * Homepage hero — Netlify fidelity rebuild.
 * hero-background.png texture with plum overlay, trust row, scroll hint.
 */
import styles from './home.module.css';

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={styles.heroContent}>
        <p className={styles.heroEyebrow}>✦ AWAKEN WITH AMBER LLC ✦</p>
        <h1 id="hero-heading" className={styles.heroTitle}>
          Discover Your Personal Herbal Allies
        </h1>
        <p className={styles.heroSub}>
          Answer a few thoughtful questions and receive your personalized herbal
          match — in under two minutes.
        </p>
        <div className={styles.heroCtas}>
          <a className={styles.btnPrimary} href="/quiz">
            ✦ Start My Wellness Quiz
          </a>
          <a className={styles.btnSecondary} href="/shop">
            Shop by Goal
          </a>
        </div>
        <ul className={styles.heroTrust}>
          <li>Small-Batch Crafted</li>
          <li>Personalized to You</li>
        </ul>
      </div>
      <a
        className={styles.scrollHint}
        href="#welcome-video"
        aria-label="Scroll down to the welcome video"
      >
        ↓
      </a>
    </section>
  );
}
